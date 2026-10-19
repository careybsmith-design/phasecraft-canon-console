create or replace function public.thread_signal_intake(p_actor jsonb, p_operation text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid; ev_id uuid; ev public.signal_intake_events; sig public.objects; o public.objects;
  dup public.objects; m public.objects; d public.objects; cond text; origin public.signal_origin;
  ref uuid; authorized boolean; cap public.signal_intake_captures;
begin
  perform public._assert_actor(p_actor);
  uid := (p_actor->>'id')::uuid;
  if not public._is_current_member(uid) then raise exception 'MEMBER_REQUIRED'; end if;

  if p_operation = 'record_event' then
    if coalesce(p->>'status','') not in ('received','rejected','extracted','no_proposal') then
      raise exception 'EVENT_STATUS: confirmed/duplicate/abandoned events are written only by the record, confirm, dedupe and capture paths';
    end if;
    insert into public.signal_intake_events (origin,status,source_ref,raw_input_ref,submitted_by,extraction_method,model_route,data_classification)
    values ((p->>'origin')::public.signal_origin, (p->>'status')::public.intake_status, p->>'source_ref', p->>'raw_input_ref',
            p_actor, coalesce(p->>'extraction_method','manual'), p->>'model_route',
            coalesce(p->>'data_classification','internal')::public.data_classification)
    returning * into ev;
    return jsonb_build_object('intake_event_id', ev.id, 'status', ev.status);
  end if;

  -- W3.2: open a persisted capture. Consent must be positively confirmed at open.
  if p_operation = 'open_capture' then
    if coalesce((p->>'consent_confirmed')::boolean, false) is not true then
      raise exception 'CONSENT_REQUIRED: a capture opens only after every participant has consented and the opener confirms it';
    end if;
    if length(btrim(coalesce(p->>'purpose',''))) = 0 then raise exception 'PURPOSE_REQUIRED'; end if;
    insert into public.signal_intake_captures (owner_id, purpose, modalities, consent_confirmed)
    values (uid, left(btrim(p->>'purpose'), 500), coalesce(p->'modalities','[]'::jsonb), true)
    returning * into cap;
    return jsonb_build_object('capture_id', cap.id, 'status', cap.status, 'consent_required', true);
  end if;

  -- W3.2: resolve a capture exactly once. Owner-only, state-validated, consent-checked.
  if p_operation in ('complete_capture','abandon_capture') then
    select * into cap from public.signal_intake_captures where id = nullif(p->>'capture_id','')::uuid for update;
    if cap.id is null or cap.owner_id <> uid then raise exception 'NOT_FOUND'; end if;
    if cap.status <> 'open' then
      raise exception 'CAPTURE_ALREADY_RESOLVED: capture % is %; a capture id is single-use', cap.id, cap.status;
    end if;
    if not cap.consent_confirmed then raise exception 'CONSENT_REQUIRED'; end if;
    update public.signal_intake_captures
      set status = case when p_operation = 'complete_capture' then 'completed' else 'abandoned' end,
          resolved_at = now()
      where id = cap.id;
    if p_operation = 'abandon_capture' then
      insert into public.signal_intake_events (origin,status,source_ref,submitted_by,extraction_method,data_classification)
      values ('live_capture','abandoned', cap.id::text, p_actor, 'manual', 'internal')
      returning * into ev;
      return jsonb_build_object('capture_id', cap.id, 'status', 'abandoned', 'intake_event_id', ev.id);
    end if;
    return jsonb_build_object('capture_id', cap.id, 'status', 'completed');
  end if;

  if p_operation in ('record','confirm') then
    cond := btrim(coalesce(p->>'observed_condition',''));
    if length(cond) = 0 then raise exception 'CONDITION_REQUIRED'; end if;
    origin := (p->>'origin')::public.signal_origin;
    select * into dup from public.objects
      where type = 'ValueSignal' and not is_tombstone and lifecycle_state not in ('rejected','expired','merged')
        and public._can_read_as(uid, permission, data_classification)
        and (lower(regexp_replace(coalesce(body->>'observed_condition', statement), '[^a-zA-Z0-9]+', ' ', 'g'))
             = lower(regexp_replace(cond, '[^a-zA-Z0-9]+', ' ', 'g'))
             or search @@ websearch_to_tsquery('english', left(cond, 600)))
      order by created_at limit 1;
    if dup.id is not null then
      insert into public.signal_intake_events (origin,status,source_ref,raw_input_ref,submitted_by,duplicate_of,extraction_method,model_route,data_classification)
      values (origin, 'duplicate', p->>'source_ref', p->>'raw_input_ref', p_actor, dup.id,
              coalesce(p->>'extraction_method','manual'), p->>'model_route',
              coalesce(p->>'data_classification','internal')::public.data_classification)
      returning * into ev;
      return jsonb_build_object('intake_event_id', ev.id, 'status', 'duplicate',
        'existing_signal', jsonb_build_object('id', dup.id, 'human_ref', dup.human_ref, 'title', dup.title, 'lifecycle_state', dup.lifecycle_state));
    end if;
    ev_id := gen_random_uuid();
    o := public.thread_create_object(p_actor, jsonb_build_object(
      'type','ValueSignal',
      'title', left(coalesce(nullif(p->>'title',''), 'Signal: '||left(cond,120)),200),
      'statement', cond,
      'machine_description','ValueSignal recorded through signal intake',
      'body', jsonb_build_object(
        'observed_condition', cond,
        'affected_population', p->>'affected_population',
        'evidence', coalesce(p->'evidence_refs','[]'::jsonb),
        'potential_value', p->>'potential_value',
        'urgency', p->>'urgency',
        'origin_channel', origin::text,
        'source_ref', p->>'source_ref',
        'intake_event_id', ev_id,
        'requested_solution_candidates','[]'::jsonb),
      'owner_id', uid,
      'review_date', (current_date + 90)::text,
      'expiration_condition', '{"kind":"review_date_passes"}',
      'retirement_path', '{"mode":"archive_evidence"}',
      'risk_tier','1',
      'permission', '{"roles":[],"purpose":"ValueSignal (THREAD)"}',
      'data_classification', coalesce(p->>'data_classification','internal'),
      'evidence_refs', coalesce(p->'evidence_refs','[]'::jsonb),
      'rationale','Signal intake through channel '||origin::text));
    insert into public.signal_intake_events (id,origin,status,source_ref,raw_input_ref,submitted_by,signal_id,extraction_method,model_route,data_classification)
    values (ev_id, origin, 'confirmed', p->>'source_ref', p->>'raw_input_ref', p_actor, o.id,
            coalesce(p->>'extraction_method','manual'), p->>'model_route',
            coalesce(p->>'data_classification','internal')::public.data_classification);
    for ref in select x::uuid from jsonb_array_elements_text(coalesce(p->'evidence_refs','[]'::jsonb)) x loop
      if exists(select 1 from public.objects e where e.id = ref and not e.is_tombstone) then
        perform public.thread_create_edge(p_actor, jsonb_build_object('from_id', o.id, 'to_id', ref, 'verb', 'originated_from', 'source', 'stated', 'rationale', 'The evidence that produced this signal'));
      end if;
    end loop;
    perform public.thread_refresh_graph_layout();
    return jsonb_build_object('intake_event_id', ev.id, 'status', 'confirmed',
      'signal', jsonb_build_object('id', o.id, 'human_ref', o.human_ref, 'version', o.version, 'lifecycle_state', o.lifecycle_state));
  end if;

  if p_operation = 'promote' then
    select * into sig from public.objects where id = (p->>'signal_id')::uuid and type = 'ValueSignal' and not is_tombstone for update;
    if sig.id is null or not public._can_read_as(uid, sig.permission, sig.data_classification) then raise exception 'NOT_FOUND'; end if;
    if sig.lifecycle_state not in ('detected','enriched','monitoring') then
      raise exception 'NOT_PROMOTABLE: signal % is %; only detected, enriched or monitoring signals can be promoted', sig.human_ref, sig.lifecycle_state;
    end if;
    if length(btrim(coalesce(p->>'rationale',''))) = 0 then raise exception 'RATIONALE_REQUIRED'; end if;
    -- W3.5(b): promotion authority rests with a steward or the trusted named Co-Creator
    -- on the signal. Ownership alone no longer confers promotion authority. This narrows
    -- a previously chosen behaviour (owner self-promotion) and awaits Carey's confirmation.
    authorized := exists(select 1 from public.user_roles r where r.user_id = uid and r.role = 'steward')
      or sig.body->>'recommended_co_creator' = uid::text;
    if not authorized then
      -- W3.5(a): the suggestion write commits or the whole call fails; nothing is
      -- swallowed and 'suggestion' is never reported for a write that did not happen.
      perform public.thread_revise_object(p_actor, sig.id, sig.version,
        jsonb_build_object('body', sig.body || jsonb_build_object('promotion_suggestions',
          coalesce(sig.body->'promotion_suggestions','[]'::jsonb) || jsonb_build_array(jsonb_build_object('by', p_actor, 'rationale', p->>'rationale', 'at', now())))),
        'Promotion suggestion recorded; the suggester holds no promotion authority over this signal');
      return jsonb_build_object('promoted', false, 'recorded_as', 'suggestion', 'signal_id', sig.id, 'human_ref', sig.human_ref,
        'note', 'Promotion authority rests with the named Co-Creator or the domain authority that owns the affected population; this promotion is recorded as a suggestion and the state is unchanged.');
    end if;
    o := public.thread_transition_object(p_actor, sig.id, sig.version, 'promoted', p->>'rationale');
    d := public.thread_create_object(p_actor, jsonb_build_object(
      'type','ConfirmedDecision',
      'title', left('Promote '||sig.human_ref||' to mission-eligible',200),
      'statement', format('Signal %s promoted: %s', sig.human_ref, p->>'rationale'),
      'machine_description','Promotion decision recorded under stated authority',
      'body', jsonb_build_object('decision', format('Promote signal %s', sig.human_ref), 'decided_by', p_actor,
        'authority_used', p_actor->>'authority_used', 'signal_ref', sig.id, 'context', sig.id, 'alternatives', '["keep monitoring","reject"]',
        'rationale', p->>'rationale', 'reversibility', 'assisted', 'consequences', 'The signal becomes eligible to originate a ValueMission',
        'effective_from', now()),
      'owner_id', uid,
      'review_date', (current_date + 90)::text,
      'expiration_condition', '{"kind":"review_date_passes"}',
      'retirement_path', '{"mode":"archive_evidence"}',
      'risk_tier','1',
      'permission', sig.permission,
      'data_classification', sig.data_classification::text,
      'rationale','Signal promotion decision'));
    perform public.thread_create_edge(p_actor, jsonb_build_object('from_id', d.id, 'to_id', sig.id, 'verb', 'decided_from', 'source', 'stated', 'rationale', 'Promotion recorded as a decision'));
    perform public.thread_refresh_graph_layout();
    return jsonb_build_object('promoted', true, 'signal_id', o.id, 'human_ref', o.human_ref, 'lifecycle_state', o.lifecycle_state, 'decision_id', d.id, 'decision_ref', d.human_ref);
  end if;

  if p_operation = 'link' then
    select * into sig from public.objects where id = (p->>'signal_id')::uuid and type = 'ValueSignal' and not is_tombstone;
    select * into m from public.objects where id = (p->>'mission_id')::uuid and type = 'ValueMission' and not is_tombstone;
    if sig.id is null or m.id is null then raise exception 'NOT_FOUND'; end if;
    if not public._can_read_as(uid, sig.permission, sig.data_classification) or not public._can_read_as(uid, m.permission, m.data_classification) then raise exception 'NOT_FOUND'; end if;
    perform public.thread_create_edge(p_actor, jsonb_build_object('from_id', sig.id, 'to_id', m.id, 'verb', 'signals', 'source', 'stated', 'rationale', p->>'rationale'));
    return jsonb_build_object('linked', true, 'signal_id', sig.id, 'mission_id', m.id);
  end if;

  raise exception 'UNKNOWN_OPERATION';
end $$;
revoke all on function public.thread_signal_intake(jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.thread_signal_intake(jsonb,text,jsonb) to service_role;

do $$
declare def text := pg_get_functiondef('public.thread_signal_intake(jsonb,text,jsonb)'::regprocedure);
begin
  if position('_can_read_as(uid, permission, data_classification)' in def) = 0 then
    raise exception 'DUPLICATE_LOOKUP_UNSCOPED: thread_signal_intake duplicate lookup lost its read-permission predicate';
  end if;
  if position('exception when others' in lower(def)) > 0 then
    raise exception 'SUGGESTION_SWALLOWED: a promotion suggestion write must commit or fail; swallowed errors are forbidden (W3.5a)';
  end if;
  if position('sig.owner_id = uid' in def) > 0 then
    raise exception 'OWNER_SELF_PROMOTION: ownership alone must not confer promotion authority (W3.5b)';
  end if;
end $$;
create or replace function public.thread_signal_intake(p_actor jsonb, p_operation text, p jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  uid uuid; ev_id uuid; ev public.signal_intake_events; sig public.objects; o public.objects;
  dup public.objects; m public.objects; d public.objects; cond text; origin public.signal_origin;
  ref uuid; authorized boolean;
begin
  perform public._assert_actor(p_actor);
  uid := (p_actor->>'id')::uuid;
  if not public._is_current_member(uid) then raise exception 'MEMBER_REQUIRED'; end if;

  if p_operation = 'record_event' then
    if coalesce(p->>'status','') not in ('received','rejected','extracted') then
      raise exception 'EVENT_STATUS: confirmed/duplicate events are written only by the record, confirm and dedupe paths';
    end if;
    insert into public.signal_intake_events (origin,status,source_ref,raw_input_ref,submitted_by,extraction_method,model_route,data_classification)
    values ((p->>'origin')::public.signal_origin, (p->>'status')::public.intake_status, p->>'source_ref', p->>'raw_input_ref',
            p_actor, coalesce(p->>'extraction_method','manual'), p->>'model_route',
            coalesce(p->>'data_classification','internal')::public.data_classification)
    returning * into ev;
    return jsonb_build_object('intake_event_id', ev.id, 'status', ev.status);
  end if;

  if p_operation in ('record','confirm') then
    cond := btrim(coalesce(p->>'observed_condition',''));
    if length(cond) = 0 then raise exception 'CONDITION_REQUIRED'; end if;
    origin := (p->>'origin')::public.signal_origin;
    select * into dup from public.objects
      where type = 'ValueSignal' and not is_tombstone and lifecycle_state not in ('rejected','expired','merged')
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
    return jsonb_build_object('intake_event_id', ev_id, 'status', 'confirmed',
      'signal', jsonb_build_object('id', o.id, 'human_ref', o.human_ref, 'version', o.version, 'lifecycle_state', o.lifecycle_state));
  end if;

  if p_operation = 'promote' then
    select * into sig from public.objects where id = (p->>'signal_id')::uuid and type = 'ValueSignal' and not is_tombstone for update;
    if sig.id is null or not public._can_read_as(uid, sig.permission, sig.data_classification) then raise exception 'NOT_FOUND'; end if;
    if sig.lifecycle_state not in ('detected','enriched','monitoring') then
      raise exception 'NOT_PROMOTABLE: signal % is %; only detected, enriched or monitoring signals can be promoted', sig.human_ref, sig.lifecycle_state;
    end if;
    if length(btrim(coalesce(p->>'rationale',''))) = 0 then raise exception 'RATIONALE_REQUIRED'; end if;
    authorized := exists(select 1 from public.user_roles r where r.user_id = uid and r.role = 'steward')
      or sig.owner_id = uid
      or sig.body->>'recommended_co_creator' = uid::text;
    if not authorized then
      begin
        perform public.thread_revise_object(p_actor, sig.id, sig.version,
          jsonb_build_object('body', sig.body || jsonb_build_object('promotion_suggestions',
            coalesce(sig.body->'promotion_suggestions','[]'::jsonb) || jsonb_build_array(jsonb_build_object('by', p_actor, 'rationale', p->>'rationale', 'at', now())))),
          'Promotion suggestion recorded; the suggester holds no promotion authority over this signal');
      exception when others then null;
      end;
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
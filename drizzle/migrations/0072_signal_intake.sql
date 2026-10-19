create type public.signal_origin as enum ('agent_sensor','human_expertise','artifact_upload','live_capture');
create type public.intake_status as enum ('received','extracted','confirmed','rejected','duplicate');

create table public.signal_intake_events (
  id uuid primary key default gen_random_uuid(),
  origin public.signal_origin not null,
  status public.intake_status not null default 'received',
  source_ref text,
  raw_input_ref text,
  submitted_by jsonb not null,
  signal_id uuid references public.objects(id),
  duplicate_of uuid references public.objects(id),
  extraction_method text not null,
  model_route text,
  data_classification public.data_classification not null default 'internal',
  created_at timestamptz not null default now(),
  constraint intake_signal_required check (status <> 'confirmed' or signal_id is not null),
  constraint rejected_has_no_signal check (status <> 'rejected' or signal_id is null)
);
comment on table public.signal_intake_events is 'L-22/S-09: every attempt to introduce a signal, including rejected, quarantined and duplicate ones. Append-only audit trail; not a queue, no approval state.';
create index signal_intake_signal_idx on public.signal_intake_events (signal_id);
create index signal_intake_origin_status_idx on public.signal_intake_events (origin, status);
create index signal_intake_duplicate_idx on public.signal_intake_events (duplicate_of) where duplicate_of is not null;

grant select on public.signal_intake_events to authenticated;
grant all on public.signal_intake_events to service_role;
alter table public.signal_intake_events enable row level security;
create policy intake_read on public.signal_intake_events for select to authenticated using (public._is_current_member(auth.uid()));

create or replace function public.signal_intake_append_only() returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'APPEND_ONLY: intake events are the audit trail of the front door and never change';
end $$;
create trigger signal_intake_append_only before update or delete on public.signal_intake_events for each row execute function public.signal_intake_append_only();
create trigger signal_intake_no_truncate before truncate on public.signal_intake_events for each statement execute function public.reject_mutation();

update public.object_type_registry
set body_schema = jsonb_set(body_schema, '{properties}', coalesce(body_schema->'properties','{}'::jsonb) || jsonb_build_object(
  'origin_channel', jsonb_build_object('type','string','enum', to_jsonb(array['agent_sensor','human_expertise','artifact_upload','live_capture'])),
  'source_ref', jsonb_build_object('type','string'),
  'intake_event_id', jsonb_build_object('type','string','format','uuid')), true)
where type = 'ValueSignal';

with raw(verb,sig,directed,impact,computed,acyclic,ord) as (values
  ('originated_from','ValueSignal>Evidence',true,'none',false,false,1),
  ('duplicates','ValueSignal>ValueSignal',true,'none',false,false,2)),
sigs as (select verb, ord, split_part(sig,'>',1) f, split_part(sig,'>',2) t from raw),
exp as (select s.verb, s.ord,
  (select array_agg(distinct g order by g) from unnest(string_to_array(s.f,'|')) p, unnest(public._expand_type_group(p)) g) ff,
  (select array_agg(distinct g order by g) from unnest(string_to_array(s.t,'|')) p, unnest(public._expand_type_group(p)) g) tt
  from sigs s)
insert into public.relationship_verbs (verb, from_types, to_types, directed, signatures, impact, computed, acyclic)
select r.verb,
  (select array_agg(distinct x order by x) from exp e, unnest(e.ff) x where e.verb = r.verb),
  (select array_agg(distinct x order by x) from exp e, unnest(e.tt) x where e.verb = r.verb),
  r.directed,
  (select jsonb_agg(jsonb_build_object('from', to_jsonb(e.ff), 'to', to_jsonb(e.tt)) order by e.ord) from exp e where e.verb = r.verb),
  r.impact, r.computed, r.acyclic
from raw r
on conflict (verb) do update set from_types = excluded.from_types, to_types = excluded.to_types, directed = excluded.directed,
  signatures = excluded.signatures, impact = excluded.impact, computed = excluded.computed, acyclic = excluded.acyclic;

create or replace function public.mission_signal_gate() returns trigger language plpgsql set search_path=public as $$
declare s public.objects;
begin
  if NEW.type <> 'ValueMission' then return NEW; end if;
  select * into s from public.objects
    where id = nullif(NEW.body->>'signal_ref','')::uuid and type = 'ValueSignal' and not is_tombstone;
  if s.id is null then
    raise exception 'MISSION_SIGNAL_REQUIRED: a mission exists only to change the condition a promoted signal names';
  end if;
  if s.lifecycle_state <> 'promoted' then
    raise exception 'MISSION_SIGNAL_NOT_PROMOTED: only a promoted signal can originate a mission (SI-1); signal % is %', s.human_ref, s.lifecycle_state;
  end if;
  return NEW;
end $$;
create trigger mission_signal_gate before insert on public.objects for each row execute function public.mission_signal_gate();

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
        'authority_used', p_actor->>'authority_used', 'context', sig.id, 'alternatives', '["keep monitoring","reject"]',
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
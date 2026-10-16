-- Phase 3: authority, guardrails and decisions (Part 6)

-- 6.6 advisory and enforcing guardrails are distinct fields
alter table public.guardrails add column if not exists enforcement text not null default 'enforcing';
alter table public.guardrails add constraint guardrails_enforcement_check check (enforcement in ('advisory','enforcing'));
alter table public.guardrails add column if not exists proposed_by text not null default 'human';
alter table public.guardrails add constraint guardrails_proposed_by_check check (proposed_by in ('human','llm'));
comment on column public.guardrails.proposed_by is 'An LLM may propose a guardrail; only a deterministic evaluator enforces one (6.6)';

-- authority changes are tied to their transaction and trigger
alter table public.authority_history add column if not exists txid bigint not null default txid_current();
alter table public.authority_history add column if not exists trigger text;

-- 6.1 risk assessments: stored with inputs, recomputable, never overridden downward
create table public.risk_assessments (
  id uuid primary key default public.uuid_v7(),
  object_id uuid not null references public.objects(id),
  inputs jsonb not null,
  computed_tier public.risk_tier not null,
  override_tier public.risk_tier,
  override_rationale text,
  treatment text not null,
  reasons jsonb not null default '[]',
  computed_by text not null,
  computed_at timestamptz not null default now(),
  constraint risk_override_upward_only check (override_tier is null or (override_tier > computed_tier and coalesce(btrim(override_rationale), '') <> ''))
);
grant select on public.risk_assessments to authenticated;
grant all on public.risk_assessments to service_role;
alter table public.risk_assessments enable row level security;
create policy "read risk assessments" on public.risk_assessments for select to authenticated
  using (exists (select 1 from public.objects o where o.id = risk_assessments.object_id));
create trigger risk_assessments_append_only before update or delete on public.risk_assessments for each row execute function public.reject_mutation();

-- 6.2 demotion target (mirrors src/server/authority/engine.ts `demote`)
create or replace function public._demotion_target(_from public.authority_level, _trigger text)
returns public.authority_level language sql immutable set search_path = public as $$
  select case
    when _trigger in ('policy_or_guardrail_changed','capability_version_changed_materially','model_route_or_version_changed',
                      'authority_effective_to_lapsed','steward_unassigned','critical_or_repeated_incident') then 'observe'::public.authority_level
    when _trigger in ('discrepancy_rate_exceeded','data_distribution_shift','value_review_underperformance') then
      (array['observe','observe','recommend','act_with_confirmation','act_bounded']::public.authority_level[])[
        array_position(array['observe','recommend','act_with_confirmation','act_bounded','autonomous_with_exception']::public.authority_level[], _from)]
    else null end
$$;

-- Every authority change is a new version with a ledger entry and an authority_history row in the same transaction.
create or replace function public.thread_set_authority(p_actor jsonb, p_id uuid, p_to public.authority_level, p_cause text,
  p_trigger text, p_evidence uuid[], p_conditions jsonb default '{}')
returns public.objects language plpgsql security definer set search_path = public as $$
declare o public.objects; n public.objects; sim int;
begin
  perform public._assert_actor(p_actor);
  select * into o from public.objects where id = p_id for update;
  if o.id is null then raise exception 'NOT_FOUND: %', p_id; end if;
  if o.is_tombstone then raise exception 'TOMBSTONED: %', o.human_ref; end if;
  if o.authority_level = p_to then return o; end if;
  if p_cause in ('promotion','grant') then
    if p_to < o.authority_level then raise exception 'NOT_A_PROMOTION'; end if;
    if coalesce(array_length(p_evidence, 1), 0) = 0 then raise exception 'EVIDENCE_REQUIRED: promotion needs evidence (6.2)'; end if;
    select count(*) into sim from public.objects e where e.id = any(p_evidence)
      and (coalesce(e.body->'provenance'->>'simulated','false') = 'true' or e.body->>'adapter_mode' = 'simulated');
    if sim > 0 then raise exception 'SIMULATED_EVIDENCE_DOES_NOT_PROMOTE: only non-simulated evidence counts'; end if;
    if p_to >= 'act_bounded' and o.risk_tier = '4' and not (coalesce(p_conditions->>'kill_switch_armed','') = 'true'
        and coalesce(p_conditions->>'continuous_monitoring','') = 'true' and coalesce(p_conditions->>'independent_human_judgment_ref','') <> '') then
      raise exception 'TIER4_AUTONOMY_PROHIBITED: Tier 4 needs independent human judgment, continuous monitoring and an armed kill switch (6.2)';
    end if;
    if p_to = 'autonomous_with_exception' and coalesce(p_conditions->>'explicit_human_grant_ref','') = '' then
      raise exception 'EXPLICIT_HUMAN_GRANT_REQUIRED (6.2)';
    end if;
  elsif p_cause in ('demotion','withdrawal') then
    if p_to > o.authority_level then raise exception 'NOT_A_DEMOTION'; end if;
  else raise exception 'BAD_CAUSE: %', p_cause; end if;
  insert into public.authority_history (object_id, from_level, to_level, cause, trigger, trigger_ref, evidence_refs)
  values (o.id, o.authority_level, p_to, p_cause, p_trigger, nullif(p_conditions->>'trigger_ref','')::uuid, coalesce(p_evidence, '{}'));
  n := o; n.version := o.version + 1; n.updated_by := p_actor; n.content_hash := public.object_content_hash(n);
  perform public._ledger_write(n.provenance_chain_id, p_actor, 'authority.' || p_cause, n,
    jsonb_build_object('from', o.authority_level, 'to', p_to, 'trigger', p_trigger, 'conditions', p_conditions));
  update public.objects set version = n.version, updated_by = n.updated_by, authority_level = p_to where id = o.id returning * into n;
  return n;
end $$;

-- Demotion events (6.2): no human action, no evidence needed to reduce authority.
create or replace function public.thread_authority_event(p_actor jsonb, p_id uuid, p_trigger text, p_evidence uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.objects; t public.authority_level;
begin
  select * into o from public.objects where id = p_id;
  if o.id is null then raise exception 'NOT_FOUND: %', p_id; end if;
  t := public._demotion_target(o.authority_level, p_trigger);
  if t is null then raise exception 'UNKNOWN_TRIGGER: %', p_trigger; end if;
  if t = o.authority_level then return jsonb_build_object('changed', false, 'level', t); end if;
  perform public.thread_set_authority(p_actor, p_id, t, 'demotion', p_trigger, p_evidence);
  return jsonb_build_object('changed', true, 'from', o.authority_level, 'to', t, 'trigger', p_trigger);
end $$;

-- In-row automatic demotions and the authority-change guard
create or replace function public.authority_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.is_tombstone then return NEW; end if;
  if NEW.authority_level > 'observe' and OLD.steward_id is not null and NEW.steward_id is null then
    insert into public.authority_history (object_id, from_level, to_level, cause, trigger, evidence_refs)
    values (NEW.id, NEW.authority_level, 'observe', 'demotion', 'steward_unassigned', '{}');
    NEW.authority_level := 'observe';
  end if;
  if NEW.authority_level > 'observe' and exists (select 1 from public.object_type_registry r where r.type = NEW.type and r.family = 'Capability')
     and (NEW.statement, NEW.body, NEW.machine_description) is distinct from (OLD.statement, OLD.body, OLD.machine_description) then
    insert into public.authority_history (object_id, from_level, to_level, cause, trigger, evidence_refs)
    values (NEW.id, NEW.authority_level, 'observe', 'demotion', 'capability_version_changed_materially', '{}');
    NEW.authority_level := 'observe';
  end if;
  if NEW.authority_level <> OLD.authority_level and not exists (
     select 1 from public.authority_history h where h.object_id = NEW.id and h.txid = txid_current() and h.to_level = NEW.authority_level) then
    raise exception 'AUTHORITY_PATH_REQUIRED: authority changes only through the authority engine (6.2)';
  end if;
  return NEW;
end $$;
create trigger a3_authority_guard before update on public.objects for each row execute function public.authority_guard();

-- Model route or model version change demotes everything bound to that route
create or replace function public.model_route_change() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if NEW.type = 'ModelRoute' and (NEW.body->>'model_version_pin', NEW.body->>'endpoint', NEW.body->>'provider')
       is distinct from (OLD.body->>'model_version_pin', OLD.body->>'endpoint', OLD.body->>'provider') then
    for r in select id from public.objects where body->>'model_route_ref' = NEW.id::text and authority_level > 'observe' and not is_tombstone loop
      perform public.thread_authority_event(NEW.updated_by, r.id, 'model_route_or_version_changed', array[NEW.id]);
    end loop;
  end if;
  return null;
end $$;
create trigger d_model_route_change after update on public.objects for each row execute function public.model_route_change();

-- Policy or guardrail change demotes every object above observe
create or replace function public.guardrail_change() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; sys jsonb;
begin
  sys := jsonb_build_object('kind','system','id', coalesce((select user_id::text from public.user_roles where role = 'steward' limit 1), '00000000-0000-0000-0000-000000000000'),
                            'authority_used','observe', 'engine', 'guardrail_change');
  for r in select id from public.objects where authority_level > 'observe' and not is_tombstone loop
    perform public.thread_authority_event(sys, r.id, 'policy_or_guardrail_changed', '{}');
  end loop;
  return null;
end $$;
create trigger guardrails_change after insert or update on public.guardrails for each statement execute function public.guardrail_change();

-- 6.5 Human Decision Queue: exact fields; four responses; one clarification
create or replace function public.decision_queue_guard() returns trigger language plpgsql set search_path = public as $$
declare req public.objects; want text[] := array['affected_parties','ai_recommendation','cost_of_waiting','current_authority_boundary',
  'current_evidence_and_confidence','deadline','exact_decision_required','proposed_next_machine_action','reason_ai_cannot_safely_decide',
  'reversibility','viable_alternatives']; got text[];
begin
  if NEW.type = 'HumanDecisionRequest' then
    select array_agg(k order by k) into got from jsonb_object_keys(NEW.body) k;
    if got is distinct from want then
      raise exception 'HDR_EXACT_FIELDS: a decision request contains exactly the Part 6.5 fields and nothing more';
    end if;
    if jsonb_typeof(NEW.body->'viable_alternatives') <> 'array' or jsonb_array_length(NEW.body->'viable_alternatives') = 0 then
      raise exception 'HDR_ALTERNATIVES_REQUIRED: viable_alternatives is a non-empty list';
    end if;
  elsif NEW.type = 'Decision' and TG_OP = 'INSERT' then
    select * into req from public.objects where id = (NEW.body->>'request_ref')::uuid;
    if req.id is null or req.type <> 'HumanDecisionRequest' then raise exception 'DECISION_REQUEST_REQUIRED: request_ref must be a HumanDecisionRequest'; end if;
    if coalesce(NEW.body->>'response','') not in ('decide','request_clarification','reduce_authority','stop_mission') then
      raise exception 'DECISION_RESPONSE_INVALID: decide, request_clarification, reduce_authority or stop_mission';
    end if;
    if exists (select 1 from public.objects d where d.type = 'Decision' and d.body->>'request_ref' = req.id::text and d.body->>'response' <> 'request_clarification' and not d.is_tombstone) then
      raise exception 'DECISION_ALREADY_RECORDED: % is already decided', req.human_ref;
    end if;
    if NEW.body->>'response' = 'request_clarification' and exists (select 1 from public.objects d where d.type = 'Decision'
         and d.body->>'request_ref' = req.id::text and d.body->>'response' = 'request_clarification' and not d.is_tombstone) then
      raise exception 'ONE_CLARIFICATION_ONLY: a human may request one clarification (6.5)';
    end if;
  end if;
  return NEW;
end $$;
create trigger a4_decision_queue_guard before insert or update on public.objects for each row execute function public.decision_queue_guard();

-- Risk assessment recording (6.1)
create or replace function public.thread_record_risk(p_actor jsonb, p_id uuid, p jsonb)
returns public.risk_assessments language plpgsql security definer set search_path = public as $$
declare r public.risk_assessments;
begin
  perform public._assert_actor(p_actor);
  insert into public.risk_assessments (object_id, inputs, computed_tier, override_tier, override_rationale, treatment, reasons, computed_by)
  values (p_id, p->'inputs', (p->>'computed_tier')::public.risk_tier, nullif(p->>'override_tier','')::public.risk_tier, p->>'override_rationale',
          p->>'treatment', coalesce(p->'reasons','[]'), p->>'computed_by') returning * into r;
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  select o.provenance_chain_id, p_actor, 'observe', 'risk.assessed', o.id, o.version, '{}', 'none',
         jsonb_build_object('risk_assessment_id', r.id, 'computed_tier', r.computed_tier, 'override_tier', r.override_tier), '', 'pending-' || public.uuid_v7()::text
  from public.objects o where o.id = p_id;
  return r;
end $$;

-- Lapsed AuthorityGrants demote their subject (sweep; also callable after writes)
create or replace function public.thread_authority_sweep(p_actor jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare g record; n int := 0; res jsonb;
begin
  for g in select o.id, (o.body->>'subject_ref')::uuid subj from public.objects o
           where o.type = 'AuthorityGrant' and not o.is_tombstone and o.lifecycle_state = 'recorded'
             and (o.body->>'effective_to') is not null and (o.body->>'effective_to')::timestamptz < now() loop
    if exists (select 1 from public.objects s where s.id = g.subj and s.authority_level > 'observe' and not s.is_tombstone) then
      res := public.thread_authority_event(p_actor, g.subj, 'authority_effective_to_lapsed', array[g.id]); n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('lapsed_demotions', n);
end $$;

revoke execute on function public.thread_set_authority(jsonb, uuid, public.authority_level, text, text, uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.thread_authority_event(jsonb, uuid, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.thread_record_risk(jsonb, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_authority_sweep(jsonb) from public, anon, authenticated;
grant execute on function public.thread_set_authority(jsonb, uuid, public.authority_level, text, text, uuid[], jsonb) to service_role;
grant execute on function public.thread_authority_event(jsonb, uuid, text, uuid[]) to service_role;
grant execute on function public.thread_record_risk(jsonb, uuid, jsonb) to service_role;
grant execute on function public.thread_authority_sweep(jsonb) to service_role;

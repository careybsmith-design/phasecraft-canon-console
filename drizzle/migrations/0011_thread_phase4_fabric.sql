-- Phase 4: Capability Fabric (Part 7)

-- 7.4 ReuseCheck exactly as the Layer B schema: decision reuse_as_is|compose_existing|create_new.
-- The Section 18 values stay accepted for compatibility (no rows use them yet).
alter table public.reuse_checks drop constraint reuse_checks_decision_check;
alter table public.reuse_checks add constraint reuse_checks_decision_check
  check (decision in ('reuse_as_is','compose_existing','create_new','reuse','compose','extend','create_new_no_match'));
alter table public.reuse_checks add column if not exists behavior_statement_id uuid references public.objects(id);
comment on column public.reuse_checks.checked_by is 'searched_by (Part 7.4)';

create or replace function public.reuse_checks_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(btrim(NEW.rationale), '') = '' then raise exception 'RATIONALE_REQUIRED: a reuse check records a human or agent rationale (7.4)'; end if;
  if NEW.intent_shape ?& array['outcome','inputs','outputs','domain'] is not true then
    raise exception 'INTENT_SHAPE_REQUIRED: intent_shape is {outcome, inputs, outputs, domain}';
  end if;
  if NEW.decision in ('create_new','create_new_no_match') and exists (
       select 1 from jsonb_array_elements(NEW.results) r where jsonb_array_length(coalesce(r->'gaps','[]')) = 0) then
    raise exception 'CREATE_NEW_BLOCKED: create_new needs no results, or recorded gaps on every result (7.4)';
  end if;
  if NEW.decision in ('reuse_as_is','compose_existing') and jsonb_array_length(NEW.results) = 0 then
    raise exception 'NOTHING_TO_REUSE: reuse or compose needs at least one result';
  end if;
  return NEW;
end $$;
create trigger a_reuse_checks_guard before insert on public.reuse_checks for each row execute function public.reuse_checks_guard();
create trigger reuse_checks_append_only before update or delete on public.reuse_checks for each row execute function public.reject_mutation();

-- 7.4 hard block: a prompt's reuse check must be about one of its source behaviour statements and must allow creation
create or replace function public.creation_reuse_gate() returns trigger language plpgsql set search_path = public as $$
declare rc public.reuse_checks;
begin
  select * into rc from public.reuse_checks where id = NEW.reuse_check_id;
  if rc.id is null then raise exception 'REUSE_CHECK_REQUIRED: no creation may begin until the fabric has been searched and the result recorded (P11)'; end if;
  if rc.behavior_statement_id is null or not (rc.behavior_statement_id = any(NEW.source_behavior_ids)) then
    raise exception 'REUSE_CHECK_NOT_LINKED: the reuse check must be linked to the originating Behaviour Statement (7.4)';
  end if;
  if rc.decision in ('reuse_as_is','reuse') then
    raise exception 'REUSE_DECIDED: the reuse check decided to reuse an existing capability, so nothing is created';
  end if;
  return NEW;
end $$;
create trigger b_creation_reuse_gate before insert or update on public.creation_prompts for each row execute function public.creation_reuse_gate();

-- CreationPrompt and BuildRun objects cannot exist without a recorded reuse check either
create or replace function public.creation_object_gate() returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.type in ('CreationPrompt','BuildRun') and TG_OP = 'INSERT' then
    if not exists (select 1 from public.reuse_checks r where r.id::text = NEW.body->>'reuse_check_ref' and r.decision not in ('reuse_as_is','reuse')) then
      raise exception 'REUSE_CHECK_REQUIRED: % cannot be created without a recorded reuse check that allows creation (P11)', NEW.type;
    end if;
  end if;
  return NEW;
end $$;
create trigger a5_creation_object_gate before insert on public.objects for each row execute function public.creation_object_gate();

-- 7.6 usage, cost and outcome telemetry per capability
create table public.capability_usage (
  id bigserial primary key,
  capability_id uuid not null references public.objects(id),
  consumer text not null,
  outcome text not null check (outcome in ('success','failure','refused','escalated')),
  cost numeric not null default 0 check (cost >= 0),
  latency_ms integer,
  composition_id uuid references public.objects(id),
  adapter_mode text not null default 'simulated' check (adapter_mode in ('simulated','live')),
  at timestamptz not null default now()
);
create index capability_usage_cap_at on public.capability_usage (capability_id, at desc);
grant select on public.capability_usage to authenticated;
grant all on public.capability_usage to service_role;
grant usage, select on sequence public.capability_usage_id_seq to service_role;
alter table public.capability_usage enable row level security;
create policy "read capability usage" on public.capability_usage for select to authenticated
  using (exists (select 1 from public.objects o where o.id = capability_usage.capability_id));
create trigger capability_usage_append_only before update or delete on public.capability_usage for each row execute function public.reject_mutation();

-- Prohibited (6.7): a capability is not published (discoverable) without an implements edge to a CapabilityContract
create or replace function public.capability_publish_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.type = 'ComposableCapability' and not NEW.is_tombstone and coalesce(NEW.body->>'is_machine_discoverable','false') = 'true'
     and NEW.lifecycle_state <> 'retired'
     and not exists (select 1 from public.edges e join public.objects c on c.id = e.to_id
                     where e.from_id = NEW.id and e.verb = 'implements' and e.retired_at is null and c.type = 'CapabilityContract' and not c.is_tombstone) then
    raise exception 'CONTRACT_REQUIRED: a Composable Capability cannot be published to the fabric without a Capability Contract (6.7)';
  end if;
  return NEW;
end $$;
create trigger a6_capability_publish_guard before insert or update on public.objects for each row execute function public.capability_publish_guard();

create or replace function public._capability_gaps(_body jsonb) returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(k), '{}') from unnest(array['business_outcome','plain_language_purpose','intended_consumers','input_schema','output_schema',
    'preconditions','dependencies','business_rules','exceptions','data_classifications','permitted_uses','policy_constraints',
    'security_privacy_accessibility_constraints','confidence_requirements','explainability_audit_behaviour','failure_modes','recovery_behaviour',
    'human_intervention_conditions','test_simulation_evaluation_refs','service_levels','cost_resource_telemetry_ref','version','compatibility',
    'owner_and_stewardship','minimum_use_threshold','retirement_condition','value_hypothesis','operating_cost_ceiling','performance_thresholds','risk_thresholds']) k
  where _body->k is null or _body->k = 'null'::jsonb or _body->k = '""'::jsonb or _body->k = '{}'::jsonb
$$;

-- Publish: contract present, every 7.2/7.6 field present, implements edge, proposed -> skeleton, discoverable
create or replace function public.thread_publish_capability(p_actor jsonb, p_id uuid, p_contract_id uuid)
returns public.objects language plpgsql security definer set search_path = public as $$
declare o public.objects; k public.objects; gaps text[];
begin
  o := public._load_for_write(p_actor, p_id, (select version from public.objects where id = p_id));
  if o.type <> 'ComposableCapability' then raise exception 'NOT_A_CAPABILITY: %', o.human_ref; end if;
  select * into k from public.objects where id = p_contract_id;
  if k.id is null or k.type <> 'CapabilityContract' or k.is_tombstone then raise exception 'CONTRACT_REQUIRED: a CapabilityContract must exist (6.7)'; end if;
  gaps := public._capability_gaps(o.body);
  if cardinality(gaps) > 0 then raise exception 'CONTRACT_INCOMPLETE: missing %', array_to_string(gaps, ', '); end if;
  if o.owner_id is null or o.expiration_condition is null or o.retirement_path is null then
    raise exception 'LIFECYCLE_INCOMPLETE: owner, expiration condition and retirement path are required (7.6)';
  end if;
  if not exists (select 1 from public.edges e where e.from_id = o.id and e.to_id = k.id and e.verb = 'implements' and e.retired_at is null) then
    perform public.thread_create_edge(p_actor, jsonb_build_object('verb','implements','from_id',o.id,'to_id',k.id,'source','stated',
      'rationale','published to the Capability Fabric with this contract'));
  end if;
  o.body := o.body || jsonb_build_object('is_machine_discoverable', true, 'contract_ref', k.id, 'published_at', now());
  if o.lifecycle_state = 'proposed' then o.lifecycle_state := 'skeleton'; end if;
  o.version := o.version + 1;
  return public._thread_apply(p_actor, o, 'capability.publish', jsonb_build_object('contract_ref', k.id));
end $$;

-- 7.4 discovery: full text + trigram + contract-shape match, run as the caller so permissions apply
create or replace function public.fabric_search(p_outcome text, p_inputs text[], p_outputs text[], p_domain text, p_limit int default 10)
returns jsonb language sql stable set search_path = public as $$
  with q as (select trim(coalesce(p_outcome,'') || ' ' || coalesce(p_domain,'')) t),
  c as (
    select o.id, o.human_ref, o.title, o.statement, o.lifecycle_state, o.authority_level, o.risk_tier, o.body,
      coalesce(array(select lower(trim(x)) from jsonb_array_elements_text(case when jsonb_typeof(o.body->'input_schema'->'fields') = 'array' then o.body->'input_schema'->'fields' else '[]' end) x), '{}') ins,
      coalesce(array(select lower(trim(x)) from jsonb_array_elements_text(case when jsonb_typeof(o.body->'output_schema'->'fields') = 'array' then o.body->'output_schema'->'fields' else '[]' end) x), '{}') outs,
      greatest(similarity(o.title || ' ' || o.statement || ' ' || coalesce(o.body->>'business_outcome',''), (select t from q)),
               word_similarity((select t from q), o.title || ' ' || o.statement || ' ' || coalesce(o.body->>'business_outcome','') || ' ' || coalesce(o.machine_description,'')),
               case when o.search @@ websearch_to_tsquery('english', (select t from q)) then 0.5 else 0 end) text_score
    from public.objects o
    where o.type = 'ComposableCapability' and not o.is_tombstone and o.lifecycle_state not in ('proposed','retired')
      and coalesce(o.body->>'is_machine_discoverable','false') = 'true'
  ),
  s as (
    select c.*,
      (select array_agg('missing input ' || x) from unnest(p_inputs) x where lower(trim(x)) <> all(c.ins)) gi,
      (select array_agg('missing output ' || x) from unnest(p_outputs) x where lower(trim(x)) <> all(c.outs)) go,
      case when coalesce(cardinality(p_inputs),0) + coalesce(cardinality(p_outputs),0) = 0 then 0 else
        ((select count(*) from unnest(p_inputs) x where lower(trim(x)) = any(c.ins)) + (select count(*) from unnest(p_outputs) x where lower(trim(x)) = any(c.outs)))::numeric
        / (coalesce(cardinality(p_inputs),0) + coalesce(cardinality(p_outputs),0)) end shape
    from c
  )
  select coalesce(jsonb_agg(r order by r.match_score desc), '[]') from (
    select s.id capability_id, s.human_ref, s.title, s.statement, s.lifecycle_state, s.authority_level, s.risk_tier,
      round((0.6 * s.text_score + 0.4 * s.shape)::numeric, 3) match_score,
      to_jsonb(coalesce(s.gi, '{}') || coalesce(s.go, '{}')) gaps,
      case when cardinality(coalesce(s.gi,'{}') || coalesce(s.go,'{}')) = 0 and (0.6 * s.text_score + 0.4 * s.shape) >= 0.5 then 'use_as_is'
           when (0.6 * s.text_score + 0.4 * s.shape) >= 0.35 then 'compose' else 'extend' end reuse_mode
    from s where (0.6 * s.text_score + 0.4 * s.shape) >= 0.15
    order by 0.6 * s.text_score + 0.4 * s.shape desc limit p_limit
  ) r
$$;
grant execute on function public.fabric_search(text, text[], text[], text, int) to authenticated, service_role;

-- 7.5 composition: a WorkingCapability composing parts; effective authority = minimum of the parts, computed live
create or replace function public.composition_effective_authority(p_id uuid) returns public.authority_level
language sql stable set search_path = public as $$
  select min(o.authority_level) from public.edges e join public.objects o on o.id = e.to_id
  where e.from_id = p_id and e.verb = 'composes' and e.retired_at is null
$$;
grant execute on function public.composition_effective_authority(uuid) to authenticated, service_role;

create or replace function public.thread_compose_capabilities(p_actor jsonb, p_ids uuid[], p_title text, p_scenario text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare w public.objects; i uuid; bad text; eff public.authority_level;
begin
  perform public._assert_actor(p_actor);
  if coalesce(cardinality(p_ids), 0) < 2 then raise exception 'COMPOSITION_NEEDS_PARTS: compose two or more capabilities'; end if;
  select string_agg(o.human_ref || ' (' || o.lifecycle_state || ')', ', ') into bad from public.objects o
  where o.id = any(p_ids) and (o.type <> 'ComposableCapability' or o.is_tombstone or o.lifecycle_state in ('proposed','retired')
        or coalesce(o.body->>'is_machine_discoverable','false') <> 'true');
  if bad is not null then raise exception 'NOT_PUBLISHED: only published capabilities compose: %', bad; end if;
  w := public.thread_create_object(p_actor, jsonb_build_object('type','WorkingCapability','title',p_title,'statement',coalesce(p_scenario,p_title),
    'machine_description','Composition of published capabilities; effective authority is the minimum of its parts (7.5)',
    'body', jsonb_build_object('capability_refs', to_jsonb(p_ids), 'scenario', p_scenario),
    'review_date', (current_date + 90)::text, 'expiration_condition', jsonb_build_object('kind','review_date_passes'),
    'retirement_path', jsonb_build_object('mode','tombstone'), 'risk_tier', (select max(risk_tier)::text from public.objects where id = any(p_ids)),
    'permission', jsonb_build_object('roles','[]'::jsonb,'purpose','capability composition'), 'data_classification',
    (select max(data_classification)::text from public.objects where id = any(p_ids)), 'rationale', 'compose capabilities (7.5)'));
  foreach i in array p_ids loop
    perform public.thread_create_edge(p_actor, jsonb_build_object('verb','composes','from_id',w.id,'to_id',i,'source','stated','rationale','part of the composition'));
  end loop;
  eff := public.composition_effective_authority(w.id);
  return jsonb_build_object('composition_id', w.id, 'human_ref', w.human_ref, 'effective_authority', eff);
end $$;

create or replace function public.thread_record_capability_use(p_actor jsonb, p_id uuid, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint; o public.objects;
begin
  perform public._assert_actor(p_actor);
  select * into o from public.objects where id = p_id;
  if o.type is distinct from 'ComposableCapability' or o.is_tombstone or o.lifecycle_state = 'retired' then
    raise exception 'NOT_IN_SERVICE: only live capabilities record use';
  end if;
  insert into public.capability_usage (capability_id, consumer, outcome, cost, latency_ms, composition_id, adapter_mode, at)
  values (p_id, coalesce(p->>'consumer', p_actor->>'id'), coalesce(p->>'outcome','success'), coalesce((p->>'cost')::numeric, 0),
          (p->>'latency_ms')::int, nullif(p->>'composition_id','')::uuid, coalesce(p->>'adapter_mode','simulated'), coalesce((p->>'at')::timestamptz, now()))
  returning id into n;
  return n;
end $$;

-- 7.6 automated lifecycle: review date, minimum use, cost ceiling, expiry -> retirement that keeps data and audit continuity
create or replace function public.thread_fabric_sweep(p_actor jsonb, p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.objects; uses int; cost numeric; win int; pub timestamptz; reason text; retired jsonb := '[]'; flagged jsonb := '[]'; w record;
begin
  perform public._assert_actor(p_actor);
  for o in select * from public.objects where type = 'ComposableCapability' and not is_tombstone and lifecycle_state not in ('proposed','retired') for update loop
    win := coalesce((o.body->'minimum_use_threshold'->>'window_days')::int, 30);
    pub := coalesce((o.body->>'published_at')::timestamptz, o.created_at);
    select count(*), coalesce(sum(cost), 0) into uses, cost from public.capability_usage where capability_id = o.id and at > p_now - make_interval(days => win) and at <= p_now;
    reason := null;
    if o.expires_at is not null and o.expires_at <= p_now then reason := 'expiration condition met';
    elsif p_now - pub >= make_interval(days => win) and uses < coalesce((o.body->'minimum_use_threshold'->>'uses')::int, 0) then
      reason := format('use below minimum (%s < %s in %s days)', uses, o.body->'minimum_use_threshold'->>'uses', win);
    end if;
    if reason is not null then
      -- retire: state changes, nothing is deleted; usage rows, versions, edges and ledger stay intact
      o.lifecycle_state := 'retired'; o.retired_at := p_now; o.retirement_reason := 'automatic retirement: ' || reason;
      o.body := o.body || jsonb_build_object('is_machine_discoverable', false);
      o.version := o.version + 1;
      o := public._thread_apply(p_actor, o, 'capability.retired', jsonb_build_object('reason', reason, 'uses_in_window', uses, 'automatic', true));
      retired := retired || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', reason);
      for w in select e.from_id from public.edges e join public.objects x on x.id = e.from_id
               where e.to_id = o.id and e.verb = 'composes' and e.retired_at is null and not x.is_tombstone and x.authority_level > 'observe' loop
        perform public.thread_authority_event(p_actor, w.from_id, 'value_review_underperformance', array[o.id]);
      end loop;
    elsif coalesce((o.body->'operating_cost_ceiling'->>'amount')::numeric, null) is not null and cost > (o.body->'operating_cost_ceiling'->>'amount')::numeric
          and o.lifecycle_state <> 'underperforming' then
      o.lifecycle_state := 'underperforming'; o.version := o.version + 1;
      o := public._thread_apply(p_actor, o, 'capability.cost_ceiling_exceeded', jsonb_build_object('cost_in_window', cost));
      if o.authority_level > 'observe' then perform public.thread_authority_event(p_actor, o.id, 'value_review_underperformance', '{}'); end if;
      flagged := flagged || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', 'operating cost ceiling exceeded');
    elsif o.review_date < p_now::date then
      flagged := flagged || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', 'review date passed');
    end if;
  end loop;
  return jsonb_build_object('retired', retired, 'flagged', flagged);
end $$;

revoke execute on function public.thread_publish_capability(jsonb, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.thread_compose_capabilities(jsonb, uuid[], text, text) from public, anon, authenticated;
revoke execute on function public.thread_record_capability_use(jsonb, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_fabric_sweep(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.thread_publish_capability(jsonb, uuid, uuid) to service_role;
grant execute on function public.thread_compose_capabilities(jsonb, uuid[], text, text) to service_role;
grant execute on function public.thread_record_capability_use(jsonb, uuid, jsonb) to service_role;
grant execute on function public.thread_fabric_sweep(jsonb, timestamptz) to service_role;

-- Phase 6: creation loop and platform integration (Part 8, 13.4, 13.5)

create table public.build_platforms (
  platform text primary key check (platform in ('lovable','claude_code','codex','cursor','grok')),
  label text not null,
  hosting text not null check (hosting in ('self_hosted','vendor_saas')),
  cleared_classes public.data_classification[] not null,
  live_determinism text not null check (live_determinism in ('deterministic','best_effort')),
  model_route text not null,
  capture text not null);
grant select on public.build_platforms to authenticated;
grant all on public.build_platforms to service_role;
alter table public.build_platforms enable row level security;
create policy "read build platforms" on public.build_platforms for select to authenticated using (true);
insert into public.build_platforms values
 ('lovable','Lovable','vendor_saas','{public,internal}','best_effort','route.build.vendor','API run, diff, commit'),
 ('claude_code','Claude Code','self_hosted','{public,internal,confidential}','best_effort','route.build.high','stdout, diff, commits, token cost'),
 ('codex','Codex','self_hosted','{public,internal,confidential}','best_effort','route.build.high','agent harness log, diff'),
 ('cursor','Cursor','self_hosted','{public,internal,confidential}','best_effort','route.build.high','applied diff'),
 ('grok','Grok Bots','self_hosted','{public,internal,confidential}','best_effort','route.build.high','bot traces');
create trigger build_platforms_append_only before update or delete on public.build_platforms for each row execute function public.reject_mutation();

create table public.cost_ceilings (
  scope text not null check (scope in ('mission','cell')),
  scope_id uuid not null references public.objects(id),
  ceiling numeric not null check (ceiling > 0),
  set_by jsonb not null, set_at timestamptz not null default now(),
  primary key (scope, scope_id));
grant select on public.cost_ceilings to authenticated;
grant all on public.cost_ceilings to service_role;
alter table public.cost_ceilings enable row level security;
create policy "read cost ceilings" on public.cost_ceilings for select to authenticated using (true);

alter table public.build_runs
  add column status text not null default 'dispatched' check (status in ('dispatched','running','succeeded','failed')),
  add column estimated_cost numeric,
  add column artifacts jsonb not null default '[]',
  add column duration_ms integer,
  add column failure_reason text,
  add column replay_of uuid references public.build_runs(object_id),
  add column replay_result jsonb,
  add column dispatched_at timestamptz not null default now(),
  add column completed_at timestamptz;

create table public.iterations (
  object_id uuid primary key references public.objects(id),
  from_run uuid not null references public.build_runs(object_id),
  to_run uuid not null references public.build_runs(object_id),
  declared_class text not null check (declared_class in ('cosmetic','behavioural','scope','architecture')),
  detected_class text not null check (detected_class in ('cosmetic','behavioural','scope','architecture')),
  scope_change_flag boolean not null,
  diff jsonb not null,
  at timestamptz not null default now());
grant select on public.iterations to authenticated;
grant all on public.iterations to service_role;
alter table public.iterations enable row level security;
create policy "read iterations" on public.iterations for select to authenticated using (exists (select 1 from public.objects o where o.id = iterations.object_id));
create trigger iterations_append_only before update or delete on public.iterations for each row execute function public.reject_mutation();

create or replace function public.creation_prompt_raw_guard() returns trigger language plpgsql set search_path = public as $$
declare hay text; i int; j int; hit text; qlen int;
begin
  if NEW.compiled_hash <> encode(sha256(convert_to(NEW.compiled_text, 'UTF8')), 'hex') then
    raise exception 'COMPILED_HASH_MISMATCH: the compiled hash does not match the compiled text';
  end if;
  hay := NEW.compiled_text;
  i := strpos(hay, '<<<UNTRUSTED_QUOTED_DATA');
  if i > 0 then
    j := strpos(substr(hay, i), 'UNTRUSTED_QUOTED_DATA>>>');
    if j = 0 then raise exception 'QUOTED_REGION_UNTERMINATED: verbatim content must sit in a closed, quoted non-instruction region (13.4)'; end if;
    qlen := j - 1 - length('<<<UNTRUSTED_QUOTED_DATA');
    if qlen > 300 then raise exception 'QUOTED_REGION_TOO_LONG: the quoted region is capped (13.4)'; end if;
    hay := substr(hay, 1, i - 1) || substr(hay, i + j - 1 + length('UNTRUSTED_QUOTED_DATA>>>'));
  end if;
  hay := lower(hay);
  select t into hit from (
    select e.payload->>'text' t from public.objects b
      join public.session_events e on e.session_id::text = b.body->>'origin_session_ref' and e.kind = 'segment'
     where b.id = any(NEW.source_behavior_ids)
    union all
    select x->>k from public.objects b, jsonb_array_elements(case when jsonb_typeof(b.body->'provenance_spans') = 'array' then b.body->'provenance_spans' else '[]' end) x,
      unnest(array['quote','text']) k where b.id = any(NEW.source_behavior_ids)
    union all
    select b.body->>'raw_text' from public.objects b where b.id = any(NEW.source_behavior_ids)
  ) s where length(btrim(coalesce(t, ''))) >= 16 and strpos(hay, lower(btrim(t))) > 0 limit 1;
  if hit is not null then
    raise exception 'RAW_CAPTURED_TEXT_IN_PROMPT: the creation prompt contains raw captured text; prompts are compiled from typed confirmed fields only (13.4)';
  end if;
  return NEW;
end $$;
create trigger d_creation_prompt_raw_guard before insert or update on public.creation_prompts for each row execute function public.creation_prompt_raw_guard();
create trigger creation_prompts_append_only before update or delete on public.creation_prompts for each row execute function public.reject_mutation();

create or replace function public._guardrail_set_version() returns text language sql stable set search_path = public as $$
  select left(encode(sha256(convert_to(coalesce(string_agg(id::text || ':' || version || ':' || enforcement, ',' order by id), ''), 'UTF8')), 'hex'), 16)
  from public.guardrails where active $$;

create or replace function public._classify_iteration(d jsonb) returns text language sql immutable as $$
  select case
    when jsonb_array_length(coalesce(d->'added_obligations', '[]')) > 0 then 'scope'
    when jsonb_array_length(coalesce(d->'changed_contracts', '[]')) > 0 then 'architecture'
    when jsonb_array_length(coalesce(d->'changed_results', '[]')) > 0 then 'behavioural'
    else 'cosmetic' end $$;

create or replace function public._sim_build_digest(_compiled_hash text, _platform text, _model_version text, _template_version text, _gsv text) returns text
language sql immutable as $$ select encode(sha256(convert_to(_compiled_hash || '|' || _platform || '|' || _model_version || '|' || _template_version || '|' || _gsv, 'UTF8')), 'hex') $$;

create or replace function public.build_runs_guard() returns trigger language plpgsql set search_path = public as $$
declare cls public.data_classification; pf public.build_platforms; m text; c text; sc text; committed numeric; lim numeric;
begin
  if TG_OP = 'DELETE' then raise exception 'APPEND_ONLY: build runs are never deleted'; end if;
  if not exists (select 1 from public.ledger l where l.txid = txid_current() and l.object_id = NEW.object_id) then
    raise exception 'PROVENANCE_REQUIRED: no ledger entry for build run % in this transaction', NEW.object_id;
  end if;
  if TG_OP = 'UPDATE' then
    if (NEW.prompt_id, NEW.platform, NEW.repro_key, NEW.cost_ceiling, NEW.adapter_mode, NEW.replay_mode, NEW.replay_of, NEW.estimated_cost, NEW.dispatched_at)
       is distinct from (OLD.prompt_id, OLD.platform, OLD.repro_key, OLD.cost_ceiling, OLD.adapter_mode, OLD.replay_mode, OLD.replay_of, OLD.estimated_cost, OLD.dispatched_at) then
      raise exception 'RUN_PINNED: platform, reproducibility key, ceiling and adapter mode are pinned at dispatch';
    end if;
    if OLD.status in ('succeeded','failed') and NEW.status <> OLD.status then raise exception 'RUN_FINISHED: a finished run cannot change outcome; dispatch a new run'; end if;
    return NEW;
  end if;
  select * into pf from public.build_platforms where platform = NEW.platform;
  select o.data_classification into cls from public.objects o where o.id = NEW.prompt_id;
  if not (cls = any(pf.cleared_classes)) then
    raise exception 'PLATFORM_NOT_CLEARED: % is not cleared for % content (Part 8.3)', pf.label, cls;
  end if;
  if NEW.repro_key ?& array['prompt_version','prompt_hash','platform','model_route','model_version','guardrail_set_version','template_version'] is not true then
    raise exception 'REPRO_KEY_INCOMPLETE: prompt version, platform, model route, model version, guardrail set version and template version are all pinned (8.2)';
  end if;
  if NEW.cost_ceiling is null or NEW.cost_ceiling <= 0 then raise exception 'COST_CEILING_REQUIRED: every dispatch has a per-build cost ceiling (13.5)'; end if;
  if coalesce(NEW.estimated_cost, 0) > NEW.cost_ceiling then
    raise exception 'COST_CEILING_EXCEEDED: estimate % is over the per-build ceiling % (13.5)', NEW.estimated_cost, NEW.cost_ceiling;
  end if;
  select o.body->>'mission_ref', o.body->>'cell_ref' into m, c from public.objects o where o.id = NEW.prompt_id;
  for lim, committed, sc in
    select cc.ceiling, coalesce((select sum(coalesce(r.cost_actual, r.cost_ceiling)) from public.build_runs r join public.objects p on p.id = r.prompt_id
        where p.body->>(cc.scope || '_ref') = cc.scope_id::text and r.status <> 'failed'), 0), cc.scope
      from public.cost_ceilings cc where (cc.scope = 'mission' and cc.scope_id::text = m) or (cc.scope = 'cell' and cc.scope_id::text = c)
  loop
    if committed + NEW.cost_ceiling > lim then
      raise exception 'BUDGET_EXCEEDED: the % ceiling % would be passed (% already committed) (13.5)', sc, lim, committed;
    end if;
  end loop;
  return NEW;
end $$;
create trigger build_runs_guard before insert or update or delete on public.build_runs for each row execute function public.build_runs_guard();

create or replace function public._max_classification(_ids uuid[]) returns public.data_classification language sql stable set search_path = public as $$
  select coalesce(max(data_classification), 'internal') from public.objects where id = any(_ids) $$;

create or replace function public.thread_compile_creation_prompt(p_actor jsonb, p jsonb) returns public.objects
language plpgsql security definer set search_path = public as $$
declare tpl public.objects; con public.objects; rc public.reuse_checks; o public.objects; bids uuid[]; cls public.data_classification; b uuid;
begin
  perform public._assert_actor(p_actor);
  bids := array(select x::uuid from jsonb_array_elements_text(p->'behavior_ids') x);
  if cardinality(bids) = 0 then raise exception 'BEHAVIOUR_REQUIRED: a prompt compiles from at least one confirmed Behaviour Statement'; end if;
  if exists (select 1 from public.objects where id = any(bids) and type <> 'BehaviorStatement') then raise exception 'SOURCE_TYPE: sources must be Behaviour Statements'; end if;
  select * into tpl from public.objects where id = (p->>'template_id')::uuid and type = 'PromptTemplate' and not is_tombstone;
  if tpl.id is null then raise exception 'TEMPLATE_REQUIRED: a versioned PromptTemplate is required'; end if;
  if tpl.lifecycle_state <> 'active' or coalesce(tpl.body->>'evaluation_status', '') <> 'passed' then
    raise exception 'TEMPLATE_NOT_EVAL_GATED: % must be active with a passed evaluation before it compiles prompts (Part 8.2)', tpl.human_ref;
  end if;
  if coalesce(tpl.body->>'platform', 'any') not in ('any', p->>'target_platform') then
    raise exception 'TEMPLATE_PLATFORM_MISMATCH: % is for %', tpl.human_ref, tpl.body->>'platform';
  end if;
  select * into con from public.objects where id = (p->>'contract_id')::uuid and type = 'ExecutableOutcomeContract' and not is_tombstone;
  if con.id is null or con.lifecycle_state <> 'active' then raise exception 'CONTRACT_REQUIRED: an active Executable Outcome Contract governs the prompt'; end if;
  select * into rc from public.reuse_checks where id = (p->>'reuse_check_id')::uuid;
  if rc.id is null then raise exception 'REUSE_CHECK_REQUIRED: no creation may begin until the fabric has been searched and the result recorded (P11)'; end if;
  cls := greatest(public._max_classification(bids || con.id || tpl.id), coalesce((p->>'data_classification')::public.data_classification, 'public'));
  o := public.thread_create_object(p_actor, jsonb_build_object(
    'type', 'CreationPrompt', 'title', p->>'title', 'statement', 'Compiled from ' || jsonb_array_length(p->'behavior_ids') || ' confirmed behaviour statement(s) under ' || con.human_ref,
    'machine_description', 'CreationPrompt compiled from typed confirmed fields only (Part 13.4)',
    'body', jsonb_build_object('reuse_check_ref', rc.id, 'behavior_statement_refs', p->'behavior_ids', 'source_behavior_statements', p->'behavior_ids',
      'outcome_contract_ref', con.id, 'prompt_template_ref', tpl.id, 'template_version', tpl.body->>'version', 'guardrail_set_ref', public._guardrail_set_version(),
      'guardrails_applied', p->'guardrails_applied', 'design_context_refs', coalesce(p->'capability_refs', '[]'), 'target_platform', p->>'target_platform',
      'expected_risk_tier', p->>'risk_tier', 'estimated_cost', p->'estimated_cost', 'compiled_at', now(), 'compiled_by', p_actor,
      'compiled_hash', p->>'compiled_hash', 'mission_ref', p->>'mission_ref', 'cell_ref', p->>'cell_ref'),
    'review_date', (current_date + 90)::text, 'expiration_condition', jsonb_build_object('kind', 'source_hash_changes'),
    'retirement_path', jsonb_build_object('mode', 'supersede'), 'risk_tier', coalesce(p->>'risk_tier', '1'),
    'permission', jsonb_build_object('roles', '[]'::jsonb, 'purpose', 'creation loop'), 'data_classification', cls,
    'derived_from', p->'behavior_ids', 'rationale', coalesce(p->>'rationale', 'compiled for dispatch')));
  insert into public.creation_prompts (object_id, reuse_check_id, source_behavior_ids, template_id, template_version, compiled_text, compiled_hash)
    values (o.id, rc.id, bids, tpl.id, tpl.body->>'version', p->>'compiled_text', p->>'compiled_hash');
  foreach b in array bids loop
    perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'compiled_into', 'from_id', b, 'to_id', o.id, 'source', 'stated', 'rationale', 'compiled'));
  end loop;
  perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'used_template', 'from_id', o.id, 'to_id', tpl.id, 'source', 'stated', 'rationale', 'compiled'));
  return o;
end $$;

create or replace function public.thread_dispatch_build(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr public.objects; cp public.creation_prompts; pf public.build_platforms; run public.objects; key jsonb; src public.build_runs; mode text;
begin
  perform public._assert_actor(p_actor);
  select * into pr from public.objects where id = (p->>'prompt_id')::uuid and type = 'CreationPrompt' and not is_tombstone;
  select * into cp from public.creation_prompts where object_id = pr.id;
  if cp.object_id is null then raise exception 'PROMPT_REQUIRED: dispatch needs a compiled CreationPrompt'; end if;
  select * into pf from public.build_platforms where platform = p->>'platform';
  if pf.platform is null then raise exception 'UNKNOWN_PLATFORM: %', p->>'platform'; end if;
  mode := coalesce(p->>'adapter_mode', 'simulated');
  key := jsonb_build_object('prompt_version', pr.version, 'prompt_hash', cp.compiled_hash, 'platform', pf.platform, 'model_route', pf.model_route,
    'model_version', coalesce(p->>'model_version', 'unpinned'), 'guardrail_set_version', pr.body->>'guardrail_set_ref', 'template_version', cp.template_version);
  if p ? 'replay_of' then
    select * into src from public.build_runs where object_id = (p->>'replay_of')::uuid;
    if src.object_id is null then raise exception 'REPLAY_SOURCE_NOT_FOUND'; end if;
    if src.prompt_id <> pr.id then raise exception 'REPLAY_PROMPT_MISMATCH: a replay uses the same prompt'; end if;
    if src.platform <> pf.platform then raise exception 'REPLAY_PLATFORM_MISMATCH: a replay uses the same platform'; end if;
    key := src.repro_key;
    if key->>'prompt_hash' <> cp.compiled_hash or key->>'guardrail_set_version' <> (pr.body->>'guardrail_set_ref') then
      raise exception 'REPLAY_KEY_DRIFT: the pinned prompt or guardrail set has changed since the original run';
    end if;
  end if;
  run := public.thread_create_object(p_actor, jsonb_build_object(
    'type', 'BuildRun', 'title', pf.label || ' build of ' || pr.human_ref || case when p ? 'replay_of' then ' (replay)' else '' end,
    'statement', 'Dispatched ' || pr.human_ref || ' to ' || pf.label, 'machine_description', 'BuildRun with pinned reproducibility key (Part 8.2)',
    'body', jsonb_build_object('reuse_check_ref', cp.reuse_check_id, 'prompt_ref', pr.id, 'platform', pf.platform, 'model_route_ref', key->>'model_route',
      'model_version_pin', key->>'model_version', 'guardrail_set_version', key->>'guardrail_set_version', 'template_version', key->>'template_version',
      'dispatched_at', now(), 'reproducibility_key', key, 'agent_actor', p_actor, 'authority_used', p_actor->>'authority_used', 'replay_of', p->>'replay_of',
      'provenance', jsonb_build_object('simulated', mode = 'simulated')),
    'review_date', (current_date + 90)::text, 'expiration_condition', jsonb_build_object('kind', 'explicit_event', 'params', jsonb_build_object('event', 'superseded_by_new_run')),
    'retirement_path', jsonb_build_object('mode', 'archive_evidence'), 'risk_tier', pr.risk_tier::text,
    'permission', pr.permission, 'data_classification', pr.data_classification, 'derived_from', jsonb_build_array(pr.id),
    'adapter_mode', mode, 'rationale', coalesce(p->>'rationale', 'dispatch')));
  insert into public.build_runs (object_id, prompt_id, platform, repro_key, cost_ceiling, estimated_cost, adapter_mode, replay_mode, replay_of)
    values (run.id, pr.id, pf.platform, key, (p->>'cost_ceiling')::numeric, (p->>'estimated_cost')::numeric, mode,
      case when mode = 'simulated' then 'deterministic' else pf.live_determinism end, (p->>'replay_of')::uuid);
  run := public.thread_transition_object(p_actor, run.id, run.version, 'dispatched', 'dispatched to ' || pf.label);
  perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'executed_as', 'from_id', pr.id, 'to_id', run.id, 'source', 'stated', 'rationale', 'dispatch'));
  if pr.lifecycle_state = 'compiled' then perform public.thread_transition_object(p_actor, pr.id, pr.version, 'dispatched', 'first dispatch'); end if;
  return jsonb_build_object('run_id', run.id, 'human_ref', run.human_ref, 'repro_key', key, 'replay_mode', case when mode = 'simulated' then 'deterministic' else pf.live_determinism end);
end $$;

create or replace function public.thread_record_build_result(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare br public.build_runs; run public.objects; art jsonb; ao public.objects; arts jsonb := '[]'; st text; src public.build_runs; eq boolean; res jsonb;
begin
  perform public._assert_actor(p_actor);
  select * into br from public.build_runs where object_id = (p->>'run_id')::uuid;
  if br.object_id is null then raise exception 'RUN_NOT_FOUND'; end if;
  if br.status in ('succeeded','failed') then raise exception 'RUN_FINISHED: % already finished', p->>'run_id'; end if;
  select * into run from public.objects where id = br.object_id;
  st := p->>'status';
  if st not in ('succeeded','failed') then raise exception 'STATUS_INVALID'; end if;
  if st = 'succeeded' and coalesce(p->>'secrets_scan', '') <> 'clean' then
    st := 'failed';
    p := p || jsonb_build_object('failure_reason', 'SECRETS_SCAN_NOT_CLEAN: an artifact is accepted only with a clean secrets scan (8.2)');
  end if;
  if st = 'succeeded' and (p->>'cost_actual')::numeric > br.cost_ceiling then
    st := 'failed';
    p := p || jsonb_build_object('failure_reason', 'COST_CEILING_BREACHED: actual cost passed the per-build ceiling');
  end if;
  if run.lifecycle_state = 'dispatched' then run := public.thread_transition_object(p_actor, run.id, run.version, 'running', 'platform accepted the run'); end if;
  if st = 'succeeded' then
    for art in select * from jsonb_array_elements(coalesce(p->'artifacts', '[]')) loop
      ao := public.thread_create_object(p_actor, jsonb_build_object('type', 'BuildArtifact', 'title', (art->>'kind') || ' from ' || run.human_ref,
        'statement', 'Artifact ' || (art->>'uri'), 'machine_description', 'BuildArtifact produced by a BuildRun',
        'body', jsonb_build_object('run_ref', run.id, 'repository', art->>'repository', 'commit_or_version', art->>'commit', 'image_or_bundle', art->>'uri',
          'digest', art->>'hash', 'kind', art->>'kind', 'diff_ref', art->>'diff_ref', 'secrets_scan_result', p->>'secrets_scan',
          'files_changed', art->'files_changed', 'dependency_manifest', art->'dependency_manifest', 'backlink', jsonb_build_object('build_run', run.id),
          'provenance', jsonb_build_object('simulated', br.adapter_mode = 'simulated')),
        'review_date', (current_date + 180)::text, 'expiration_condition', jsonb_build_object('kind', 'explicit_event', 'params', jsonb_build_object('event', 'run_superseded')),
        'retirement_path', jsonb_build_object('mode', 'archive_evidence'), 'risk_tier', run.risk_tier::text, 'permission', run.permission,
        'data_classification', run.data_classification, 'derived_from', jsonb_build_array(run.id), 'adapter_mode', br.adapter_mode, 'rationale', 'artifact attached'));
      perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'produced_artifact', 'from_id', run.id, 'to_id', ao.id, 'source', 'stated', 'rationale', 'artifact'));
      arts := arts || jsonb_build_object('kind', art->>'kind', 'uri', art->>'uri', 'hash', art->>'hash', 'artifact_id', ao.id);
    end loop;
  end if;
  if br.replay_of is not null and st = 'succeeded' then
    select * into src from public.build_runs where object_id = br.replay_of;
    eq := (select coalesce(array_agg(x->>'hash' order by x->>'hash'), '{}') from jsonb_array_elements(arts) x)
        = (select coalesce(array_agg(x->>'hash' order by x->>'hash'), '{}') from jsonb_array_elements(src.artifacts) x);
    res := jsonb_build_object('equivalent', eq, 'replay_mode', br.replay_mode,
      'verdict', case when eq then 'equivalent artifact reproduced' when br.replay_mode = 'best_effort' then 'best_effort: platform cannot guarantee determinism' else 'NOT equivalent' end);
  end if;
  perform public._ledger_write(run.provenance_chain_id, p_actor, 'build.result', run,
    jsonb_build_object('adapter_mode', br.adapter_mode, 'status', st, 'external_run_id', p->>'external_run_id', 'replay_result', res));
  update public.build_runs set status = st, external_run_id = coalesce(p->>'external_run_id', external_run_id), cost_actual = (p->>'cost_actual')::numeric,
    duration_ms = (p->>'duration_ms')::int, artifacts = arts, failure_reason = p->>'failure_reason', completed_at = now(), replay_result = res
   where object_id = br.object_id;
  select * into run from public.objects where id = br.object_id;
  run := public.thread_transition_object(p_actor, run.id, run.version, st, coalesce(p->>'failure_reason', 'platform reported ' || st));
  return jsonb_build_object('run_id', run.id, 'status', st, 'artifacts', arts, 'replay_result', res);
end $$;

create or replace function public.thread_record_skeleton(p_actor jsonb, p jsonb) returns public.objects
language plpgsql security definer set search_path = public as $$
declare br public.build_runs; run public.objects; s public.objects;
begin
  perform public._assert_actor(p_actor);
  select * into br from public.build_runs where object_id = (p->>'run_id')::uuid;
  if br.status is distinct from 'succeeded' then raise exception 'SKELETON_NEEDS_SUCCESSFUL_RUN: a working skeleton is recorded from a succeeded run'; end if;
  select * into run from public.objects where id = br.object_id;
  s := public.thread_create_object(p_actor, jsonb_build_object('type', 'WorkingSkeleton', 'title', coalesce(p->>'title', 'Skeleton from ' || run.human_ref),
    'statement', coalesce(p->>'one_real_user_process', 'thin end-to-end slice'), 'machine_description', 'WorkingSkeleton: the first thin end-to-end slice',
    'body', (coalesce(p->'fields', '{}') || jsonb_build_object('run_ref', run.id, 'mission_ref', p->>'mission_ref', 'artifacts', br.artifacts,
      'provenance', jsonb_build_object('simulated', br.adapter_mode = 'simulated'))),
    'review_date', (current_date + 60)::text, 'expiration_condition', jsonb_build_object('kind', 'review_date_passes'),
    'retirement_path', jsonb_build_object('mode', 'supersede'), 'risk_tier', run.risk_tier::text, 'permission', run.permission,
    'data_classification', run.data_classification, 'derived_from', jsonb_build_array(run.id), 'adapter_mode', br.adapter_mode, 'rationale', 'skeleton recorded'));
  if p->>'mission_ref' is not null then
    perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'skeleton_of', 'from_id', s.id, 'to_id', (p->>'mission_ref')::uuid, 'source', 'stated', 'rationale', 'skeleton'));
  end if;
  return s;
end $$;

create or replace function public.thread_record_iteration(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.build_runs; b public.build_runs; ra public.objects; it public.objects; declared text; detected text; flag boolean; owner uuid; gov jsonb;
begin
  perform public._assert_actor(p_actor);
  select * into a from public.build_runs where object_id = (p->>'from_run')::uuid;
  select * into b from public.build_runs where object_id = (p->>'to_run')::uuid;
  if a.object_id is null or b.object_id is null or a.object_id = b.object_id then raise exception 'RUNS_REQUIRED: an iteration links two different runs'; end if;
  declared := p->>'declared_class';
  if declared is null or declared not in ('cosmetic','behavioural','scope','architecture') then raise exception 'CLASS_REQUIRED: every iteration is classified (8.5)'; end if;
  detected := public._classify_iteration(p->'diff');
  flag := detected = 'scope' and declared in ('cosmetic','behavioural');
  if declared = 'scope' and not exists (select 1 from public.creation_prompts cb, public.creation_prompts ca
      where cb.object_id = b.prompt_id and ca.object_id = a.prompt_id and not (cb.source_behavior_ids <@ ca.source_behavior_ids)) then
    raise exception 'SCOPE_REQUIRES_NEW_BEHAVIOUR: a scope change re-enters framing and is traced to a new Behaviour Statement (8.5)';
  end if;
  gov := jsonb_build_object('cosmetic', 'Fast delta rebuild; no re-approval; authority unchanged',
    'behavioural', 'Behaviour Statement re-confirmed; tests regenerated; authority re-evaluated',
    'scope', 'Must re-enter mission framing: a new Behaviour Statement traced to a new or amended Executable Outcome Contract',
    'architecture', 'Coherence Agent conformance re-run; capability contract versioned; dependent capabilities notified');
  select * into ra from public.objects where id = b.object_id;
  it := public.thread_create_object(p_actor, jsonb_build_object('type', 'Iteration', 'title', 'Iteration ' || (select human_ref from public.objects where id = a.object_id) || ' to ' || ra.human_ref,
    'statement', 'Declared ' || declared || '; diff indicates ' || detected, 'machine_description', 'Iteration classification (Part 8.5)',
    'body', jsonb_build_object('from_run', a.object_id, 'to_run', b.object_id, 'trigger', p->>'trigger', 'change_class', declared, 'detected_class', detected,
      'scope_change_flag', flag, 'governance_consequence', gov->>declared, 'diff', p->'diff'),
    'review_date', (current_date + 180)::text, 'expiration_condition', jsonb_build_object('kind', 'review_date_passes'),
    'retirement_path', jsonb_build_object('mode', 'archive_evidence'), 'risk_tier', ra.risk_tier::text, 'permission', ra.permission,
    'data_classification', ra.data_classification, 'derived_from', jsonb_build_array(a.object_id, b.object_id), 'rationale', coalesce(p->>'rationale', 'iteration recorded')));
  insert into public.iterations (object_id, from_run, to_run, declared_class, detected_class, scope_change_flag, diff)
    values (it.id, a.object_id, b.object_id, declared, detected, flag, coalesce(p->'diff', '{}'));
  perform public.thread_create_edge(p_actor, jsonb_build_object('verb', 'iterated_as', 'from_id', a.object_id, 'to_id', b.object_id, 'source', 'stated', 'rationale', 'iteration'));
  if flag then
    select owner_id into owner from public.detectors where key = 'ScopeChangeSmuggledThroughIteration';
    insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence)
      values (public.uuid_v7(), 'ScopeChangeSmuggledThroughIteration', it.id, 'high', owner, 'open',
        jsonb_build_object('declared', declared, 'detected', detected, 'added_obligations', p->'diff'->'added_obligations',
          'remediation', 'Re-enter mission framing: confirm a new Behaviour Statement under a new or amended Executable Outcome Contract'));
  end if;
  return jsonb_build_object('iteration_id', it.id, 'human_ref', it.human_ref, 'classification', declared, 'detected_class', detected, 'scope_change_flag', flag, 'governance', gov->>declared);
end $$;

create or replace function public.thread_set_cost_ceiling(p_actor jsonb, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o public.objects;
begin
  perform public._assert_actor(p_actor);
  select * into o from public.objects where id = (p->>'scope_id')::uuid;
  if o.type is distinct from (case p->>'scope' when 'mission' then 'ValueMission' when 'cell' then 'ValueCell' end) then raise exception 'SCOPE_INVALID: a ceiling is set on a ValueMission or ValueCell'; end if;
  perform public._ledger_write(o.provenance_chain_id, p_actor, 'cost.ceiling.set', o, jsonb_build_object('scope', p->>'scope', 'ceiling', p->'ceiling'));
  insert into public.cost_ceilings (scope, scope_id, ceiling, set_by) values (p->>'scope', o.id, (p->>'ceiling')::numeric, p_actor)
    on conflict (scope, scope_id) do update set ceiling = excluded.ceiling, set_by = excluded.set_by, set_at = now();
end $$;

insert into public.detectors (key, family, owner_id, schedule, event_triggers, params, version)
select 'ScopeChangeSmuggledThroughIteration', 'creation', ur.user_id, null, array['iteration.recorded'], '{"rule":"diff adds an obligation while declared cosmetic or behavioural (Part 8.5)"}', '1.0.0'
from public.user_roles ur where ur.role = 'steward' order by ur.user_id limit 1
on conflict (key) do nothing;

insert into public.tool_contracts (name, contract, version) values
 ('compile_creation_prompt', '{"kernel":"Creation","input":["behavior_ids","contract_id","template_id","reuse_check_id","target_platform"],"output":"CreationPrompt","errors":["REUSE_CHECK_REQUIRED","DRAFT_CANNOT_REACH_CREATION","NO_DECISION_ANCESTOR","TEMPLATE_NOT_EVAL_GATED","RAW_CAPTURED_TEXT_IN_PROMPT"]}', '1.0.0'),
 ('dispatch_build', '{"kernel":"Creation","input":["prompt_id","platform","cost_ceiling"],"output":"BuildRun","errors":["PLATFORM_NOT_CLEARED","COST_CEILING_REQUIRED","COST_CEILING_EXCEEDED","BUDGET_EXCEEDED","REPRO_KEY_INCOMPLETE"]}', '1.0.0'),
 ('replay_build', '{"kernel":"Creation","input":["run_id"],"output":"BuildRun","errors":["REPLAY_KEY_DRIFT"],"note":"equivalent artifact or honestly best_effort"}', '1.0.0'),
 ('record_iteration', '{"kernel":"Creation","input":["run_id","diff_ref","declared_class"],"output":{"classification":"text","scope_change_flag":"boolean"},"errors":["CLASS_REQUIRED","SCOPE_REQUIRES_NEW_BEHAVIOUR"]}', '1.0.0'),
 ('record_skeleton', '{"kernel":"Creation","input":["run_id","mission_ref"],"output":"WorkingSkeleton","errors":["SKELETON_NEEDS_SUCCESSFUL_RUN"]}', '1.0.0')
on conflict (name) do nothing;

revoke all on function public.thread_compile_creation_prompt(jsonb, jsonb), public.thread_dispatch_build(jsonb, jsonb), public.thread_record_build_result(jsonb, jsonb),
  public.thread_record_skeleton(jsonb, jsonb), public.thread_record_iteration(jsonb, jsonb), public.thread_set_cost_ceiling(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_compile_creation_prompt(jsonb, jsonb), public.thread_dispatch_build(jsonb, jsonb), public.thread_record_build_result(jsonb, jsonb),
  public.thread_record_skeleton(jsonb, jsonb), public.thread_record_iteration(jsonb, jsonb), public.thread_set_cost_ceiling(jsonb, jsonb) to service_role;

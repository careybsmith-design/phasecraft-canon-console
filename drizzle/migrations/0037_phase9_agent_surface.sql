alter table public.agents alter column id set default gen_random_uuid();
alter table public.agents add column if not exists owner_id uuid;
alter table public.agents add column if not exists auth_user_id uuid unique;
alter table public.agents add column if not exists state text not null default 'active';
alter table public.agents add column if not exists mandate text;
alter table public.agents add column if not exists token_prefix text;
alter table public.agents add column if not exists created_at timestamptz not null default now();
alter table public.agents add column if not exists revoked_at timestamptz;
alter table public.agents add column if not exists revoked_reason text;
do $$ begin
  alter table public.agents add constraint agents_state_chk check (state in ('active','revoked'));
exception when duplicate_object then null; end $$;
create unique index if not exists agents_token_hash_uq on public.agents(token_hash);
drop policy if exists "stewards read agents" on public.agents;
create policy "owners and stewards read agents" on public.agents for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'steward'));
revoke select on public.agents from authenticated;
grant select (id, name, authority_ceiling, quota, cost_cap, a2a_card, owner_id, auth_user_id, state, mandate, token_prefix, created_at, revoked_at, revoked_reason) on public.agents to authenticated;
grant all on public.agents to service_role;

create table public.agent_calls (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  tool text not null,
  method text not null default 'tools/call',
  authority_used public.authority_level not null,
  input_hash text not null,
  output_hash text,
  status text not null check (status in ('running','ok','refused','error','blocked')),
  refusal_code text,
  error text,
  cost numeric not null default 0,
  origin_tags jsonb not null default '[]',
  confirmation_id uuid,
  ledger_seq bigint,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int
);
create index agent_calls_agent_time on public.agent_calls(agent_id, started_at desc);
grant select on public.agent_calls to authenticated;
grant all on public.agent_calls to service_role;
alter table public.agent_calls enable row level security;
create policy "owners and stewards read agent calls" on public.agent_calls for select to authenticated
  using (public.has_role(auth.uid(), 'steward') or exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid()));

create or replace function public.agent_calls_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY: agent calls are never deleted'; end if;
  if old.status <> 'running' then raise exception 'APPEND_ONLY: a finished agent call is immutable'; end if;
  if new.agent_id <> old.agent_id or new.tool <> old.tool or new.input_hash <> old.input_hash or new.started_at <> old.started_at then
    raise exception 'APPEND_ONLY: call identity cannot change';
  end if;
  return new;
end $$;
create trigger agent_calls_guard before update or delete on public.agent_calls for each row execute function public.agent_calls_guard();

create table public.confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  tool text not null,
  input_hash text not null,
  reason text not null,
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_call uuid,
  ledger_seq bigint
);
grant select on public.confirmation_tokens to authenticated;
grant all on public.confirmation_tokens to service_role;
alter table public.confirmation_tokens enable row level security;
create policy "issuers owners stewards read tokens" on public.confirmation_tokens for select to authenticated
  using (issued_by = auth.uid() or public.has_role(auth.uid(), 'steward') or exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid()));

create table public.mcp_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  topic text not null check (topic in ('mission_state','authority_change','detector_finding','value_event','decision_required','object','a2a')),
  object_id uuid,
  created_at timestamptz not null default now(),
  unique (agent_id, topic, object_id)
);
grant select on public.mcp_subscriptions to authenticated;
grant all on public.mcp_subscriptions to service_role;
alter table public.mcp_subscriptions enable row level security;
create policy "owners and stewards read subscriptions" on public.mcp_subscriptions for select to authenticated
  using (public.has_role(auth.uid(), 'steward') or exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid()));

create table public.agent_notifications (
  id bigserial primary key,
  agent_id uuid not null references public.agents(id),
  topic text not null,
  ledger_seq bigint not null,
  object_id uuid,
  body jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index agent_notifications_pending on public.agent_notifications(agent_id, id) where delivered_at is null;
grant select on public.agent_notifications to authenticated;
grant all on public.agent_notifications to service_role;
grant usage on sequence public.agent_notifications_id_seq to service_role;
alter table public.agent_notifications enable row level security;
create policy "owners and stewards read agent notifications" on public.agent_notifications for select to authenticated
  using (public.has_role(auth.uid(), 'steward') or exists (select 1 from public.agents a where a.id = agent_id and a.owner_id = auth.uid()));

-- Fan-out: every ledger event is matched to subscriptions (no broadcast streams; permission-filtered per agent).
create or replace function public.ledger_notify_agents() returns trigger language plpgsql security definer set search_path = public as $$
declare o public.objects; topic text; s record;
begin
  if not exists (select 1 from public.mcp_subscriptions) then return new; end if;
  if new.object_id is not null then select * into o from public.objects where id = new.object_id; end if;
  topic := case
    when new.action like 'authority.%' then 'authority_change'
    when new.action like 'detector.%' or new.action like 'injection.%' then 'detector_finding'
    when o.type in ('ValueMeasure','ProductionOutcome','ValueResult') then 'value_event'
    when o.type = 'HumanDecisionRequest' and new.action = 'object.create' then 'decision_required'
    when o.type = 'ValueMission' then 'mission_state'
    when new.action = 'a2a.message' then 'a2a'
    else null end;
  for s in
    select distinct sub.agent_id, sub.topic, a.auth_user_id from public.mcp_subscriptions sub join public.agents a on a.id = sub.agent_id and a.state = 'active'
    where (sub.topic = topic and (sub.object_id is null or sub.object_id = new.object_id))
       or (sub.topic = 'object' and sub.object_id = new.object_id)
  loop
    if s.topic = 'a2a' and (new.payload->>'to_agent')::uuid is distinct from s.agent_id then continue; end if;
    if o.id is not null and (s.auth_user_id is null or not public._can_read_as(s.auth_user_id, o.permission, o.data_classification)) then continue; end if;
    insert into public.agent_notifications (agent_id, topic, ledger_seq, object_id, body)
    values (s.agent_id, s.topic, new.seq, new.object_id,
      jsonb_build_object('action', new.action, 'human_ref', o.human_ref, 'type', o.type, 'lifecycle_state', o.lifecycle_state, 'occurred_at', new.occurred_at,
        'content_origin', 'canon_event'));
  end loop;
  return new;
end $$;
create trigger ledger_notify_agents after insert on public.ledger for each row execute function public.ledger_notify_agents();

create or replace function public._mcp_ledger(_actor jsonb, _action text, _object uuid, _payload jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare s bigint;
begin
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), _actor, coalesce((_actor->>'authority_used')::public.authority_level, 'observe'), _action, null, null, '{}', 'none', _payload, '', 'mcp-' || public.uuid_v7())
  returning seq into s;
  return s;
end $$;

create or replace function public._authority_rank(_l public.authority_level) returns int language sql immutable as $$
  select array_position(array['observe','recommend','act_with_confirmation','act_bounded','autonomous_with_exception']::text[], _l::text) $$;

-- Registration: a human registers an agent with a mandate and a ceiling; members up to recommend, stewards up to act_bounded.
create or replace function public.thread_register_agent(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.agents; uid uuid := (p_actor->>'id')::uuid; ceiling public.authority_level := (p->>'authority_ceiling')::public.authority_level; s bigint;
begin
  perform public._assert_actor(p_actor);
  if p_actor->>'kind' <> 'human' then raise exception 'HUMAN_REQUIRED: only a person registers an agent'; end if;
  if ceiling = 'autonomous_with_exception' then raise exception 'AUTHORITY_EXCEEDED: autonomous authority is earned through the authority engine, never granted at registration'; end if;
  if public._authority_rank(ceiling) > 2 and not public.has_role(uid, 'steward') then
    raise exception 'AUTHORITY_EXCEEDED: only a steward may register an agent above recommend';
  end if;
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'mandate'), '') = '' then raise exception 'MANDATE_REQUIRED: name and mandate are required'; end if;
  if (p->'a2a_card') ? 'definitions' or (p->'a2a_card') ? 'schemas' then
    raise exception 'CONFLICTING_DEFINITIONS: an agent card may reference canon types but never define them (one canon, many agents)';
  end if;
  if exists (select 1 from public.agents where state = 'active' and lower(name) = lower(trim(p->>'name'))) then
    raise exception 'AGENT_NAME_TAKEN: an active agent already has this name';
  end if;
  insert into public.agents (name, token_hash, token_prefix, authority_ceiling, quota, cost_cap, a2a_card, owner_id, auth_user_id, mandate)
  values (trim(p->>'name'), p->>'token_hash', p->>'token_prefix', ceiling,
    coalesce(p->'quota', '{"calls_per_minute":60,"calls_per_day":2000}'), coalesce((p->>'cost_cap')::numeric, 10),
    p->'a2a_card', uid, (p->>'auth_user_id')::uuid, trim(p->>'mandate'))
  returning * into a;
  s := public._mcp_ledger(p_actor, 'agent.registered', null, jsonb_build_object('agent_id', a.id, 'name', a.name, 'authority_ceiling', a.authority_ceiling,
    'quota', a.quota, 'cost_cap', a.cost_cap, 'mandate', a.mandate, 'auth_user_id', a.auth_user_id));
  return jsonb_build_object('agent_id', a.id, 'ledger_seq', s);
end $$;

create or replace function public.thread_revoke_agent(p_actor jsonb, p_agent uuid, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.agents; uid uuid := (p_actor->>'id')::uuid;
begin
  perform public._assert_actor(p_actor);
  select * into a from public.agents where id = p_agent;
  if a.id is null then raise exception 'AGENT_NOT_FOUND'; end if;
  if p_actor->>'kind' <> 'human' or (a.owner_id <> uid and not public.has_role(uid, 'steward')) then raise exception 'AUTHORITY_INSUFFICIENT: only the owner or a steward revokes an agent'; end if;
  update public.agents set state = 'revoked', revoked_at = now(), revoked_reason = p_reason where id = p_agent;
  return public._mcp_ledger(p_actor, 'agent.revoked', null, jsonb_build_object('agent_id', p_agent, 'reason', p_reason));
end $$;

-- Gateway step 1: authenticate, check ceiling, quota, cost cap and K3 confirmation; open the call record.
create or replace function public.thread_agent_begin_call(p_token_hash text, p_tool text, p_input_hash text, p_authority_required public.authority_level,
  p_cost numeric, p_high_consequence boolean, p_confirmation uuid, p_method text default 'tools/call') returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.agents; n_min int; n_day int; spent numeric; c public.confirmation_tokens; cid uuid; code text; msg text; s bigint;
begin
  select * into a from public.agents where token_hash = p_token_hash;
  if a.id is null then return jsonb_build_object('refused', true, 'code', 'AGENT_UNAUTHENTICATED', 'explanation', 'unknown agent token'); end if;
  if a.state <> 'active' then return jsonb_build_object('refused', true, 'code', 'AGENT_REVOKED', 'explanation', 'this agent has been revoked'); end if;
  select count(*) filter (where started_at > now() - interval '1 minute'), count(*), coalesce(sum(cost), 0)
    into n_min, n_day, spent from public.agent_calls where agent_id = a.id and started_at > now() - interval '1 day';
  if public._authority_rank(p_authority_required) > public._authority_rank(a.authority_ceiling) then
    code := 'AUTHORITY_EXCEEDED'; msg := format('%s needs %s; this agent''s ceiling is %s', p_tool, p_authority_required, a.authority_ceiling);
  elsif n_min >= coalesce((a.quota->>'calls_per_minute')::int, 60) then code := 'QUOTA_EXCEEDED'; msg := 'calls per minute exceeded';
  elsif n_day >= coalesce((a.quota->>'calls_per_day')::int, 2000) then code := 'QUOTA_EXCEEDED'; msg := 'calls per day exceeded';
  elsif spent + coalesce(p_cost, 0) > a.cost_cap then code := 'COST_CAP_EXCEEDED'; msg := format('daily cost cap %s would be exceeded (spent %s)', a.cost_cap, spent);
  elsif p_high_consequence then
    select * into c from public.confirmation_tokens where id = p_confirmation;
    if c.id is null or c.agent_id <> a.id or c.tool <> p_tool or c.input_hash <> p_input_hash then
      code := 'CONFIRMATION_REQUIRED'; msg := 'this tool needs a structured confirmation token issued by a person for exactly this agent, tool and input';
    elsif c.consumed_at is not null then code := 'CONFIRMATION_REQUIRED'; msg := 'confirmation token already used';
    elsif c.expires_at < now() then code := 'CONFIRMATION_REQUIRED'; msg := 'confirmation token expired';
    end if;
  end if;
  insert into public.agent_calls (agent_id, tool, method, authority_used, input_hash, status, refusal_code, error, cost, confirmation_id, finished_at, duration_ms)
  values (a.id, p_tool, p_method, least_auth(p_authority_required, a.authority_ceiling), p_input_hash,
    case when code is null then 'running' else 'refused' end, code, msg, case when code is null then coalesce(p_cost, 0) else 0 end,
    case when code is null and p_high_consequence then c.id end,
    case when code is null then null else now() end, case when code is null then null else 0 end)
  returning id into cid;
  if code is not null then
    s := public._mcp_ledger(jsonb_build_object('kind','agent','id',coalesce(a.auth_user_id::text, a.id::text),'agent_id',a.id,'authority_used',p_authority_required),
      'mcp.call.refused', null, jsonb_build_object('call_id', cid, 'tool', p_tool, 'method', p_method, 'input_hash', p_input_hash, 'code', code, 'explanation', msg));
    update public.agent_calls set ledger_seq = s where id = cid;
    return jsonb_build_object('refused', true, 'code', code, 'explanation', msg, 'call_id', cid, 'ledger_seq', s);
  end if;
  if p_high_consequence then update public.confirmation_tokens set consumed_at = now(), consumed_call = cid where id = c.id; end if;
  return jsonb_build_object('refused', false, 'call_id', cid, 'agent', jsonb_build_object('id', a.id, 'name', a.name, 'auth_user_id', a.auth_user_id,
    'owner_id', a.owner_id, 'authority_ceiling', a.authority_ceiling));
end $$;

create or replace function public.least_auth(a public.authority_level, b public.authority_level) returns public.authority_level language sql immutable as $$
  select case when public._authority_rank(a) <= public._authority_rank(b) then a else b end $$;

-- Gateway step 2: close the call with its output hash and write the provenance record.
create or replace function public.thread_agent_end_call(p_call uuid, p_status text, p_output_hash text, p_error text, p_origin_tags jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare c public.agent_calls; a public.agents; s bigint;
begin
  select * into c from public.agent_calls where id = p_call;
  if c.id is null or c.status <> 'running' then raise exception 'CALL_NOT_RUNNING'; end if;
  select * into a from public.agents where id = c.agent_id;
  s := public._mcp_ledger(jsonb_build_object('kind','agent','id',coalesce(a.auth_user_id::text, a.id::text),'agent_id',a.id,'authority_used',c.authority_used),
    'mcp.tool_call', null, jsonb_build_object('call_id', c.id, 'agent_id', a.id, 'tool', c.tool, 'method', c.method, 'authority_used', c.authority_used,
      'input_hash', c.input_hash, 'output_hash', p_output_hash, 'status', p_status, 'error', p_error, 'origin_tags', coalesce(p_origin_tags, '[]'),
      'confirmation_id', c.confirmation_id, 'cost', c.cost));
  update public.agent_calls set status = p_status, output_hash = p_output_hash, error = p_error, origin_tags = coalesce(p_origin_tags, '[]'),
    ledger_seq = s, finished_at = now(), duration_ms = (extract(epoch from now() - c.started_at) * 1000)::int where id = p_call;
  return s;
end $$;

-- K3 structured confirmation: a person confirms exactly one agent + tool + input hash; single use, 15 minutes.
create or replace function public.thread_issue_confirmation(p_actor jsonb, p_agent uuid, p_tool text, p_input_hash text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.agents; uid uuid := (p_actor->>'id')::uuid; t public.confirmation_tokens; s bigint;
begin
  perform public._assert_actor(p_actor);
  if p_actor->>'kind' <> 'human' then raise exception 'HUMAN_REQUIRED: a confirmation token is produced by a person through K3, never inferred from text'; end if;
  select * into a from public.agents where id = p_agent and state = 'active';
  if a.id is null then raise exception 'AGENT_NOT_FOUND'; end if;
  if a.owner_id <> uid and not public.has_role(uid, 'steward') then raise exception 'AUTHORITY_INSUFFICIENT: only the agent''s owner or a steward confirms its actions'; end if;
  if coalesce(trim(p_reason), '') = '' or p_input_hash !~ '^[0-9a-f]{64}$' then raise exception 'CONFIRMATION_INVALID: reason and a sha-256 input hash are required'; end if;
  insert into public.confirmation_tokens (agent_id, tool, input_hash, reason, issued_by, expires_at)
  values (a.id, p_tool, p_input_hash, trim(p_reason), uid, now() + interval '15 minutes') returning * into t;
  s := public._mcp_ledger(p_actor || jsonb_build_object('authority_used','act_with_confirmation'), 'k3.confirmation.issued', null,
    jsonb_build_object('token_id', t.id, 'agent_id', a.id, 'tool', p_tool, 'input_hash', p_input_hash, 'reason', t.reason, 'expires_at', t.expires_at));
  update public.confirmation_tokens set ledger_seq = s where id = t.id;
  return jsonb_build_object('token_id', t.id, 'expires_at', t.expires_at, 'ledger_seq', s);
end $$;

create or replace function public.thread_sync_tool_contracts(p jsonb, p_version text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.tool_contracts (name, contract, version)
  select e->>'name', e, p_version from jsonb_array_elements(p) e
  on conflict (name) do update set contract = excluded.contract, version = excluded.version
  where public.tool_contracts.version is distinct from excluded.version;
  get diagnostics n = row_count;
  if n > 0 then perform public._mcp_ledger('{"kind":"system","id":"thread.mcp.gateway","authority_used":"observe"}', 'tool_contracts.synced', null,
    jsonb_build_object('version', p_version, 'changed', n, 'total', jsonb_array_length(p))); end if;
  return n;
end $$;

create or replace function public.thread_mcp_subscribe(p_agent uuid, p_topic text, p_object uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_on then insert into public.mcp_subscriptions (agent_id, topic, object_id) values (p_agent, p_topic, p_object) on conflict do nothing;
  else delete from public.mcp_subscriptions where agent_id = p_agent and topic = p_topic and object_id is not distinct from p_object; end if;
end $$;

create or replace function public.thread_mcp_take_notifications(p_agent uuid, p_limit int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  with t as (update public.agent_notifications set delivered_at = now()
    where id in (select id from public.agent_notifications where agent_id = p_agent and delivered_at is null order by id limit least(greatest(p_limit,1),200))
    returning id, topic, ledger_seq, object_id, body)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') into r from t;
  return r;
end $$;

-- A2A: every inter-agent message is recorded in the provenance chain and delivered only to the named agent.
create or replace function public.thread_a2a_message(p_from uuid, p_to uuid, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare f public.agents; t public.agents;
begin
  select * into f from public.agents where id = p_from and state = 'active';
  select * into t from public.agents where id = p_to and state = 'active';
  if f.id is null or t.id is null then raise exception 'AGENT_NOT_FOUND: both agents must be active'; end if;
  if not exists (select 1 from public.mcp_subscriptions where agent_id = t.id and topic = 'a2a') then
    insert into public.mcp_subscriptions (agent_id, topic) values (t.id, 'a2a') on conflict do nothing;
  end if;
  return public._mcp_ledger(jsonb_build_object('kind','agent','id',coalesce(f.auth_user_id::text,f.id::text),'agent_id',f.id,'authority_used','observe'),
    'a2a.message', null, jsonb_build_object('from_agent', f.id, 'to_agent', t.id, 'intent', p->>'intent', 'object_refs', coalesce(p->'object_refs','[]'),
      'content_origin', 'agent_message_data'));
end $$;

-- Injection attempts become detector findings with an owner.
insert into public.detectors (key, family, owner_id, schedule, event_triggers, params, version)
select 'InstructionInjectionAttempt', 'agent_surface', owner_id, null, array['mcp.tool_call'], '{"layers":[3,4]}', '1' from public.detectors where key = 'GraphOrphan'
on conflict (key) do nothing;

create or replace function public.thread_record_injection(p_call uuid, p_findings jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.agent_calls; fid uuid := gen_random_uuid(); own uuid;
begin
  select * into c from public.agent_calls where id = p_call;
  select owner_id into own from public.detectors where key = 'InstructionInjectionAttempt';
  insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence)
  values (fid, 'InstructionInjectionAttempt', null, 'high', own, 'open',
    jsonb_build_object('call_id', p_call, 'agent_id', c.agent_id, 'tool', c.tool, 'input_hash', c.input_hash, 'findings', p_findings));
  perform public._mcp_ledger('{"kind":"system","id":"thread.mcp.injection_defence","authority_used":"observe"}', 'injection.blocked', null,
    jsonb_build_object('finding_id', fid, 'call_id', p_call, 'agent_id', c.agent_id, 'tool', c.tool, 'rules', p_findings));
  return fid;
end $$;

do $$ declare f text; begin
  foreach f in array array['thread_register_agent(jsonb,jsonb)','thread_revoke_agent(jsonb,uuid,text)',
    'thread_agent_begin_call(text,text,text,authority_level,numeric,boolean,uuid,text)','thread_agent_end_call(uuid,text,text,text,jsonb)',
    'thread_issue_confirmation(jsonb,uuid,text,text,text)','thread_sync_tool_contracts(jsonb,text)','thread_mcp_subscribe(uuid,text,uuid,boolean)',
    'thread_mcp_take_notifications(uuid,integer)','thread_a2a_message(uuid,uuid,jsonb)','thread_record_injection(uuid,jsonb)','_mcp_ledger(jsonb,text,uuid,jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
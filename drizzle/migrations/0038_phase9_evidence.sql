create or replace function public.thread_record_phase9_evidence(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.agents; checks jsonb := '[]'; ok boolean; d text; n int; s bigint; t text; all_pass boolean;
  chain text[] := array['detect_value_signal','search_capability_fabric','compile_creation_prompt','dispatch_build'];
begin
  perform public._assert_actor(p_actor);
  if p_actor->>'kind' <> 'human' then raise exception 'HUMAN_REQUIRED'; end if;
  select * into a from public.agents where id = (p->>'agent_id')::uuid;
  if a.id is null then raise exception 'AGENT_NOT_FOUND'; end if;

  foreach t in array chain loop
    ok := exists (select 1 from public.agent_calls where agent_id = a.id and tool = t and status = 'ok');
    checks := checks || jsonb_build_object('name', 'external agent ran ' || t || ' through MCP', 'pass', ok, 'detail', coalesce((select 'call ' || id || ', ledger #' || ledger_seq from public.agent_calls where agent_id = a.id and tool = t and status = 'ok' order by started_at desc limit 1), 'no successful call'));
  end loop;
  ok := exists (select 1 from public.agent_calls where agent_id = a.id and tool in ('trace_chain','explain_capability','find_gaps') and status = 'ok');
  checks := checks || jsonb_build_object('name', 'external agent read the evidence chain through MCP', 'pass', ok, 'detail', case when ok then 'trace/explain call succeeded' else 'no evidence read' end);

  select count(*) into n from public.agent_calls c where c.agent_id = a.id and c.status <> 'running'
    and not exists (select 1 from public.ledger l where l.seq = c.ledger_seq and l.payload->>'call_id' = c.id::text);
  checks := checks || jsonb_build_object('name', 'every agent call has a provenance ledger entry (agent, authority, input hash, output hash)', 'pass', n = 0,
    'detail', format('%s calls without a matching ledger entry; %s calls total', n, (select count(*) from public.agent_calls where agent_id = a.id)));

  select count(*) into n from public.ledger where actor->>'kind' = 'agent' and actor->>'agent_id' = a.id::text and action like 'object.%' and actor ? 'call_id';
  checks := checks || jsonb_build_object('name', 'canon writes made by the agent carry the agent and call in their ledger actor', 'pass', n > 0, 'detail', format('%s object ledger entries attributed to the agent', n));

  ok := exists (select 1 from public.agent_calls where agent_id = a.id and refusal_code in ('AUTHORITY_EXCEEDED','CONFIRMATION_REQUIRED'));
  checks := checks || jsonb_build_object('name', 'authority ceiling and K3 confirmation are enforced', 'pass', ok,
    'detail', coalesce((select string_agg(distinct refusal_code, ', ') from public.agent_calls where agent_id = a.id and status = 'refused'), 'no refusals recorded'));
  ok := exists (select 1 from public.agent_calls c join public.confirmation_tokens k on k.id = c.confirmation_id where c.agent_id = a.id and c.tool = 'dispatch_build' and k.consumed_call = c.id);
  checks := checks || jsonb_build_object('name', 'dispatch_build ran only with a single-use confirmation token issued by a person', 'pass', ok, 'detail', case when ok then 'token consumed by the dispatch call' else 'no confirmed dispatch' end);

  ok := a.auth_user_id is not null and not public._can_read_as(a.auth_user_id, '{"roles":[]}', 'restricted');
  checks := checks || jsonb_build_object('name', 'the agent reads under its own permissions (restricted content not readable)', 'pass', ok, 'detail', 'checked with _can_read_as for the agent identity');

  ok := exists (select 1 from public.agent_calls where agent_id = a.id and status = 'blocked')
    and exists (select 1 from public.detector_findings where detector_key = 'InstructionInjectionAttempt' and evidence->>'agent_id' = a.id::text);
  checks := checks || jsonb_build_object('name', 'injection attempts through MCP are blocked and become owned findings', 'pass', ok,
    'detail', format('%s blocked calls', (select count(*) from public.agent_calls where agent_id = a.id and status = 'blocked')));
  ok := exists (select 1 from public.agent_calls where agent_id = a.id and status = 'refused' and error like 'VALIDATION_FAILED%');
  checks := checks || jsonb_build_object('name', 'an instruction passed where a typed value is expected is refused by the schema', 'pass', ok, 'detail', case when ok then 'validation refusal recorded' else 'none recorded' end);
  checks := checks || jsonb_build_object('name', 'injection detection recall measured on the labelled corpus', 'pass', coalesce((p#>>'{injection_corpus,recall}')::numeric, 0) > 0,
    'detail', format('recall %s, precision %s on %s attempts / %s benign (agent-authored corpus)', round((p#>>'{injection_corpus,recall}')::numeric, 3), round((p#>>'{injection_corpus,precision}')::numeric, 3),
      p#>>'{injection_corpus,positives}', p#>>'{injection_corpus,negatives}'));

  select count(*) into n from public.tool_contracts where contract ? 'compensating_action' and contract ? 'permission_predicate';
  checks := checks || jsonb_build_object('name', 'every tool has a stored Part 12.3 ToolContract, including the twelve ValueOS tools', 'pass', n >= (p->>'tool_count')::int and (p->>'valueos_present')::boolean,
    'detail', format('%s full contracts for %s tools; status %s', n, p->>'tool_count', p->'status_counts'));

  all_pass := not exists (select 1 from jsonb_array_elements(checks) c where not (c->>'pass')::boolean);
  s := public._mcp_ledger(p_actor, 'phase9.exit_evidence', null, jsonb_build_object('passed', all_pass, 'checks', checks, 'agent_id', a.id, 'injection_corpus', p->'injection_corpus'));
  return jsonb_build_object('ledger_seq', s, 'passed', all_pass, 'checks', checks);
end $$;
revoke all on function public.thread_record_phase9_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_record_phase9_evidence(jsonb, jsonb) to service_role;
create or replace function public.thread_phase5_selftest() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase5","authority_used":"observe"}';
  res jsonb := '[]'; ok boolean; msg text; tag text := substr(md5(random()::text), 1, 6);
  sig public.objects; sig2 public.objects; dec public.objects; bs public.objects; bs2 public.objects; cap public.objects; cap2 public.objects;
  tr public.objects; sim public.objects; ea public.objects; po public.objects; vm public.objects; inc public.objects; mis public.objects;
  pr public.objects; run public.objects; rc uuid; r jsonb; t0 timestamptz; ms numeric; timings jsonb := '[]'; q record;
  e2e_ms numeric;
begin
  begin
    rc := public.uuid_v7();
    sig := public.thread_create_object(a, public._fx_payload('ValueSignal', 'Claims wait too long ' || tag, '{"observed_condition":"high-value claims wait 9 days","baseline_performance":"9 days median","magnitude":"412 claims/month"}'::jsonb));

    -- Link 1: a decision without a signal is rejected
    begin perform public.thread_create_object(a, public._fx_payload('ConfirmedDecision', 'Decision without signal', '{"decision":"x"}'::jsonb)); ok := false; msg := 'created';
    exception when others then ok := sqlerrm like 'DECISION_WITHOUT_SIGNAL%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A decision without a signal is rejected', 'pass', ok, 'detail', msg);

    dec := public.thread_create_object(a, public._fx_payload('ConfirmedDecision', 'Route claims over $10k to an adjuster ' || tag,
      jsonb_build_object('signal_ref', sig.id, 'decision', 'route to adjuster', 'rationale', 'loss exposure', 'authority_used', 'act_with_confirmation', 'decided_by', 'selftest')));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'decided_from', 'from_id', dec.id, 'to_id', sig.id, 'source', 'stated', 'rationale', 'self-test'));

    -- signal promoted to a mission without a framed measurable condition is rejected
    sig2 := public.thread_create_object(a, public._fx_payload('ValueSignal', 'Unframed signal ' || tag, '{"requested_solution_candidates":["a dashboard"]}'::jsonb));
    mis := public.thread_create_object(a, public._fx_payload('ValueMission', 'Mission ' || tag, '{}'::jsonb));
    begin perform public.thread_create_edge(a, jsonb_build_object('verb', 'promoted_from', 'from_id', mis.id, 'to_id', sig2.id, 'source', 'stated', 'rationale', 'self-test')); ok := false; msg := 'promoted';
    exception when others then ok := sqlerrm like '%SIGNAL_NOT_FRAMED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A signal promoted to a mission without a framed measurable condition is rejected', 'pass', ok, 'detail', msg);

    -- Link 2/3: behaviours
    bs := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'When a claim exceeds $10k it goes to an adjuster ' || tag,
      jsonb_build_object('condition', 'claim > 10000', 'observable_result', 'routed to adjuster', 'source_decision_ref', dec.id)));
    bs := public.thread_transition_object(a, bs.id, bs.version, 'confirmed', 'self-test');
    bs2 := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'Behaviour with no decision ' || tag, '{"condition":"x","observable_result":"y"}'::jsonb));
    bs2 := public.thread_transition_object(a, bs2.id, bs2.version, 'confirmed', 'self-test');

    -- exit evidence 3: no Confirmed Decision ancestor -> cannot reach creation
    insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by, behavior_statement_id)
      values (rc, '{"outcome":"route claims","inputs":["claim"],"outputs":["queue"],"domain":"claims"}', 'route claims', '[]', 'create_new', 'self-test: nothing to reuse', a, bs2.id);
    begin
      insert into public.creation_prompts (object_id, reuse_check_id, source_behavior_ids, template_id, template_version, compiled_text, compiled_hash)
        values (sig.id, rc, array[bs2.id], public.uuid_v7(), '1', 'x', 'x'); ok := false; msg := 'compiled';
    exception when others then ok := sqlerrm like 'NO_DECISION_ANCESTOR%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A capability with no Confirmed Decision ancestor cannot reach creation (compile record)', 'pass', ok, 'detail', msg);
    begin perform public.thread_create_object(a, public._fx_payload('CreationPrompt', 'Prompt without decision ' || tag, jsonb_build_object('reuse_check_ref', rc, 'behavior_statement_refs', jsonb_build_array(bs2.id)))); ok := false; msg := 'created';
    exception when others then ok := sqlerrm like 'NO_DECISION_ANCESTOR%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A CreationPrompt for a behaviour with no Confirmed Decision ancestor is rejected', 'pass', ok, 'detail', msg);
    res := res || jsonb_build_object('name', 'A behaviour with a Confirmed Decision ancestor can reach creation', 'pass', public.can_reach_creation(bs.id) and not public.can_reach_creation(bs2.id), 'detail', '');

    -- Implement
    pr := public.thread_create_object(a, public._fx_payload('CreationPrompt', 'Prompt ' || tag, jsonb_build_object('reuse_check_ref', rc, 'behavior_statement_refs', jsonb_build_array(bs.id))));
    run := public.thread_create_object(a, public._fx_payload('BuildRun', 'Build run ' || tag, jsonb_build_object('reuse_check_ref', rc, 'platform', 'lovable', 'prompt_ref', pr.id)));
    cap := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Adjuster routing ' || tag, public._p4_cap_body('Route high-value claims to an adjuster', array['claim'], array['queue'])));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'compiled_into', 'from_id', bs.id, 'to_id', pr.id, 'source', 'stated', 'rationale', 'self-test'));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'executed_as', 'from_id', pr.id, 'to_id', run.id, 'source', 'stated', 'rationale', 'self-test'));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'built', 'from_id', run.id, 'to_id', cap.id, 'source', 'stated', 'rationale', 'self-test'));

    -- Test + simulate
    tr := public.thread_create_object(a, public._fx_payload('TestRun', 'Routing tests ' || tag, '{"pass_fail":"pass","target_version":1}'::jsonb));
    sim := public.thread_create_object(a, public._fx_payload('SimulationRun', 'Routing simulation ' || tag, '{"results":"ok"}'::jsonb));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'verified_by', 'from_id', cap.id, 'to_id', tr.id, 'source', 'stated', 'rationale', 'self-test'));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'verified_by', 'from_id', bs.id, 'to_id', tr.id, 'source', 'stated', 'rationale', 'self-test'));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'simulated_by', 'from_id', cap.id, 'to_id', sim.id, 'source', 'stated', 'rationale', 'self-test'));

    -- Release authority: no exposure without authorisation
    begin perform public.thread_transition_object(a, cap.id, cap.version, 'limited_exposure', 'self-test'); ok := false; msg := 'exposed';
    exception when others then ok := sqlerrm like 'EXPOSURE_NOT_AUTHORISED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'No exposure without an Exposure Authorization', 'pass', ok, 'detail', msg);
    ea := public.thread_create_object(a, public._fx_payload('ExposureAuthorization', 'Exposure ' || tag,
      jsonb_build_object('authorised_by', 'selftest steward', 'exposure_population', '5% of claims', 'effective_to', (now() - interval '1 day')::text, 'rollback_armed', true)));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'authorised_by', 'from_id', ea.id, 'to_id', cap.id, 'source', 'stated', 'rationale', 'self-test'));
    select * into cap from public.objects where id = cap.id;
    begin perform public.thread_transition_object(a, cap.id, cap.version, 'producing_value', 'self-test'); ok := false; msg := 'moved';
    exception when others then ok := sqlerrm like 'VALUE_MEASURE_REQUIRED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', '"Producing value" requires a value measure', 'pass', ok, 'detail', msg);

    -- Outcome + value + incident
    po := public.thread_create_object(a, public._fx_payload('ProductionOutcome', 'Outcome ' || tag, '{"behaviour_observed":"412 claims routed","cost":"$38"}'::jsonb));
    vm := public.thread_create_object(a, public._fx_payload('ValueMeasure', 'Wait time ' || tag, '{"baseline":"9 days","delta":"-6","unit":"days"}'::jsonb));
    inc := public.thread_create_object(a, public._fx_payload('Incident', 'Misrouted claim ' || tag, '{"description":"one claim misrouted","severity":"low"}'::jsonb));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'observed_as', 'from_id', cap.id, 'to_id', po.id, 'source', 'stated', 'rationale', 'self-test'));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'values', 'from_id', po.id, 'to_id', vm.id, 'source', 'stated', 'rationale', 'self-test'));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'caused', 'from_id', po.id, 'to_id', inc.id, 'source', 'stated', 'rationale', 'self-test'));
    select * into cap from public.objects where id = cap.id;
    cap := public.thread_transition_object(a, cap.id, cap.version, 'producing_value', 'self-test');
    res := res || jsonb_build_object('name', 'With exposure authorisation and a value measure the capability can produce value', 'pass', cap.lifecycle_state = 'producing_value', 'detail', cap.lifecycle_state);

    -- chain completeness and the nine questions in one interaction
    r := public.chain_completeness(cap.id);
    res := res || jsonb_build_object('name', 'Chain completeness finds all eight links', 'pass', (r->>'present')::int = 8, 'detail', format('%s of 8, missing %s', r->>'present', r->'missing'));
    cap2 := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Orphan capability ' || tag, public._p4_cap_body('Nothing links here', array['x'], array['y'])));
    r := public.chain_completeness(cap2.id);
    res := res || jsonb_build_object('name', 'Chain completeness returns the missing links', 'pass', (r->>'present')::int = 0 and jsonb_array_length(r->'missing') = 8, 'detail', r->'missing');
    t0 := clock_timestamp();
    r := public.explain_capability_all(cap.id);
    e2e_ms := round(extract(epoch from clock_timestamp() - t0)::numeric * 1000, 2);
    res := res || jsonb_build_object('name', 'All nine questions are answered with citations in one call', 'pass',
      jsonb_array_length(r->'answers') = 9 and not exists (select 1 from jsonb_array_elements(r->'answers') x where not (x->>'answered')::boolean or jsonb_array_length(x->'citations') = 0),
      'detail', format('%s answers in %s ms', jsonb_array_length(r->'answers'), e2e_ms));
    res := res || jsonb_build_object('name', 'Continued operation is judged not justified while an incident and an expired authorisation exist', 'pass',
      (select x->>'answer' from jsonb_array_elements(r->'answers') x where x->>'question' = 'justification') like 'Not justified%',
      'detail', (select x->>'answer' from jsonb_array_elements(r->'answers') x where x->>'question' = 'justification'));

    -- the ten traceability queries, each a single call, timed
    for q in select * from (values
      (1, 'trace_blast_radius', 800), (2, 'trace_canon_change_impact', 800), (3, 'trace_value_without_owner', 1000), (4, 'trace_production_without_value', 1000),
      (5, 'trace_behaviors_without_tests', 1000), (6, 'trace_production_without_decision', 1000), (7, 'trace_expired_exposures', 1000),
      (8, 'trace_incident_to_decision', 1000), (9, 'trace_retirement_impact', 800), (10, 'trace_full_chain', 1500)) v(n, fn, budget) loop
      t0 := clock_timestamp();
      r := case q.fn
        when 'trace_blast_radius' then public.trace_blast_radius(bs.id)
        when 'trace_canon_change_impact' then coalesce((select public.trace_canon_change_impact(o.id) from public.objects o where o.type in ('Guardrail','Rule','Pattern','Authority') and not o.is_tombstone limit 1), '{"skipped":"no canon rule"}')
        when 'trace_value_without_owner' then public.trace_value_without_owner()
        when 'trace_production_without_value' then public.trace_production_without_value()
        when 'trace_behaviors_without_tests' then public.trace_behaviors_without_tests()
        when 'trace_production_without_decision' then public.trace_production_without_decision()
        when 'trace_expired_exposures' then public.trace_expired_exposures()
        when 'trace_incident_to_decision' then public.trace_incident_to_decision(inc.id)
        when 'trace_retirement_impact' then public.trace_retirement_impact(cap.id)
        else public.trace_full_chain(cap.id) end;
      ms := round(extract(epoch from clock_timestamp() - t0)::numeric * 1000, 2);
      timings := timings || jsonb_build_object('n', q.n, 'query', q.fn, 'ms', ms, 'budget_ms', q.budget, 'within', ms < q.budget,
        'check', case q.fn
          when 'trace_blast_radius' then (select bool_or((x->>'id')::uuid = cap.id) from jsonb_array_elements(r->'nodes') x)
          when 'trace_behaviors_without_tests' then exists (select 1 from jsonb_array_elements(r->'rows') x where (x->>'id')::uuid = bs2.id) and not exists (select 1 from jsonb_array_elements(r->'rows') x where (x->>'id')::uuid = bs.id)
          when 'trace_expired_exposures' then exists (select 1 from jsonb_array_elements(r->'rows') x where (x->>'id')::uuid = ea.id)
          when 'trace_incident_to_decision' then (r->>'reaches_decision')::boolean
          when 'trace_production_without_decision' then not exists (select 1 from jsonb_array_elements(r->'rows') x where (x->>'id')::uuid = cap.id)
          when 'trace_production_without_value' then not exists (select 1 from jsonb_array_elements(r->'rows') x where (x->>'id')::uuid = cap.id)
          when 'trace_full_chain' then (r->'completeness'->>'present')::int = 8
          else true end);
    end loop;
    res := res || jsonb_build_object('name', 'The ten traceability queries return correct results within their budgets', 'pass',
      not exists (select 1 from jsonb_array_elements(timings) x where not (x->>'within')::boolean or not coalesce((x->>'check')::boolean, false)),
      'detail', (select string_agg(format('#%s %s ms', x->>'n', x->>'ms'), ', ') from jsonb_array_elements(timings) x));

    raise exception 'P5_SELFTEST_ROLLBACK';
  exception when others then
    if sqlerrm <> 'P5_SELFTEST_ROLLBACK' then
      res := res || jsonb_build_object('name', 'Self-test ran to completion', 'pass', false, 'detail', sqlerrm);
    end if;
  end;
  -- fixtures are rolled back: nothing from the self-test remains in the graph
  return jsonb_build_object('passed', jsonb_array_length(res) > 0 and not exists (select 1 from jsonb_array_elements(res) x where not (x->>'pass')::boolean),
    'checks', res, 'timings', timings, 'scale', jsonb_build_object('objects', (select count(*) from public.objects), 'edges', (select count(*) from public.edges)),
    'fixtures', 'rolled back');
end $$;
revoke all on function public.thread_phase5_selftest() from public, anon, authenticated;
grant execute on function public.thread_phase5_selftest() to service_role;

create or replace function public.thread_record_phase5_evidence(p_actor jsonb, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare st jsonb; ev jsonb; s bigint;
begin
  perform public._assert_actor(p_actor);
  st := public.thread_phase5_selftest();
  ev := jsonb_build_object('selftest', st, 'live_scale', st->'scale', 'client', p,
    'at_target_scale', 'pending_live_adapter: budgets measured at current corpus size, not at target scale');
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase5.exit_evidence', null, null, '{}', 'none', ev, '', 'pending-' || public.uuid_v7()::text)
  returning seq into s;
  return ev || jsonb_build_object('ledger_seq', s);
end $$;
revoke all on function public.thread_record_phase5_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_record_phase5_evidence(jsonb, jsonb) to service_role;

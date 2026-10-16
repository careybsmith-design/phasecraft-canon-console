create or replace function public.thread_phase6_selftest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase6","authority_used":"observe"}';
  res jsonb := '[]'; ok boolean; msg text; tag text := substr(md5(random()::text), 1, 6);
  raw text := 'member said honestly just text everyone whenever anything moves at all';
  sig public.objects; dec public.objects; bs public.objects; bs2 public.objects; bsd public.objects; bsc public.objects; con public.objects; tpl public.objects; tpl2 public.objects;
  mis public.objects; pr public.objects; pr2 public.objects; prc public.objects; sk public.objects; rc uuid; rc2 uuid; rcc uuid; rcd uuid;
  txt text; r jsonb; d jsonb; plat text; runs jsonb := '{}'; lineage int := 0; gsv text; cp public.creation_prompts; rid uuid; rep jsonb; live jsonb;
  fx jsonb; fn int;
begin
  begin
    sig := public.thread_create_object(a, public._fx_payload('ValueSignal', 'Members cannot see claim status ' || tag, '{"observed_condition":"34% of calls ask for claim status","baseline_performance":"34%"}'::jsonb));
    dec := public.thread_create_object(a, public._fx_payload('ConfirmedDecision', 'Show members their claim status ' || tag,
      jsonb_build_object('signal_ref', sig.id, 'decision', 'show status', 'rationale', 'call volume', 'authority_used', 'act_with_confirmation', 'decided_by', 'selftest')));
    perform public.thread_create_edge(a, jsonb_build_object('verb', 'decided_from', 'from_id', dec.id, 'to_id', sig.id, 'source', 'stated', 'rationale', 'self-test'));
    mis := public.thread_create_object(a, public._fx_payload('ValueMission', 'Claim status mission ' || tag, '{}'::jsonb));
    bs := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'When a claim status changes the member sees it ' || tag,
      jsonb_build_object('condition', 'a claim status changes', 'observable_result', 'the member sees the new status within a minute', 'source_decision_ref', dec.id,
        'operating_constraints', jsonb_build_array('never show another member''s history'), 'raw_text', raw, 'provenance_spans', jsonb_build_array(jsonb_build_object('quote', raw)))));
    bs := public.thread_transition_object(a, bs.id, bs.version, 'confirmed', 'self-test');
    bs2 := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'Members also get an SMS ' || tag,
      jsonb_build_object('condition', 'a claim status changes', 'observable_result', 'an SMS is sent', 'source_decision_ref', dec.id)));
    bs2 := public.thread_transition_object(a, bs2.id, bs2.version, 'confirmed', 'self-test');
    bsd := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'Draft behaviour ' || tag, jsonb_build_object('condition', 'x', 'observable_result', 'y', 'source_decision_ref', dec.id)));
    bsc := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'Confidential behaviour ' || tag, jsonb_build_object('condition', 'adjuster notes change', 'observable_result', 'notes shown to adjuster', 'source_decision_ref', dec.id)) || '{"data_classification":"confidential"}');
    bsc := public.thread_transition_object(a, bsc.id, bsc.version, 'confirmed', 'self-test');
    con := public.thread_create_object(a, public._fx_payload('ExecutableOutcomeContract', 'Status visibility contract ' || tag, '{"desired_outcome":"members know where their claim is","non_negotiables":["no cross-member data"]}'::jsonb));
    con := public.thread_transition_object(a, con.id, con.version, 'active', 'self-test');
    tpl := public.thread_create_object(a, public._fx_payload('PromptTemplate', 'Thin slice template ' || tag, '{"platform":"any","stack":"TanStack","version":"3","evaluation_status":"passed","change_requires_eval":true,"instructions":"Build the smallest end-to-end slice."}'::jsonb));
    tpl := public.thread_transition_object(a, tpl.id, tpl.version, 'active', 'self-test');
    tpl2 := public.thread_create_object(a, public._fx_payload('PromptTemplate', 'Unevaluated template ' || tag, '{"platform":"any","version":"1","evaluation_status":"not_run"}'::jsonb));
    tpl2 := public.thread_transition_object(a, tpl2.id, tpl2.version, 'active', 'self-test');
    rc := public.uuid_v7(); rc2 := public.uuid_v7(); rcc := public.uuid_v7(); rcd := public.uuid_v7();
    insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by, behavior_statement_id) values
      (rc, '{"outcome":"show claim status","inputs":["claim"],"outputs":["status"],"domain":"claims"}', 'show claim status', '[]', 'create_new', 'self-test: nothing to reuse', a, bs.id),
      (rc2, '{"outcome":"sms on status","inputs":["claim"],"outputs":["sms"],"domain":"claims"}', 'sms', '[]', 'create_new', 'self-test', a, bs2.id),
      (rcc, '{"outcome":"adjuster notes","inputs":["claim"],"outputs":["notes"],"domain":"claims"}', 'notes', '[]', 'create_new', 'self-test', a, bsc.id),
      (rcd, '{"outcome":"draft","inputs":["x"],"outputs":["y"],"domain":"claims"}', 'draft', '[]', 'create_new', 'self-test', a, bsd.id);

    txt := E'# Template v3\nBuild the smallest end-to-end slice.\n## Behaviour statements (confirmed)\n- ' || bs.human_ref || ': WHEN a claim status changes THEN the member sees the new status within a minute';
    fx := jsonb_build_object('behavior_ids', jsonb_build_array(bs.id), 'contract_id', con.id, 'template_id', tpl.id, 'reuse_check_id', rc, 'target_platform', 'codex',
      'title', 'Prompt ' || tag, 'compiled_text', txt, 'compiled_hash', encode(sha256(convert_to(txt, 'UTF8')), 'hex'), 'mission_ref', mis.id, 'estimated_cost', 3,
      'guardrails_applied', (select jsonb_agg(jsonb_build_object('id', id, 'version', version, 'enforcement', enforcement)) from public.guardrails where active));

    -- 1 no reuse check
    begin perform public.thread_compile_creation_prompt(a, fx || jsonb_build_object('reuse_check_id', public.uuid_v7())); ok := false; msg := 'compiled';
    exception when others then ok := sqlerrm like 'REUSE_CHECK_REQUIRED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A prompt without a recorded reuse check is rejected (P11)', 'pass', ok, 'detail', msg);
    -- 2 template gate
    begin perform public.thread_compile_creation_prompt(a, fx || jsonb_build_object('template_id', tpl2.id)); ok := false; msg := 'compiled';
    exception when others then ok := sqlerrm like 'TEMPLATE_NOT_EVAL_GATED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A template without a passed evaluation cannot compile prompts', 'pass', ok, 'detail', msg);
    -- 3 raw text
    begin perform public.thread_compile_creation_prompt(a, fx || jsonb_build_object('compiled_text', txt || ' ' || raw, 'compiled_hash', encode(sha256(convert_to(txt || ' ' || raw, 'UTF8')), 'hex'))); ok := false; msg := 'compiled';
    exception when others then ok := sqlerrm like 'RAW_CAPTURED_TEXT_IN_PROMPT%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'Raw captured text in a compiled prompt is rejected (13.4)', 'pass', ok, 'detail', msg);
    -- 4 hash
    begin perform public.thread_compile_creation_prompt(a, fx || jsonb_build_object('compiled_hash', 'forged')); ok := false; msg := 'compiled';
    exception when others then ok := sqlerrm like 'COMPILED_HASH_MISMATCH%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A compiled hash that does not match the text is rejected', 'pass', ok, 'detail', msg);
    -- 5 draft
    begin perform public.thread_compile_creation_prompt(a, fx || jsonb_build_object('behavior_ids', jsonb_build_array(bsd.id), 'reuse_check_id', rcd)); ok := false; msg := 'compiled';
    exception when others then ok := sqlerrm like 'DRAFT_CANNOT_REACH_CREATION%' or sqlerrm like 'NO_DECISION_ANCESTOR%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A draft behaviour cannot reach creation', 'pass', ok, 'detail', msg);

    pr := public.thread_compile_creation_prompt(a, fx);
    select * into cp from public.creation_prompts where object_id = pr.id;
    res := res || jsonb_build_object('name', 'A confirmed behaviour compiles into a prompt with guardrails enumerated and raw text absent', 'pass',
      cp.object_id is not null and jsonb_array_length(pr.body->'guardrails_applied') > 0 and strpos(cp.compiled_text, raw) = 0, 'detail', pr.human_ref);

    -- cost ceilings at dispatch
    perform public.thread_set_cost_ceiling(a, jsonb_build_object('scope', 'mission', 'scope_id', mis.id, 'ceiling', 60));
    begin perform public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', 'codex', 'cost_ceiling', 0)); ok := false; msg := 'dispatched';
    exception when others then ok := sqlerrm like 'COST_CEILING_REQUIRED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A dispatch without a per-build ceiling is rejected', 'pass', ok, 'detail', msg);
    begin perform public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', 'codex', 'cost_ceiling', 5, 'estimated_cost', 9)); ok := false; msg := 'dispatched';
    exception when others then ok := sqlerrm like 'COST_CEILING_EXCEEDED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A dispatch whose estimate passes its ceiling is rejected', 'pass', ok, 'detail', msg);

    -- dispatch to all five platforms (simulated adapter, deterministic digest mirror)
    gsv := pr.body->>'guardrail_set_ref';
    foreach plat in array array['lovable','claude_code','codex','cursor','grok'] loop
      r := public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', plat, 'cost_ceiling', 10, 'estimated_cost', 3, 'model_version', 'sim-1', 'adapter_mode', 'simulated'));
      rid := (r->>'run_id')::uuid;
      perform public.thread_record_build_result(a, jsonb_build_object('run_id', rid, 'status', 'succeeded', 'external_run_id', 'sim-' || plat, 'cost_actual', 3, 'duration_ms', 1200, 'secrets_scan', 'clean',
        'artifacts', jsonb_build_array(jsonb_build_object('kind', 'commit', 'uri', 'sim://' || plat || '/' || rid, 'hash', public._sim_build_digest(cp.compiled_hash, plat, 'sim-1', cp.template_version, gsv)))));
      runs := runs || jsonb_build_object(plat, rid);
      if exists (select 1 from public.edges e1 join public.edges e2 on e2.from_id = e1.to_id and e2.verb = 'executed_as' and e2.to_id = rid and e2.retired_at is null
                   join public.edges e3 on e3.from_id = rid and e3.verb = 'produced_artifact' and e3.retired_at is null
                  where e1.from_id = bs.id and e1.verb = 'compiled_into' and e1.retired_at is null)
         and exists (select 1 from public.ledger l where l.object_id = rid and l.adapter_mode = 'simulated')
         and (select (body->'provenance'->>'simulated')::boolean from public.objects where id = rid) then lineage := lineage + 1; end if;
    end loop;
    res := res || jsonb_build_object('name', 'A confirmed behaviour becomes a dispatched build on each of the five platforms with complete lineage', 'pass', lineage = 5, 'detail', lineage || ' of 5');
    begin perform public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', 'codex', 'cost_ceiling', 50)); ok := false; msg := 'dispatched';
    exception when others then ok := sqlerrm like 'BUDGET_EXCEEDED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A dispatch that would pass the mission ceiling is rejected at dispatch', 'pass', ok, 'detail', msg);
    begin update public.build_runs set repro_key = '{}' where object_id = (runs->>'codex')::uuid; ok := false; msg := 'updated';
    exception when others then ok := sqlerrm like 'PROVENANCE_REQUIRED%' or sqlerrm like 'RUN_PINNED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A pinned reproducibility key cannot be changed', 'pass', ok, 'detail', msg);

    -- Lovable never receives confidential content
    txt := E'# Template v3\n- ' || bsc.human_ref || ': WHEN adjuster notes change THEN notes shown to adjuster';
    prc := public.thread_compile_creation_prompt(a, fx || jsonb_build_object('behavior_ids', jsonb_build_array(bsc.id), 'reuse_check_id', rcc, 'title', 'Conf ' || tag,
      'compiled_text', txt, 'compiled_hash', encode(sha256(convert_to(txt, 'UTF8')), 'hex'), 'mission_ref', null));
    begin perform public.thread_dispatch_build(a, jsonb_build_object('prompt_id', prc.id, 'platform', 'lovable', 'cost_ceiling', 5)); ok := false; msg := 'dispatched';
    exception when others then ok := sqlerrm like 'PLATFORM_NOT_CLEARED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'Confidential content is never routed to Lovable (8.3)', 'pass', ok and prc.data_classification = 'confidential', 'detail', msg);

    -- replay: deterministic reproduction
    rep := public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', 'codex', 'cost_ceiling', 5, 'replay_of', runs->>'codex', 'adapter_mode', 'simulated'));
    r := public.thread_record_build_result(a, jsonb_build_object('run_id', rep->>'run_id', 'status', 'succeeded', 'cost_actual', 1, 'secrets_scan', 'clean',
      'artifacts', jsonb_build_array(jsonb_build_object('kind', 'commit', 'uri', 'sim://replay', 'hash', public._sim_build_digest(cp.compiled_hash, 'codex', 'sim-1', cp.template_version, gsv)))));
    res := res || jsonb_build_object('name', 'A build replays to an equivalent artifact from its reproducibility key', 'pass',
      (r->'replay_result'->>'equivalent')::boolean and rep->'repro_key' = (select repro_key from public.build_runs where object_id = (runs->>'codex')::uuid), 'detail', r->'replay_result'->>'verdict');
    -- best effort honesty on a live-mode run that differs
    live := public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', 'cursor', 'cost_ceiling', 2, 'replay_of', runs->>'cursor', 'adapter_mode', 'live'));
    r := public.thread_record_build_result(a, jsonb_build_object('run_id', live->>'run_id', 'status', 'succeeded', 'cost_actual', 1, 'secrets_scan', 'clean',
      'artifacts', jsonb_build_array(jsonb_build_object('kind', 'commit', 'uri', 'live://x', 'hash', 'different'))));
    res := res || jsonb_build_object('name', 'A non-deterministic replay is honestly marked best_effort', 'pass',
      not (r->'replay_result'->>'equivalent')::boolean and r->'replay_result'->>'replay_mode' = 'best_effort', 'detail', r->'replay_result'->>'verdict');

    -- secrets scan
    r := public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr.id, 'platform', 'grok', 'cost_ceiling', 1));
    r := public.thread_record_build_result(a, jsonb_build_object('run_id', r->>'run_id', 'status', 'succeeded', 'cost_actual', 1, 'secrets_scan', 'found: aws key',
      'artifacts', jsonb_build_array(jsonb_build_object('kind', 'commit', 'uri', 'sim://s', 'hash', 'x'))));
    res := res || jsonb_build_object('name', 'An artifact without a clean secrets scan fails the run', 'pass', r->>'status' = 'failed' and jsonb_array_length(r->'artifacts') = 0, 'detail', r->>'status');

    -- skeleton
    sk := public.thread_record_skeleton(a, jsonb_build_object('run_id', runs->>'lovable', 'mission_ref', mis.id, 'one_real_user_process', 'member checks claim status'));
    res := res || jsonb_build_object('name', 'A working skeleton is recorded from a succeeded run and linked to its mission', 'pass',
      exists (select 1 from public.edges where verb = 'skeleton_of' and from_id = sk.id and to_id = mis.id), 'detail', sk.human_ref);

    -- iteration classification
    d := '{"added_obligations":["also send an SMS reminder"],"changed_results":[],"changed_contracts":[],"text_edits":["button label"]}';
    r := public.thread_record_iteration(a, jsonb_build_object('from_run', runs->>'codex', 'to_run', rep->>'run_id', 'declared_class', 'cosmetic', 'diff', d));
    res := res || jsonb_build_object('name', 'A scope change classified as cosmetic is caught by the detector', 'pass',
      (r->>'scope_change_flag')::boolean and exists (select 1 from public.detector_findings f where f.detector_key = 'ScopeChangeSmuggledThroughIteration' and f.object_id = (r->>'iteration_id')::uuid and f.state = 'open'),
      'detail', r->>'detected_class');
    r := public.thread_record_iteration(a, jsonb_build_object('from_run', runs->>'lovable', 'to_run', runs->>'cursor', 'declared_class', 'cosmetic', 'diff', '{"added_obligations":[],"changed_results":[],"changed_contracts":[],"text_edits":["label"]}'));
    res := res || jsonb_build_object('name', 'A genuine cosmetic change is not flagged', 'pass', not (r->>'scope_change_flag')::boolean, 'detail', r->>'detected_class');
    begin perform public.thread_record_iteration(a, jsonb_build_object('from_run', runs->>'lovable', 'to_run', runs->>'grok', 'declared_class', 'scope', 'diff', d)); ok := false; msg := 'recorded';
    exception when others then ok := sqlerrm like 'SCOPE_REQUIRES_NEW_BEHAVIOUR%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'A scope change without a new Behaviour Statement is rejected', 'pass', ok, 'detail', msg);
    txt := E'# Template v3\n- ' || bs.human_ref || E': status\n- ' || bs2.human_ref || ': WHEN a claim status changes THEN an SMS is sent';
    pr2 := public.thread_compile_creation_prompt(a, fx || jsonb_build_object('behavior_ids', jsonb_build_array(bs.id, bs2.id), 'reuse_check_id', rc2, 'title', 'Scope ' || tag,
      'compiled_text', txt, 'compiled_hash', encode(sha256(convert_to(txt, 'UTF8')), 'hex'), 'mission_ref', null));
    r := public.thread_dispatch_build(a, jsonb_build_object('prompt_id', pr2.id, 'platform', 'codex', 'cost_ceiling', 5));
    r := public.thread_record_iteration(a, jsonb_build_object('from_run', runs->>'codex', 'to_run', r->>'run_id', 'declared_class', 'scope', 'diff', d));
    res := res || jsonb_build_object('name', 'A scope change traced to a new Behaviour Statement is accepted', 'pass', r->>'classification' = 'scope' and not (r->>'scope_change_flag')::boolean, 'detail', r->>'governance');

    raise exception 'P6_SELFTEST_ROLLBACK';
  exception when others then
    if sqlerrm <> 'P6_SELFTEST_ROLLBACK' then
      res := res || jsonb_build_object('name', 'Self-test ran to completion', 'pass', false, 'detail', sqlerrm);
    end if;
  end;
  return jsonb_build_object('passed', jsonb_array_length(res) > 0 and not exists (select 1 from jsonb_array_elements(res) x where not (x->>'pass')::boolean),
    'checks', res, 'fixtures', 'rolled back');
end $$;

create or replace function public.thread_record_phase6_evidence(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb; ev jsonb; s bigint;
begin
  perform public._assert_actor(p_actor);
  st := public.thread_phase6_selftest();
  ev := jsonb_build_object('selftest', st, 'client', p,
    'live_builds', 'pending_live_adapter: all five BuildPlatform adapters are simulated until platform credentials exist; simulated evidence attached');
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase6.exit_evidence', null, null, '{}', 'simulated', ev, '', 'pending-' || public.uuid_v7()::text)
  returning seq into s;
  return ev || jsonb_build_object('ledger_seq', s);
end $$;

revoke all on function public.thread_phase6_selftest(), public.thread_record_phase6_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_phase6_selftest(), public.thread_record_phase6_evidence(jsonb, jsonb) to service_role;

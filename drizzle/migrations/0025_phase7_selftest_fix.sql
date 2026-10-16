-- Fix: fixtures must be created outside the exception block (a caught error rolls back the subtransaction).
create or replace function public.thread_phase7_selftest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase7","authority_used":"observe"}';
  h jsonb := '{"kind":"human","id":"thread.selftest.phase7.human","authority_used":"act_with_confirmation"}';
  res jsonb := '[]'; ok boolean; msg text; tag text := substr(md5(random()::text), 1, 6);
  cap public.objects; cap2 public.objects; mis public.objects; live_sr uuid; sim_sr uuid; r jsonb; ea_id uuid;
  discrepancies jsonb; lvl public.authority_level;
begin
  cap := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Shadow test capability ' || tag, '{"contract_ref":null}'));
  cap2 := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Incident test capability ' || tag, '{"contract_ref":null}'));
  mis := public.thread_create_object(a, public._fx_payload('ValueMission', 'Value measure mission ' || tag, '{}'));
  discrepancies := jsonb_build_array(
    jsonb_build_object('case_ref','C1','shadow_decision','approve','actual_decision','escalate','hypothesised_cause','model_error'),
    jsonb_build_object('case_ref','C2','shadow_decision','approve','actual_decision','escalate','hypothesised_cause','model_error'),
    jsonb_build_object('case_ref','C3','shadow_decision','deny','actual_decision','approve','hypothesised_cause','edge_case'));

  -- 1 shadow run on a non-capability is rejected
  begin perform public.thread_record_shadow_run(a, mis.id, jsonb_build_object('sample_size', 10)); ok := false; msg := 'recorded';
  exception when others then ok := sqlerrm like 'NOT_A_CAPABILITY%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A shadow run on a non-capability is rejected', 'pass', ok, 'detail', msg);

  -- 2 sample size required
  begin perform public.thread_record_shadow_run(a, cap.id, jsonb_build_object('sample_size', 0)); ok := false; msg := 'recorded';
  exception when others then ok := sqlerrm like 'SAMPLE_SIZE_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A shadow run without a sample size is rejected', 'pass', ok, 'detail', msg);

  -- 3 simulated run above the bound records but never demotes (3.4)
  r := public.thread_record_shadow_run(a, cap.id, jsonb_build_object('sample_size', 10, 'discrepancies', discrepancies, 'adapter_mode', 'simulated', 'period', 'sim week 1'));
  sim_sr := (r->>'shadow_run_id')::uuid;
  res := res || jsonb_build_object('name', 'A simulated run above the bound is recorded, clustered and does not demote', 'pass',
    (r->>'simulated')::boolean and not (r->>'demoted')::boolean and jsonb_array_length(r->'cause_clusters') = 2
    and (r->>'discrepancy_rate')::numeric = 0.3, 'detail', r->>'human_ref');

  -- 4 simulated evidence cannot grant authority (3.4)
  begin perform public.thread_set_authority(a, cap.id, 'recommend', 'grant', 'selftest', array[sim_sr]); ok := false; msg := 'granted';
  exception when others then ok := sqlerrm like 'SIMULATED_EVIDENCE_DOES_NOT_PROMOTE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Simulated evidence cannot grant authority (3.4)', 'pass', ok, 'detail', msg);

  -- 5 a live run above the discrepancy bound demotes automatically (9.4)
  r := public.thread_record_shadow_run(a, cap.id, jsonb_build_object('sample_size', 100, 'discrepancies', '[]', 'adapter_mode', 'live', 'period', 'live week 0'));
  live_sr := (r->>'shadow_run_id')::uuid;
  perform public.thread_set_authority(a, cap.id, 'recommend', 'grant', 'selftest', array[live_sr]);
  r := public.thread_record_shadow_run(a, cap.id, jsonb_build_object('sample_size', 10, 'discrepancies', discrepancies, 'adapter_mode', 'live', 'period', 'live week 1'));
  select authority_level into lvl from public.objects where id = cap.id;
  res := res || jsonb_build_object('name', 'A live run above the discrepancy bound demotes automatically (9.4)', 'pass',
    (r->>'demoted')::boolean and lvl = 'observe', 'detail', 'rate ' || (r->>'discrepancy_rate') || ' -> ' || lvl);

  -- 6 exposure authorisation requires a human
  begin perform public.thread_authorize_exposure(a, cap.id, jsonb_build_object('population_pct', 1, 'rollback_armed', 'true', 'kill_switch_ref', 'ks-1', 'evidence_bundle_ref', live_sr));
    ok := false; msg := 'authorised';
  exception when others then ok := sqlerrm like 'HUMAN_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'An agent cannot authorise exposure (Part 4.3)', 'pass', ok, 'detail', msg);

  -- 7 simulated evidence cannot authorise
  begin perform public.thread_authorize_exposure(h, cap.id, jsonb_build_object('population_pct', 1, 'rollback_armed', 'true', 'kill_switch_ref', 'ks-1', 'evidence_bundle_ref', sim_sr));
    ok := false; msg := 'authorised';
  exception when others then ok := sqlerrm like 'SIMULATED_EVIDENCE_DOES_NOT_AUTHORIZE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Simulated evidence cannot authorise exposure (3.4)', 'pass', ok, 'detail', msg);

  -- 8 rollback must be armed
  begin perform public.thread_authorize_exposure(h, cap.id, jsonb_build_object('population_pct', 1, 'kill_switch_ref', 'ks-1', 'evidence_bundle_ref', live_sr));
    ok := false; msg := 'authorised';
  exception when others then ok := sqlerrm like 'ROLLBACK_NOT_ARMED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Exposure without an armed rollback is refused', 'pass', ok, 'detail', msg);

  -- 9 population cannot leap steps
  begin perform public.thread_authorize_exposure(h, cap.id, jsonb_build_object('population_pct', 25, 'rollback_armed', 'true', 'kill_switch_ref', 'ks-1', 'evidence_bundle_ref', live_sr));
    ok := false; msg := 'authorised';
  exception when others then ok := sqlerrm like 'EXPOSURE_STEP_SKIPPED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A population leap past the next step is refused (Part 9)', 'pass', ok, 'detail', msg);

  -- 10 a valid authorisation exposes progressively and grants authority
  r := public.thread_authorize_exposure(h, cap.id, jsonb_build_object('population_pct', 1, 'rollback_armed', 'true', 'kill_switch_ref', 'ks-1',
        'evidence_bundle_ref', live_sr, 'authority_level_granted', 'act_with_confirmation', 'effective_to', (now() + interval '30 days')::text));
  ea_id := (r->>'exposure_id')::uuid;
  select authority_level into lvl from public.objects where id = cap.id;
  res := res || jsonb_build_object('name', 'A human authorisation with live evidence exposes 1 pct and grants authority', 'pass',
    (r->>'population_pct')::numeric = 1 and lvl = 'act_with_confirmation', 'detail', r->>'human_ref');

  -- 11 production outcome without any authorisation is refused (Part 4.5 rule 4)
  begin perform public.thread_record_production_outcome(a, cap2.id, jsonb_build_object('period', 'w1', 'events_processed', 5)); ok := false; msg := 'recorded';
  exception when others then ok := sqlerrm like 'NO_EXPOSURE_AUTHORIZATION%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A production outcome without an ExposureAuthorization is refused (4.5 rule 4)', 'pass', ok, 'detail', msg);

  -- 12 production outcome with an authorisation is recorded
  r := public.thread_record_production_outcome(a, cap.id, jsonb_build_object('period', 'w1', 'events_processed', 5, 'adapter_mode', 'live'));
  res := res || jsonb_build_object('name', 'A production outcome tracing to an authorisation is recorded', 'pass', r->>'outcome_id' is not null, 'detail', r->>'human_ref');

  -- 13 a critical live incident demotes to observe (6.2)
  perform public.thread_set_authority(a, cap2.id, 'recommend', 'grant', 'selftest', array[live_sr]);
  r := public.thread_record_incident(a, cap2.id, jsonb_build_object('severity', 'critical', 'description', 'wrong member shown a status', 'adapter_mode', 'live'));
  select authority_level into lvl from public.objects where id = cap2.id;
  res := res || jsonb_build_object('name', 'A critical live incident demotes to observe (6.2)', 'pass', (r->>'demoted')::boolean and lvl = 'observe', 'detail', r->>'human_ref');

  -- 14 kill switch stops a live exposure within its bound and withdraws authority
  r := public.thread_kill_switch(h, cap.id, jsonb_build_object('reason', 'self-test'));
  select authority_level into lvl from public.objects where id = cap.id;
  res := res || jsonb_build_object('name', 'The kill switch stops a live exposure within its bound and withdraws authority', 'pass',
    (r->>'duration_ms')::numeric <= (r->>'within_bound_ms')::numeric and lvl = 'observe', 'detail', r->>'human_ref');

  -- 15 kill switch with nothing live is refused
  begin perform public.thread_kill_switch(h, cap.id, '{}'); ok := false; msg := 'stopped';
  exception when others then ok := sqlerrm like 'NO_ACTIVE_EXPOSURE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'The kill switch refuses when nothing is live', 'pass', ok, 'detail', msg);

  -- 16 value measure needs a baseline and delta (P12)
  begin perform public.thread_record_value_measure(a, mis.id, jsonb_build_object('title', 'no baseline', 'value', 5)); ok := false; msg := 'recorded';
  exception when others then ok := sqlerrm like 'BASELINE_AND_DELTA_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A value measure without baseline and delta is refused (P12)', 'pass', ok, 'detail', msg);

  -- 17 simulated evidence cannot back a value measure
  begin perform public.thread_record_value_measure(a, mis.id, jsonb_build_object('title', 'sim evidence', 'value', 5, 'baseline', 4, 'delta', 1, 'source_evidence', jsonb_build_array(sim_sr)));
    ok := false; msg := 'recorded';
  exception when others then ok := sqlerrm like 'SIMULATED_EVIDENCE_DOES_NOT_MEASURE_VALUE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Simulated evidence cannot back a value measure (3.4)', 'pass', ok, 'detail', msg);

  -- 18 a value measure with live evidence is recorded
  r := public.thread_record_value_measure(a, mis.id, jsonb_build_object('title', 'call volume down', 'value', 34, 'unit', 'pct', 'baseline', 40, 'delta', -6, 'source_evidence', jsonb_build_array(live_sr)));
  res := res || jsonb_build_object('name', 'A value measure with baseline, delta and live evidence is recorded', 'pass', r->>'measure_id' is not null, 'detail', r->>'human_ref');

  -- cleanup: tombstone fixtures
  perform public.thread_tombstone_object(a, cap.id, (select version from public.objects where id = cap.id), 'self-test cleanup');
  perform public.thread_tombstone_object(a, cap2.id, (select version from public.objects where id = cap2.id), 'self-test cleanup');
  perform public.thread_tombstone_object(a, mis.id, (select version from public.objects where id = mis.id), 'self-test cleanup');

  return jsonb_build_object('passed', not exists (select 1 from jsonb_array_elements(res) c where not (c->>'pass')::boolean), 'checks', res);
end $$;
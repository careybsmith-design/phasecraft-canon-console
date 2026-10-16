create or replace function public.thread_phase3_selftest() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase3","authority_used":"observe"}';
  ev public.objects; simev public.objects; cap public.objects; route public.objects; grant_o public.objects; hdr public.objects; t4 public.objects;
  res jsonb := '[]'; ok boolean; msg text; fx uuid[] := '{}'; trg text; lvl public.authority_level; i uuid; o public.objects;
  hdr_body jsonb;
  conds jsonb := '{"explicit_human_grant_ref":"selftest"}';
begin
  ev := public.thread_create_object(a, public._fx_payload('PolicyEvaluation', 'Phase 3 self-test evidence', '{"deterministic":true}'::jsonb)); fx := fx || ev.id;
  simev := public.thread_create_object(a, public._fx_payload('PolicyEvaluation', 'Phase 3 simulated evidence', '{"adapter_mode":"simulated","deterministic":true}'::jsonb)); fx := fx || simev.id;
  route := public.thread_create_object(a, public._fx_payload('ModelRoute', 'Self-test route', '{"provider":"x","model_version_pin":"1"}'::jsonb)); fx := fx || route.id;
  cap := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Self-test capability', jsonb_build_object('model_route_ref', route.id)) || jsonb_build_object('steward_id', public.uuid_v7())); fx := fx || cap.id;

  -- simulated evidence never promotes
  begin perform public.thread_set_authority(a, cap.id, 'recommend', 'promotion', 'selftest', array[simev.id]); ok := false; msg := 'promoted on simulated evidence';
  exception when others then ok := sqlerrm like 'SIMULATED_EVIDENCE_DOES_NOT_PROMOTE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Simulated evidence does not promote authority', 'pass', ok, 'detail', msg);

  -- direct authority writes are refused
  begin update public.objects set authority_level = 'act_bounded' where id = cap.id; ok := false; msg := 'direct write accepted';
  exception when others then ok := true; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Authority changes only through the engine path', 'pass', ok, 'detail', msg);

  -- every demotion trigger fires automatically
  foreach trg in array array['discrepancy_rate_exceeded','critical_or_repeated_incident','policy_or_guardrail_changed',
    'capability_version_changed_materially','data_distribution_shift','model_route_or_version_changed',
    'authority_effective_to_lapsed','steward_unassigned','value_review_underperformance'] loop
    select * into o from public.objects where id = cap.id;
    if o.steward_id is null then o.steward_id := public.uuid_v7(); o.version := o.version + 1; perform public._thread_apply(a, o, 'object.revise', '{}'); end if;
    perform public.thread_set_authority(a, cap.id, 'autonomous_with_exception', 'promotion', 'selftest', array[ev.id], conds);
    begin
      if trg = 'policy_or_guardrail_changed' then
        insert into public.guardrails (id, category, evaluator, params, version, active, enforcement)
        values (public.uuid_v7(), 'selftest', 'policy_rule', '{}', 'selftest', false, 'advisory') returning id into i;
      elsif trg = 'capability_version_changed_materially' then
        select * into o from public.objects where id = cap.id; o.statement := o.statement || ' (v' || (o.version + 1) || ')'; o.version := o.version + 1;
        perform public._thread_apply(a, o, 'object.revise', '{}');
      elsif trg = 'model_route_or_version_changed' then
        select * into o from public.objects where id = route.id; o.body := o.body || jsonb_build_object('model_version_pin', o.version + 1); o.version := o.version + 1;
        perform public._thread_apply(a, o, 'object.revise', '{}');
      elsif trg = 'authority_effective_to_lapsed' then
        grant_o := public.thread_create_object(a, public._fx_payload('AuthorityGrant', 'Lapsed self-test grant',
          jsonb_build_object('subject_ref', cap.id, 'authority_level', 'autonomous_with_exception', 'effective_to', now() - interval '1 day'))); fx := fx || grant_o.id;
        perform public.thread_authority_sweep(a);
      elsif trg = 'steward_unassigned' then
        select * into o from public.objects where id = cap.id; o.steward_id := null; o.version := o.version + 1;
        perform public._thread_apply(a, o, 'object.revise', '{}');
      else
        perform public.thread_authority_event(a, cap.id, trg, array[ev.id]);
      end if;
      select authority_level into lvl from public.objects where id = cap.id;
      ok := lvl < 'autonomous_with_exception' and exists (select 1 from public.authority_history h where h.object_id = cap.id and h.trigger = trg and h.txid = txid_current());
      msg := 'now ' || lvl;
    exception when others then ok := false; msg := sqlerrm; end;
    res := res || jsonb_build_object('name', 'Demotion fires automatically: ' || trg, 'pass', ok, 'detail', msg);
    if trg = 'authority_effective_to_lapsed' then
      perform public.thread_tombstone_object(a, grant_o.id, grant_o.version, 'self-test fixture');
    end if;
  end loop;
  delete from public.guardrails where version = 'selftest';

  -- Tier 4 autonomy prohibited without independent judgment, monitoring, kill switch
  t4 := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Tier 4 self-test', '{}'::jsonb) || '{"risk_tier":"4"}'); fx := fx || t4.id;
  begin perform public.thread_set_authority(a, t4.id, 'act_bounded', 'promotion', 'selftest', array[ev.id]); ok := false; msg := 'tier 4 bounded without controls';
  exception when others then ok := sqlerrm like 'TIER4_AUTONOMY_PROHIBITED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Tier 4 bounded/autonomous action is prohibited without the 6.2 controls', 'pass', ok, 'detail', msg);

  -- HDR exact fields
  hdr_body := jsonb_build_object('exact_decision_required','x','reason_ai_cannot_safely_decide','x','current_evidence_and_confidence', ev.id,
    'ai_recommendation','x','viable_alternatives', '[{"option":"a","consequences":"c","affected_parties":["p"]}]'::jsonb, 'affected_parties','["p"]'::jsonb,
    'deadline', now() + interval '1 day', 'cost_of_waiting','x','reversibility','reversible','current_authority_boundary', cap.id,'proposed_next_machine_action','x');
  begin perform public.thread_create_object(a, public._fx_payload('HumanDecisionRequest', 'extra field', hdr_body || '{"status":"awaiting"}')); ok := false; msg := 'extra field stored';
  exception when others then ok := sqlerrm like 'HDR_EXACT_FIELDS%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A decision request with any extra field is rejected', 'pass', ok, 'detail', msg);
  hdr := public.thread_create_object(a, public._fx_payload('HumanDecisionRequest', 'Self-test decision request', hdr_body)); fx := fx || hdr.id;
  o := public.thread_create_object(a, public._fx_payload('Decision', 'clarify', jsonb_build_object('request_ref', hdr.id, 'response', 'request_clarification', 'decision', 'what is the deadline basis?'))); fx := fx || o.id;
  begin perform public.thread_create_object(a, public._fx_payload('Decision', 'clarify again', jsonb_build_object('request_ref', hdr.id, 'response', 'request_clarification', 'decision', 'again'))); ok := false; msg := 'second clarification accepted';
  exception when others then ok := sqlerrm like 'ONE_CLARIFICATION_ONLY%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Only one clarification per decision request', 'pass', ok, 'detail', msg);

  -- risk tier never overridden downward
  begin insert into public.risk_assessments (object_id, inputs, computed_tier, override_tier, override_rationale, treatment, computed_by)
    values (cap.id, '{}', '3', '2', 'cheaper', 'x', 'selftest'); ok := false; msg := 'downward override stored';
  exception when others then ok := true; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Risk tier downward override is rejected', 'pass', ok, 'detail', msg);

  -- no approval states anywhere in the schema
  select count(*) = 0 into ok from (
    select state s from public.lifecycle_initial_states union select from_state from public.lifecycle_transitions union select to_state from public.lifecycle_transitions
    union select e.enumlabel::text from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public') x
  where x.s ~* '(approv|sign.?off|pending.?review|submitted.?for.?review|awaiting|qa.?phase)';
  res := res || jsonb_build_object('name', 'No object type has an approval state', 'pass', ok, 'detail', 'lifecycle tables and public enums scanned');

  foreach i in array fx loop
    select * into o from public.objects where id = i;
    if not o.is_tombstone then perform public.thread_tombstone_object(a, o.id, o.version, 'self-test fixture'); end if;
  end loop;
  return jsonb_build_object('passed', not exists (select 1 from jsonb_array_elements(res) r where not (r->>'pass')::boolean), 'checks', res);
end $$;

create or replace function public.thread_record_phase3_evidence(p_actor jsonb, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare st jsonb; ev jsonb; s bigint; rid uuid := public.uuid_v7();
begin
  perform public._assert_actor(p_actor);
  st := public.thread_phase3_selftest();
  insert into public.renditions (id, kind, generated_from, citations, generator, permission_context, expires_at, state, body)
  values (rid, 'phi_pan_recall', jsonb_build_array(jsonb_build_object('corpus', 'src/domain/phi-pan-corpus.ts')),
          jsonb_build_array(jsonb_build_object('source', 'Phase 3 exit evidence: PHI/PAN labelled corpus')),
          jsonb_build_object('engine', 'ContentClassifier', 'mode', 'simulated-deterministic'), '{"roles":["member"]}', now() + interval '90 days', 'live', p->'phi_pan');
  ev := jsonb_build_object('selftest', st, 'phi_pan_rendition', rid,
    'no_human_wait_ratio', (select case when count(*) = 0 then null else round(1.0 * count(*) filter (where o.body->>'decision' <> 'escalate') / count(*), 3) end
       from public.objects o where o.type = 'PolicyEvaluation' and not o.is_tombstone and o.body ? 'decision'),
    'client', p);
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase3.exit_evidence', null, null, '{}', 'none', ev, '', 'pending-' || public.uuid_v7()::text)
  returning seq into s;
  return ev || jsonb_build_object('ledger_seq', s);
end $$;

revoke execute on function public.thread_phase3_selftest() from public, anon, authenticated;
revoke execute on function public.thread_record_phase3_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_phase3_selftest() to service_role;
grant execute on function public.thread_record_phase3_evidence(jsonb, jsonb) to service_role;

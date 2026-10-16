-- Scoped sweep so tests never retire real capabilities
create or replace function public.thread_fabric_sweep_scoped(p_actor jsonb, p_now timestamptz, p_only uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.objects; uses int; cost numeric; win int; pub timestamptz; reason text; retired jsonb := '[]'; flagged jsonb := '[]'; w record;
begin
  perform public._assert_actor(p_actor);
  for o in select * from public.objects where type = 'ComposableCapability' and not is_tombstone and lifecycle_state not in ('proposed','retired')
           and (p_only is null or id = any(p_only)) for update loop
    win := coalesce((o.body->'minimum_use_threshold'->>'window_days')::int, 30);
    pub := coalesce((o.body->>'published_at')::timestamptz, o.created_at);
    select count(*), coalesce(sum(cost), 0) into uses, cost from public.capability_usage where capability_id = o.id and at > p_now - make_interval(days => win) and at <= p_now;
    reason := null;
    if o.expires_at is not null and o.expires_at <= p_now then reason := 'expiration condition met';
    elsif p_now - pub >= make_interval(days => win) and uses < coalesce((o.body->'minimum_use_threshold'->>'uses')::int, 0) then
      reason := format('use below minimum (%s < %s in %s days)', uses, o.body->'minimum_use_threshold'->>'uses', win);
    end if;
    if reason is not null then
      o.lifecycle_state := 'retired'; o.retired_at := p_now; o.retirement_reason := 'automatic retirement: ' || reason;
      o.body := o.body || jsonb_build_object('is_machine_discoverable', false);
      o.version := o.version + 1;
      o := public._thread_apply(p_actor, o, 'capability.retired', jsonb_build_object('reason', reason, 'uses_in_window', uses, 'automatic', true));
      retired := retired || jsonb_build_object('id', o.id, 'ref', o.human_ref, 'reason', reason);
      for w in select e.from_id from public.edges e join public.objects x on x.id = e.from_id
               where e.to_id = o.id and e.verb = 'composes' and e.retired_at is null and not x.is_tombstone and x.authority_level > 'observe' loop
        perform public.thread_authority_event(p_actor, w.from_id, 'value_review_underperformance', array[o.id]);
      end loop;
    elsif (o.body->'operating_cost_ceiling'->>'amount') is not null and cost > (o.body->'operating_cost_ceiling'->>'amount')::numeric
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

create or replace function public.thread_fabric_sweep(p_actor jsonb, p_now timestamptz default now()) returns jsonb
language sql security definer set search_path = public as $$ select public.thread_fabric_sweep_scoped(p_actor, p_now, null) $$;

create or replace function public._p4_cap_body(_title text, _ins text[], _outs text[]) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'business_outcome', _title, 'plain_language_purpose', _title, 'intended_consumers', '["claims agents"]'::jsonb,
    'input_schema', jsonb_build_object('fields', to_jsonb(_ins)), 'output_schema', jsonb_build_object('fields', to_jsonb(_outs)),
    'preconditions', '["policy active"]'::jsonb, 'dependencies', '[]'::jsonb, 'business_rules', '["rule"]'::jsonb, 'exceptions', '["none"]'::jsonb,
    'data_classifications', '["internal"]'::jsonb, 'permitted_uses', '["claims"]'::jsonb, 'policy_constraints', '["owner named"]'::jsonb,
    'security_privacy_accessibility_constraints', '["WCAG 2.2 AA"]'::jsonb, 'confidence_requirements', jsonb_build_object('min_band','moderate'),
    'explainability_audit_behaviour', 'records inputs and decision', 'failure_modes', '["timeout"]'::jsonb, 'recovery_behaviour', 'retry once then escalate',
    'human_intervention_conditions', '["tier 3+"]'::jsonb, 'test_simulation_evaluation_refs', '["selftest"]'::jsonb, 'service_levels', jsonb_build_object('p95_ms', 500),
    'cost_resource_telemetry_ref', 'capability_usage', 'version', '1.0.0', 'compatibility', 'additive changes only', 'owner_and_stewardship', 'owner + steward',
    'minimum_use_threshold', jsonb_build_object('uses', 5, 'window_days', 30), 'retirement_condition', 'use below minimum for a full window',
    'value_hypothesis', 'faster decisions', 'operating_cost_ceiling', jsonb_build_object('amount', 100, 'window_days', 30),
    'performance_thresholds', jsonb_build_object('success_rate_min', 0.95), 'risk_thresholds', jsonb_build_object('max_tier', 2))
$$;

create or replace function public.thread_phase4_selftest() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase4","authority_used":"observe"}';
  res jsonb := '[]'; ok boolean; msg text; fx uuid[] := '{}'; i uuid; o public.objects;
  ev public.objects; k public.objects; c1 public.objects; c2 public.objects; bad public.objects; r jsonb; comp jsonb; tag text := substr(md5(random()::text), 1, 6);
  usage_before int; usage_after int; versions_before int; versions_after int; ledger jsonb; lvl public.authority_level;
begin
  ev := public.thread_create_object(a, public._fx_payload('PolicyEvaluation', 'Phase 4 self-test evidence', '{"deterministic":true}'::jsonb)); fx := fx || ev.id;
  k := public.thread_create_object(a, public._fx_payload('CapabilityContract', 'Phase 4 self-test contract', '{"promised_outcome":"triage"}'::jsonb)); fx := fx || k.id;

  -- 1. a creation attempt without a reuse check is rejected by the system
  begin perform public.thread_create_object(a, public._fx_payload('CreationPrompt', 'no reuse check', '{}'::jsonb)); ok := false; msg := 'created';
  exception when others then ok := sqlerrm like 'REUSE_CHECK_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A creation attempt without a reuse check is rejected', 'pass', ok, 'detail', msg);
  begin insert into public.creation_prompts (object_id, reuse_check_id, source_behavior_ids, template_id, template_version, compiled_text, compiled_hash)
    values (ev.id, public.uuid_v7(), array[ev.id], public.uuid_v7(), '1', 'x', 'x'); ok := false; msg := 'inserted';
  exception when others then ok := true; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A creation prompt pointing at a missing reuse check is rejected', 'pass', ok, 'detail', msg);

  -- 2. create_new is blocked when a result has no recorded gaps
  begin insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by)
    values (public.uuid_v7(), '{"outcome":"x","inputs":[],"outputs":[],"domain":"d"}', 'x', jsonb_build_array(jsonb_build_object('capability_id', k.id, 'match_score', 0.9, 'reuse_mode', 'use_as_is', 'gaps', '[]'::jsonb)),
            'create_new', 'want my own', a); ok := false; msg := 'stored';
  exception when others then ok := sqlerrm like 'CREATE_NEW_BLOCKED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'create_new is blocked while a match has no recorded gaps', 'pass', ok, 'detail', msg);

  -- 3. publishing needs a contract and a complete 7.2/7.6 body
  bad := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Incomplete capability ' || tag, '{"business_outcome":"x"}'::jsonb)); fx := fx || bad.id;
  begin perform public.thread_publish_capability(a, bad.id, k.id); ok := false; msg := 'published';
  exception when others then ok := sqlerrm like 'CONTRACT_INCOMPLETE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'An incomplete capability contract cannot be published', 'pass', ok, 'detail', left(msg, 200));
  c1 := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Claim triage selftest ' || tag, public._p4_cap_body('Route incoming claims to the right queue', array['claim','policy'], array['queue']))); fx := fx || c1.id;
  begin perform public.thread_publish_capability(a, c1.id, ev.id); ok := false; msg := 'published';
  exception when others then ok := sqlerrm like 'CONTRACT_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A capability cannot be published without a Capability Contract', 'pass', ok, 'detail', msg);
  begin
    select * into o from public.objects where id = c1.id; o.body := o.body || '{"is_machine_discoverable":true}'; o.version := o.version + 1;
    perform public._thread_apply(a, o, 'object.revise', '{}'); ok := false; msg := 'made discoverable';
  exception when others then ok := sqlerrm like 'CONTRACT_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Making a capability discoverable without a contract is rejected', 'pass', ok, 'detail', msg);
  c1 := public.thread_publish_capability(a, c1.id, k.id);
  c2 := public.thread_create_object(a, public._fx_payload('ComposableCapability', 'Payment status selftest ' || tag, public._p4_cap_body('Tell a member the status of a payment', array['member','claim'], array['payment status']))); fx := fx || c2.id;
  c2 := public.thread_publish_capability(a, c2.id, k.id);

  -- 4. intent-shaped discovery
  r := public.fabric_search('route incoming claims to the right queue ' || tag, array['claim','policy'], array['queue'], 'claims', 5);
  ok := exists (select 1 from jsonb_array_elements(r) x where (x->>'capability_id')::uuid = c1.id);
  res := res || jsonb_build_object('name', 'Discovery returns the capability for an intent-shaped query', 'pass', ok,
    'detail', coalesce((select x->>'match_score' || ' ' || (x->>'reuse_mode') from jsonb_array_elements(r) x where (x->>'capability_id')::uuid = c1.id), 'not found'));

  -- 5. composition: effective authority is the minimum of its parts
  perform public.thread_set_authority(a, c1.id, 'act_bounded', 'promotion', 'selftest', array[ev.id]);
  perform public.thread_set_authority(a, c2.id, 'recommend', 'promotion', 'selftest', array[ev.id]);
  comp := public.thread_compose_capabilities(a, array[c1.id, c2.id], 'Member claim journey selftest ' || tag, 'member-submitted claim');
  fx := fx || (comp->>'composition_id')::uuid;
  res := res || jsonb_build_object('name', 'A composition''s effective authority is the minimum of its parts', 'pass', comp->>'effective_authority' = 'recommend', 'detail', comp->>'effective_authority');

  -- 6. automatic retirement preserving data and audit continuity
  perform public.thread_record_capability_use(a, c1.id, '{"consumer":"selftest","outcome":"success","cost":1}');
  select count(*) into usage_before from public.capability_usage where capability_id = c1.id;
  select count(*) into versions_before from public.object_versions where id = c1.id;
  r := public.thread_fabric_sweep_scoped(a, now() + interval '40 days', array[c1.id]);
  select * into o from public.objects where id = c1.id;
  select count(*) into usage_after from public.capability_usage where capability_id = c1.id;
  select count(*) into versions_after from public.object_versions where id = c1.id;
  ledger := public.thread_verify_ledger();
  ok := o.lifecycle_state = 'retired' and not o.is_tombstone and usage_after = usage_before and versions_after = versions_before + 1
        and exists (select 1 from public.ledger l where l.object_id = c1.id and l.action = 'capability.retired' and (l.payload->>'automatic')::boolean);
  res := res || jsonb_build_object('name', 'A capability is retired automatically while its data and audit trail are preserved', 'pass', ok,
    'detail', format('state %s, usage rows %s→%s, versions %s→%s, ledger %s', o.lifecycle_state, usage_before, usage_after, versions_before, versions_after, ledger));
  r := public.fabric_search('route incoming claims to the right queue ' || tag, array['claim','policy'], array['queue'], 'claims', 5);
  res := res || jsonb_build_object('name', 'A retired capability is no longer discoverable', 'pass', not exists (select 1 from jsonb_array_elements(r) x where (x->>'capability_id')::uuid = c1.id), 'detail', '');
  begin perform public.thread_record_capability_use(a, c1.id, '{}'); ok := false; msg := 'recorded';
  exception when others then ok := sqlerrm like 'NOT_IN_SERVICE%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A retired capability cannot be used', 'pass', ok, 'detail', msg);
  select authority_level into lvl from public.objects where id = (comp->>'composition_id')::uuid;
  res := res || jsonb_build_object('name', 'Compositions using a retired part lose authority', 'pass', public.composition_effective_authority((comp->>'composition_id')::uuid) <= 'recommend', 'detail', lvl);

  foreach i in array fx loop
    select * into o from public.objects where id = i;
    if not o.is_tombstone then perform public.thread_tombstone_object(a, o.id, o.version, 'self-test fixture'); end if;
  end loop;
  return jsonb_build_object('passed', not exists (select 1 from jsonb_array_elements(res) x where not (x->>'pass')::boolean), 'checks', res);
end $$;

create or replace function public.thread_record_phase4_evidence(p_actor jsonb, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare st jsonb; ev jsonb; s bigint;
begin
  perform public._assert_actor(p_actor);
  st := public.thread_phase4_selftest();
  ev := jsonb_build_object('selftest', st,
    'published_capabilities', (select count(*) from public.objects where type = 'ComposableCapability' and not is_tombstone and coalesce(body->>'is_machine_discoverable','false') = 'true'),
    'reuse_checks', (select count(*) from public.reuse_checks), 'client', p);
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase4.exit_evidence', null, null, '{}', 'none', ev, '', 'pending-' || public.uuid_v7()::text)
  returning seq into s;
  return ev || jsonb_build_object('ledger_seq', s);
end $$;

revoke execute on function public.thread_fabric_sweep_scoped(jsonb, timestamptz, uuid[]) from public, anon, authenticated;
revoke execute on function public.thread_phase4_selftest() from public, anon, authenticated;
revoke execute on function public.thread_record_phase4_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_fabric_sweep_scoped(jsonb, timestamptz, uuid[]) to service_role;
grant execute on function public.thread_phase4_selftest() to service_role;
grant execute on function public.thread_record_phase4_evidence(jsonb, jsonb) to service_role;

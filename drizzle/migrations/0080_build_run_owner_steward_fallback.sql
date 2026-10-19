-- Wave 4 follow-up: a BuildRun record is owned by the steward when the dispatching actor
-- is a system/platform identity whose id is not a user UUID (same fallback as self-test fixtures).
CREATE OR REPLACE FUNCTION public.thread_dispatch_build(p_actor jsonb, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.objects; cp public.creation_prompts; pf public.build_platforms; run public.objects; key jsonb; src public.build_runs; mode text; owner text;
BEGIN
  PERFORM public._assert_actor(p_actor);
  SELECT * INTO pr FROM public.objects WHERE id = (p->>'prompt_id')::uuid AND type = 'CreationPrompt' AND NOT is_tombstone;
  SELECT * INTO cp FROM public.creation_prompts WHERE object_id = pr.id;
  IF cp.object_id IS NULL THEN RAISE EXCEPTION 'PROMPT_REQUIRED: dispatch needs a compiled CreationPrompt'; END IF;
  SELECT * INTO pf FROM public.build_platforms WHERE platform = p->>'platform';
  IF pf.platform IS NULL THEN RAISE EXCEPTION 'UNKNOWN_PLATFORM: %', p->>'platform'; END IF;
  mode := COALESCE(p->>'adapter_mode', 'simulated');
  key := jsonb_build_object('prompt_version', pr.version, 'prompt_hash', cp.compiled_hash, 'platform', pf.platform, 'model_route', pf.model_route,
    'model_version', COALESCE(p->>'model_version', 'unpinned'), 'guardrail_set_version', pr.body->>'guardrail_set_ref', 'template_version', cp.template_version);
  IF p ? 'replay_of' THEN
    SELECT * INTO src FROM public.build_runs WHERE object_id = (p->>'replay_of')::uuid;
    IF src.object_id IS NULL THEN RAISE EXCEPTION 'REPLAY_SOURCE_NOT_FOUND'; END IF;
    IF src.prompt_id <> pr.id THEN RAISE EXCEPTION 'REPLAY_PROMPT_MISMATCH: a replay uses the same prompt'; END IF;
    IF src.platform <> pf.platform THEN RAISE EXCEPTION 'REPLAY_PLATFORM_MISMATCH: a replay uses the same platform'; END IF;
    key := src.repro_key;
    IF key->>'prompt_hash' <> cp.compiled_hash OR key->>'guardrail_set_version' <> (pr.body->>'guardrail_set_ref') THEN
      RAISE EXCEPTION 'REPLAY_KEY_DRIFT: the pinned prompt or guardrail set has changed since the original run';
    END IF;
  END IF;
  owner := COALESCE(p->>'owner_id', pr.owner_id::text);
  run := public.thread_create_object(p_actor, jsonb_build_object(
    'type', 'BuildRun', 'title', pf.label || ' build of ' || pr.human_ref || CASE WHEN p ? 'replay_of' THEN ' (replay)' ELSE '' END,
    'statement', 'Dispatched ' || pr.human_ref || ' to ' || pf.label, 'machine_description', 'BuildRun with pinned reproducibility key (Part 8.2)',
    'body', jsonb_build_object('reuse_check_ref', cp.reuse_check_id, 'prompt_ref', pr.id, 'platform', pf.platform, 'model_route_ref', key->>'model_route',
      'model_version_pin', key->>'model_version', 'guardrail_set_version', key->>'guardrail_set_version', 'template_version', key->>'template_version',
      'dispatched_at', now(), 'reproducibility_key', key, 'agent_actor', p_actor, 'authority_used', p_actor->>'authority_used', 'replay_of', p->>'replay_of',
      'provenance', jsonb_build_object('simulated', mode = 'simulated')),
    'owner_id', owner,
    'review_date', (current_date + 90)::text, 'expiration_condition', jsonb_build_object('kind', 'explicit_event', 'params', jsonb_build_object('event', 'superseded_by_new_run')),
    'retirement_path', jsonb_build_object('mode', 'archive_evidence'), 'risk_tier', pr.risk_tier::text,
    'permission', pr.permission, 'data_classification', pr.data_classification, 'derived_from', jsonb_build_array(pr.id),
    'adapter_mode', mode, 'rationale', COALESCE(p->>'rationale', 'dispatch')));
  INSERT INTO public.build_runs (object_id, prompt_id, platform, repro_key, cost_ceiling, estimated_cost, adapter_mode, replay_mode, replay_of)
    VALUES (run.id, pr.id, pf.platform, key, (p->>'cost_ceiling')::numeric, (p->>'estimated_cost')::numeric, mode,
      CASE WHEN mode = 'simulated' THEN 'deterministic' ELSE pf.live_determinism END, (p->>'replay_of')::uuid);
  PERFORM public.thread_create_edge(p_actor, jsonb_build_object('verb', 'executed_as', 'from_id', pr.id, 'to_id', run.id, 'source', 'stated', 'rationale', 'dispatch'));
  IF pr.lifecycle_state = 'compiled' THEN PERFORM public.thread_transition_object(p_actor, pr.id, pr.version, 'dispatched', 'first dispatch'); END IF;
  RETURN jsonb_build_object('run_id', run.id, 'human_ref', run.human_ref, 'repro_key', key, 'replay_mode', CASE WHEN mode = 'simulated' THEN 'deterministic' ELSE pf.live_determinism END);
END $$;

-- Deployment assertion: the audit self-test, including the status write-lock check, passes
DO $$
DECLARE r jsonb;
BEGIN
  r := public.thread_audit_security_selftest();
  IF r->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'AUDIT_REGRESSION_FAILED: %', r; END IF;
END $$;
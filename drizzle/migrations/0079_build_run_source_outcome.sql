-- Wave 4 (L-08/AW-16): THREAD stops owning execution state.
-- build_runs keeps only the platform's source outcome, mirrored read-only; the legacy
-- status column is deprecated and write-locked. BuildRun objects become evidence records.

-- 1. Additive mirror columns
ALTER TABLE public.build_runs
  ADD COLUMN outcome text CHECK (outcome IN ('succeeded','failed','partial')),
  ADD COLUMN mirrored_from text;

-- 2. Backfill from the legacy column (guard disabled only for this one-time backfill;
--    the ledger entries for these results already exist from when they were recorded)
ALTER TABLE public.build_runs DISABLE TRIGGER build_runs_guard;
UPDATE public.build_runs SET outcome = status, mirrored_from = 'platform_webhook'
WHERE status IN ('succeeded','failed');
ALTER TABLE public.build_runs ENABLE TRIGGER build_runs_guard;

-- 3. Deprecate and write-lock the THREAD-owned execution status
COMMENT ON COLUMN public.build_runs.status IS 'DEPRECATED: THREAD-owned execution state removed per L-08; use outcome + mirrored_from (read-only source mirror). Writes rejected by build_runs_status_lock.';

CREATE OR REPLACE FUNCTION public._build_runs_status_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status IS DISTINCT FROM 'dispatched' THEN
    RAISE EXCEPTION 'EXECUTION_STATE_NOT_OWNED: build_runs.status is deprecated per L-08; record outcome + mirrored_from instead';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'EXECUTION_STATE_NOT_OWNED: build_runs.status is deprecated per L-08; record outcome + mirrored_from instead';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER build_runs_status_lock BEFORE INSERT OR UPDATE ON public.build_runs
  FOR EACH ROW EXECUTE FUNCTION public._build_runs_status_lock();

-- 4. Lifecycle: BuildRun becomes an evidence record; creation_run loses execution states
UPDATE public.object_type_registry SET lifecycle_family = 'evidence_record' WHERE type = 'BuildRun';
DELETE FROM public.lifecycle_transitions WHERE lifecycle_family = 'creation_run';
INSERT INTO public.lifecycle_transitions (lifecycle_family, from_state, to_state) VALUES
  ('creation_run','compiled','dispatched'),
  ('creation_run','compiled','superseded'),
  ('creation_run','dispatched','superseded');

-- 4b. Reclassify existing BuildRun objects through the sanctioned transition path
DO $backfill$
DECLARE r record;
BEGIN
  INSERT INTO public.lifecycle_transitions (lifecycle_family, from_state, to_state) VALUES
    ('evidence_record','dispatched','recorded'),
    ('evidence_record','running','recorded'),
    ('evidence_record','succeeded','recorded'),
    ('evidence_record','failed','recorded');
  FOR r IN SELECT id, version FROM public.objects WHERE type = 'BuildRun' AND lifecycle_state IN ('dispatched','running','succeeded','failed') LOOP
    PERFORM public.thread_transition_object(
      '{"kind":"system","id":"thread.migration.aw16","authority_used":"observe"}',
      r.id, r.version, 'recorded', 'L-08: execution state removed; a BuildRun is an evidence record of a platform build');
  END LOOP;
  DELETE FROM public.lifecycle_transitions WHERE lifecycle_family = 'evidence_record' AND from_state IN ('dispatched','running','succeeded','failed');
END $backfill$;

-- 5. Guard: finished means an outcome was mirrored, not a THREAD-owned status
CREATE OR REPLACE FUNCTION public.build_runs_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cls public.data_classification; pf public.build_platforms; m text; c text; sc text; committed numeric; lim numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'APPEND_ONLY: build runs are never deleted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger l WHERE l.txid = txid_current() AND l.object_id = NEW.object_id) THEN
    RAISE EXCEPTION 'PROVENANCE_REQUIRED: no ledger entry for build run % in this transaction', NEW.object_id;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.prompt_id, NEW.platform, NEW.repro_key, NEW.cost_ceiling, NEW.adapter_mode, NEW.replay_mode, NEW.replay_of, NEW.estimated_cost, NEW.dispatched_at)
       IS DISTINCT FROM (OLD.prompt_id, OLD.platform, OLD.repro_key, OLD.cost_ceiling, OLD.adapter_mode, OLD.replay_mode, OLD.replay_of, OLD.estimated_cost, OLD.dispatched_at) THEN
      RAISE EXCEPTION 'RUN_PINNED: platform, reproducibility key, ceiling and adapter mode are pinned at dispatch';
    END IF;
    IF OLD.outcome IS NOT NULL AND NEW.outcome IS DISTINCT FROM OLD.outcome THEN
      RAISE EXCEPTION 'RUN_FINISHED: a finished run cannot change outcome; dispatch a new run';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO pf FROM public.build_platforms WHERE platform = NEW.platform;
  SELECT o.data_classification INTO cls FROM public.objects o WHERE o.id = NEW.prompt_id;
  IF NOT (cls = ANY(pf.cleared_classes)) THEN
    RAISE EXCEPTION 'PLATFORM_NOT_CLEARED: % is not cleared for % content (Part 8.3)', pf.label, cls;
  END IF;
  IF NEW.repro_key ?& ARRAY['prompt_version','prompt_hash','platform','model_route','model_version','guardrail_set_version','template_version'] IS NOT TRUE THEN
    RAISE EXCEPTION 'REPRO_KEY_INCOMPLETE: prompt version, platform, model route, model version, guardrail set version and template version are all pinned (8.2)';
  END IF;
  IF NEW.cost_ceiling IS NULL OR NEW.cost_ceiling <= 0 THEN RAISE EXCEPTION 'COST_CEILING_REQUIRED: every dispatch has a per-build cost ceiling (13.5)'; END IF;
  IF COALESCE(NEW.estimated_cost, 0) > NEW.cost_ceiling THEN
    RAISE EXCEPTION 'COST_CEILING_EXCEEDED: estimate % is over the per-build ceiling % (13.5)', NEW.estimated_cost, NEW.cost_ceiling;
  END IF;
  SELECT o.body->>'mission_ref', o.body->>'cell_ref' INTO m, c FROM public.objects o WHERE o.id = NEW.prompt_id;
  SELECT COALESCE(SUM(br.cost_actual), 0) + COALESCE(NEW.estimated_cost, 0) INTO committed
  FROM public.build_runs br JOIN public.objects po ON po.id = br.prompt_id
  WHERE po.body->>'mission_ref' IS NOT DISTINCT FROM m;
  SELECT (ceiling)::numeric INTO lim FROM public.cost_ceilings cs WHERE cs.scope = 'mission' AND cs.scope_id = COALESCE(m::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
  IF lim IS NOT NULL AND committed > lim THEN RAISE EXCEPTION 'MISSION_CEILING_EXCEEDED: mission build spend % passes the mission ceiling % (13.5)', committed, lim; END IF;
  RETURN NEW;
END $$;

-- 6. Dispatch records lineage only; no execution-state transition on the BuildRun
CREATE OR REPLACE FUNCTION public.thread_dispatch_build(p_actor jsonb, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr public.objects; cp public.creation_prompts; pf public.build_platforms; run public.objects; key jsonb; src public.build_runs; mode text;
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
  run := public.thread_create_object(p_actor, jsonb_build_object(
    'type', 'BuildRun', 'title', pf.label || ' build of ' || pr.human_ref || CASE WHEN p ? 'replay_of' THEN ' (replay)' ELSE '' END,
    'statement', 'Dispatched ' || pr.human_ref || ' to ' || pf.label, 'machine_description', 'BuildRun with pinned reproducibility key (Part 8.2)',
    'body', jsonb_build_object('reuse_check_ref', cp.reuse_check_id, 'prompt_ref', pr.id, 'platform', pf.platform, 'model_route_ref', key->>'model_route',
      'model_version_pin', key->>'model_version', 'guardrail_set_version', key->>'guardrail_set_version', 'template_version', key->>'template_version',
      'dispatched_at', now(), 'reproducibility_key', key, 'agent_actor', p_actor, 'authority_used', p_actor->>'authority_used', 'replay_of', p->>'replay_of',
      'provenance', jsonb_build_object('simulated', mode = 'simulated')),
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

-- 7. Record only the mirrored source outcome; never write execution status
CREATE OR REPLACE FUNCTION public.thread_record_build_result(p_actor jsonb, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE br public.build_runs; run public.objects; art jsonb; ao public.objects; arts jsonb := '[]'; st text; src public.build_runs; eq boolean; res jsonb;
BEGIN
  PERFORM public._assert_actor(p_actor);
  SELECT * INTO br FROM public.build_runs WHERE object_id = (p->>'run_id')::uuid;
  IF br.object_id IS NULL THEN RAISE EXCEPTION 'RUN_NOT_FOUND'; END IF;
  IF br.outcome IS NOT NULL THEN RAISE EXCEPTION 'RUN_FINISHED: % already finished', p->>'run_id'; END IF;
  SELECT * INTO run FROM public.objects WHERE id = br.object_id;
  st := COALESCE(p->>'outcome', p->>'status');
  IF st NOT IN ('succeeded','failed','partial') THEN RAISE EXCEPTION 'OUTCOME_INVALID: source outcome is succeeded, failed or partial'; END IF;
  IF st = 'succeeded' AND COALESCE(p->>'secrets_scan', '') <> 'clean' THEN
    st := 'failed';
    p := p || jsonb_build_object('failure_reason', 'SECRETS_SCAN_NOT_CLEAN: an artifact is accepted only with a clean secrets scan (8.2)');
  END IF;
  IF st = 'succeeded' AND (p->>'cost_actual')::numeric > br.cost_ceiling THEN
    st := 'failed';
    p := p || jsonb_build_object('failure_reason', 'COST_CEILING_BREACHED: actual cost passed the per-build ceiling');
  END IF;
  IF st = 'succeeded' THEN
    FOR art IN SELECT * FROM jsonb_array_elements(COALESCE(p->'artifacts', '[]')) LOOP
      ao := public.thread_create_object(p_actor, jsonb_build_object('type', 'BuildArtifact', 'title', (art->>'kind') || ' from ' || run.human_ref,
        'statement', 'Artifact ' || (art->>'uri'), 'machine_description', 'BuildArtifact produced by a BuildRun',
        'body', jsonb_build_object('run_ref', run.id, 'repository', art->>'repository', 'commit_or_version', art->>'commit', 'image_or_bundle', art->>'uri',
          'digest', art->>'hash', 'kind', art->>'kind', 'diff_ref', art->>'diff_ref', 'secrets_scan_result', p->>'secrets_scan',
          'files_changed', art->'files_changed', 'dependency_manifest', art->'dependency_manifest', 'backlink', jsonb_build_object('build_run', run.id),
          'provenance', jsonb_build_object('simulated', br.adapter_mode = 'simulated')),
        'review_date', (current_date + 180)::text, 'expiration_condition', jsonb_build_object('kind', 'explicit_event', 'params', jsonb_build_object('event', 'run_superseded')),
        'retirement_path', jsonb_build_object('mode', 'archive_evidence'), 'risk_tier', run.risk_tier::text, 'permission', run.permission,
        'data_classification', run.data_classification, 'derived_from', jsonb_build_array(run.id), 'adapter_mode', br.adapter_mode, 'rationale', 'artifact attached'));
      PERFORM public.thread_create_edge(p_actor, jsonb_build_object('verb', 'produced_artifact', 'from_id', run.id, 'to_id', ao.id, 'source', 'stated', 'rationale', 'artifact'));
      arts := arts || jsonb_build_object('kind', art->>'kind', 'uri', art->>'uri', 'hash', art->>'hash', 'artifact_id', ao.id);
    END LOOP;
  END IF;
  IF br.replay_of IS NOT NULL AND st = 'succeeded' THEN
    SELECT * INTO src FROM public.build_runs WHERE object_id = br.replay_of;
    eq := (SELECT COALESCE(array_agg(x->>'hash' ORDER BY x->>'hash'), '{}') FROM jsonb_array_elements(arts) x)
        = (SELECT COALESCE(array_agg(x->>'hash' ORDER BY x->>'hash'), '{}') FROM jsonb_array_elements(src.artifacts) x);
    res := jsonb_build_object('equivalent', eq, 'replay_mode', br.replay_mode,
      'verdict', CASE WHEN eq THEN 'equivalent artifact reproduced' WHEN br.replay_mode = 'best_effort' THEN 'best_effort: platform cannot guarantee determinism' ELSE 'NOT equivalent' END);
  END IF;
  PERFORM public._ledger_write(run.provenance_chain_id, p_actor, 'build.result', run,
    jsonb_build_object('adapter_mode', br.adapter_mode, 'outcome', st, 'mirrored_from', COALESCE(p->>'mirrored_from', 'platform_webhook'), 'external_run_id', p->>'external_run_id', 'replay_result', res));
  UPDATE public.build_runs SET outcome = st, mirrored_from = COALESCE(p->>'mirrored_from', 'platform_webhook'),
    external_run_id = COALESCE(p->>'external_run_id', external_run_id), cost_actual = (p->>'cost_actual')::numeric,
    duration_ms = (p->>'duration_ms')::int, artifacts = arts, failure_reason = p->>'failure_reason', completed_at = now(), replay_result = res
   WHERE object_id = br.object_id;
  RETURN jsonb_build_object('run_id', run.id, 'outcome', st, 'status', st, 'mirrored_from', COALESCE(p->>'mirrored_from', 'platform_webhook'), 'artifacts', arts, 'replay_result', res);
END $$;

-- 8. Skeleton gates on the mirrored outcome
CREATE OR REPLACE FUNCTION public.thread_record_skeleton(p_actor jsonb, p jsonb) RETURNS public.objects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE br public.build_runs; run public.objects; s public.objects;
BEGIN
  PERFORM public._assert_actor(p_actor);
  SELECT * INTO br FROM public.build_runs WHERE object_id = (p->>'run_id')::uuid;
  IF br.outcome IS DISTINCT FROM 'succeeded' THEN RAISE EXCEPTION 'SKELETON_NEEDS_SUCCESSFUL_RUN: a working skeleton is recorded from a succeeded run'; END IF;
  SELECT * INTO run FROM public.objects WHERE id = br.object_id;
  s := public.thread_create_object(p_actor, jsonb_build_object('type', 'WorkingSkeleton', 'title', COALESCE(p->>'title', 'Skeleton from ' || run.human_ref),
    'statement', COALESCE(p->>'one_real_user_process', 'thin end-to-end slice'), 'machine_description', 'WorkingSkeleton: the first thin end-to-end slice',
    'body', (COALESCE(p->'fields', '{}') || jsonb_build_object('run_ref', run.id, 'mission_ref', p->>'mission_ref', 'artifact_refs', COALESCE(p->'artifact_refs', '[]'::jsonb))),
    'review_date', (current_date + 90)::text, 'expiration_condition', jsonb_build_object('kind', 'explicit_event', 'params', jsonb_build_object('event', 'skeleton_superseded')),
    'retirement_path', jsonb_build_object('mode', 'archive_evidence'), 'risk_tier', run.risk_tier::text, 'permission', run.permission,
    'data_classification', run.data_classification, 'derived_from', jsonb_build_array(run.id), 'adapter_mode', br.adapter_mode, 'rationale', COALESCE(p->>'rationale', 'skeleton recorded')));
  RETURN s;
END $$;

-- 9. Live binding/callback use the mirrored outcome
CREATE OR REPLACE FUNCTION public.thread_bind_external_build(p_actor jsonb, p_run uuid, p_external text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE br public.build_runs; o public.objects;
BEGIN
  PERFORM public._assert_actor(p_actor);
  IF COALESCE(btrim(p_external),'') = '' OR length(p_external) > 200 THEN RAISE EXCEPTION 'EXTERNAL_RUN_REQUIRED'; END IF;
  SELECT * INTO br FROM public.build_runs WHERE object_id = p_run FOR UPDATE;
  SELECT * INTO o FROM public.objects WHERE id = p_run;
  IF br.object_id IS NULL OR br.adapter_mode <> 'live' THEN RAISE EXCEPTION 'LIVE_RUN_REQUIRED'; END IF;
  IF p_actor->>'kind' <> 'system' THEN PERFORM public._assert_can_write(p_actor, o); END IF;
  IF br.external_run_id IS NOT NULL THEN
    IF br.external_run_id <> p_external THEN RAISE EXCEPTION 'EXTERNAL_RUN_MISMATCH'; END IF;
    RETURN jsonb_build_object('run_id', p_run, 'external_run_id', p_external, 'already_bound', true);
  END IF;
  IF br.outcome IS NOT NULL THEN RAISE EXCEPTION 'RUN_FINISHED'; END IF;
  PERFORM public._ledger_write(o.provenance_chain_id, p_actor, 'build.accepted', o, jsonb_build_object('external_run_id', p_external, 'adapter_mode', 'live'));
  UPDATE public.build_runs SET external_run_id = p_external WHERE object_id = p_run;
  RETURN jsonb_build_object('run_id', p_run, 'external_run_id', p_external);
END $$;

CREATE OR REPLACE FUNCTION public.thread_receive_build_result(p_actor jsonb, p_platform text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE br public.build_runs; o public.objects; fingerprint text; result jsonb;
BEGIN
  PERFORM public._assert_actor(p_actor);
  IF p_actor->>'kind' <> 'system' OR p_actor->>'id' IS DISTINCT FROM 'build-platform:' || p_platform THEN RAISE EXCEPTION 'VERIFIED_PLATFORM_REQUIRED'; END IF;
  SELECT * INTO br FROM public.build_runs WHERE object_id = (p->>'run_id')::uuid FOR UPDATE;
  IF br.object_id IS NULL OR br.adapter_mode <> 'live' OR br.platform <> p_platform THEN RAISE EXCEPTION 'LIVE_RUN_REQUIRED'; END IF;
  IF COALESCE(btrim(p->>'external_run_id'), '') = '' THEN RAISE EXCEPTION 'EXTERNAL_RUN_REQUIRED'; END IF;
  fingerprint := encode(extensions.digest(convert_to(p::text, 'UTF8'), 'sha256'), 'hex');
  IF br.outcome IS NOT NULL THEN
    IF br.result_payload_hash = fingerprint THEN RETURN jsonb_build_object('run_id', br.object_id, 'outcome', br.outcome, 'status', br.outcome, 'duplicate', true); END IF;
    RAISE EXCEPTION 'RESULT_CONFLICT: finished result cannot be changed';
  END IF;
  PERFORM public.thread_bind_external_build(p_actor, br.object_id, p->>'external_run_id');
  result := public.thread_record_build_result(p_actor, p || jsonb_build_object('mirrored_from', 'platform_webhook:' || p_platform));
  SELECT * INTO o FROM public.objects WHERE id = br.object_id;
  PERFORM public._ledger_write(o.provenance_chain_id, p_actor, 'build.callback_receipt', o, jsonb_build_object('result_payload_hash', fingerprint, 'adapter_mode', 'live'));
  UPDATE public.build_runs SET result_payload_hash = fingerprint WHERE object_id = br.object_id;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.thread_bind_external_build(jsonb,uuid,text), public.thread_receive_build_result(jsonb,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.thread_bind_external_build(jsonb,uuid,text), public.thread_receive_build_result(jsonb,text,jsonb) TO service_role;

-- 10. Audit self-test: the finished-run check reads the mirrored outcome and proves the status lock
CREATE OR REPLACE FUNCTION public.thread_audit_security_selftest() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a jsonb:='{"kind":"system","id":"thread.audit.rollback","authority_used":"observe"}'; o public.objects; r jsonb; checks jsonb:='[]'; disp jsonb; run_id uuid; callback jsonb; x jsonb; before_count bigint;
BEGIN
 SELECT count(*) INTO before_count FROM public.objects;
 BEGIN
  BEGIN PERFORM public._assert_actor('{"id":"forged","authority_used":"observe"}'); checks:=checks||jsonb_build_object('name','missing actor kind refused','pass',false); EXCEPTION WHEN OTHERS THEN checks:=checks||jsonb_build_object('name','missing actor kind refused','pass',SQLERRM LIKE 'ACTOR_REQUIRED%'); END;
  o:=public.thread_create_object(a,public._fx_payload('ValueSignal','audit current evidence',jsonb_build_object('observed_condition','test')));
  o.expires_at:=now()-interval '1 second'; checks:=checks||jsonb_build_object('name','expired evidence unusable','pass',public._audit_current_evidence(o) IS FALSE);
  o.expires_at:=NULL; o.retired_at:=now(); checks:=checks||jsonb_build_object('name','retired evidence unusable','pass',public._audit_current_evidence(o) IS FALSE);
  o.retired_at:=NULL; o.lifecycle_state:='superseded'; checks:=checks||jsonb_build_object('name','superseded evidence unusable','pass',public._audit_current_evidence(o) IS FALSE);
  BEGIN PERFORM public.thread_compose_capabilities(a,ARRAY[o.id,o.id],'duplicate','test'); checks:=checks||jsonb_build_object('name','duplicate components refused','pass',false); EXCEPTION WHEN OTHERS THEN checks:=checks||jsonb_build_object('name','duplicate components refused','pass',SQLERRM LIKE 'COMPOSITION_NEEDS_DISTINCT_PARTS%'); END;
  SELECT id INTO run_id FROM public.objects WHERE type='CreationPrompt' AND NOT is_tombstone ORDER BY created_at DESC LIMIT 1;
  IF run_id IS NOT NULL THEN
   disp:=public.thread_dispatch_build(a,jsonb_build_object('prompt_id',run_id,'platform','lovable','cost_ceiling',0.01,'estimated_cost',0,'model_version','audit-test','adapter_mode','live'));
   run_id:=(disp->>'run_id')::uuid;
   callback:=jsonb_build_object('run_id',run_id,'external_run_id','audit-external-'||run_id,'outcome','failed','failure_reason','rollback-only callback test','artifacts','[]'::jsonb);
   a:=jsonb_build_object('kind','system','id','build-platform:lovable','authority_used','observe');
   x:=public.thread_receive_build_result(a,'lovable',callback);
   checks:=checks||jsonb_build_object('name','callback before dispatch response binds external identity','pass',EXISTS(SELECT 1 FROM public.build_runs WHERE object_id=run_id AND external_run_id=callback->>'external_run_id' AND outcome='failed' AND mirrored_from='platform_webhook:lovable'));
   x:=public.thread_bind_external_build(a,run_id,callback->>'external_run_id');
   checks:=checks||jsonb_build_object('name','late dispatch binding is idempotent','pass',x->>'already_bound'='true');
   x:=public.thread_receive_build_result(a,'lovable',callback);
   checks:=checks||jsonb_build_object('name','identical callback retry is idempotent','pass',x->>'duplicate'='true');
   BEGIN PERFORM public.thread_receive_build_result(a,'lovable',callback||'{"failure_reason":"changed"}'::jsonb); checks:=checks||jsonb_build_object('name','conflicting callback refused','pass',false); EXCEPTION WHEN OTHERS THEN checks:=checks||jsonb_build_object('name','conflicting callback refused','pass',SQLERRM LIKE 'RESULT_CONFLICT%'); END;
   BEGIN UPDATE public.build_runs SET status='succeeded' WHERE object_id=run_id; checks:=checks||jsonb_build_object('name','legacy execution status is write-locked','pass',false); EXCEPTION WHEN OTHERS THEN checks:=checks||jsonb_build_object('name','legacy execution status is write-locked','pass',SQLERRM LIKE 'EXECUTION_STATE_NOT_OWNED%'); END;
  ELSE checks:=checks||jsonb_build_object('name','callback fixtures available','pass',false,'blocker','no compiled prompt'); END IF;
  RAISE EXCEPTION USING ERRCODE='TT001',MESSAGE='rollback audit fixtures';
 EXCEPTION WHEN SQLSTATE 'TT001' THEN NULL;
 WHEN OTHERS THEN checks:=checks||jsonb_build_object('name','fixture execution','pass',false,'error',SQLERRM);
 END;
 checks:=checks||jsonb_build_object('name','all fixture objects rolled back','pass',(SELECT count(*)=before_count FROM public.objects));
 RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE c->>'pass' IS DISTINCT FROM 'true'),'checks',checks,'mode','simulated','fixtures','rollback-only');
END $$;
REVOKE ALL ON FUNCTION public.thread_audit_security_selftest() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_audit_security_selftest() TO service_role;

-- 11. AW-16: fail on any live execution-state column; the deprecated, write-locked legacy column passes
CREATE OR REPLACE FUNCTION public.aw16_state_ownership_scan() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE violations jsonb; legacy_ok boolean; passed boolean;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name, 'reason', 'Execution state requires removal or read-only source mirror')), '[]'::jsonb)
  INTO violations
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN ('build_status','deployment_state','pipeline_state','release_state','is_released');
  legacy_ok := NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='build_runs' AND column_name='status')
    OR (
      (SELECT pg_catalog.col_description(('public.build_runs')::regclass, (SELECT ordinal_position FROM information_schema.columns WHERE table_schema='public' AND table_name='build_runs' AND column_name='status'))) LIKE 'DEPRECATED:%'
      AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='build_runs' AND t.tgname='build_runs_status_lock')
    );
  IF NOT legacy_ok THEN
    violations := violations || jsonb_build_object('table','build_runs','column','status','reason','Legacy execution status column is live: not deprecated or not write-locked');
  END IF;
  passed := jsonb_array_length(violations) = 0;
  RETURN jsonb_build_object('id','AW-16','passed',passed,'violations',violations,'rendered_scan','pending_authenticated_full_surface_scan');
END $$;

-- 12. Deployment assertions: fail closed if the conversion is incomplete
DO $aw16$
DECLARE d text; r jsonb;
BEGIN
  SELECT pg_get_functiondef('public.thread_record_build_result(jsonb,jsonb)'::regprocedure) INTO d;
  IF position('set status' IN lower(d)) > 0 THEN RAISE EXCEPTION 'AW16_PATCH_NOT_APPLIED: result recording still writes execution status'; END IF;
  IF position('br.outcome IS NOT NULL' IN d) = 0 THEN RAISE EXCEPTION 'AW16_PATCH_NOT_APPLIED: finished gate does not read the mirrored outcome'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='build_runs' AND t.tgname='build_runs_status_lock') THEN
    RAISE EXCEPTION 'AW16_PATCH_NOT_APPLIED: status write-lock trigger missing';
  END IF;
  r := public.aw16_state_ownership_scan();
  IF r->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'AW16_SCAN_FAILING: %', r; END IF;
END $aw16$;
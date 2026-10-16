-- Behavioral negative tests use rollback-only fixtures, never invented live assurance.
CREATE OR REPLACE FUNCTION public.thread_phase12_behavioral_selftest() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; actor jsonb; subject public.objects; evidence public.objects; report jsonb; ctx jsonb; ok boolean; checks jsonb:='[]'; before_objects bigint;
BEGIN
 SELECT user_id INTO uid FROM public.user_roles WHERE role='steward' ORDER BY user_id LIMIT 1;
 IF uid IS NULL THEN RETURN jsonb_build_object('passed',false,'blocker','steward required'); END IF;
 actor:=jsonb_build_object('kind','human','id',uid,'authority_used','observe');
 SELECT count(*) INTO before_objects FROM public.objects;
 BEGIN
  subject:=public.thread_create_object(actor,public._fx_payload('ValueSignal','Phase12 bounded subject',jsonb_build_object('observed_condition','assurance needs evidence')));
  evidence:=public.thread_create_object(actor,public._fx_payload('SecurityScan','Phase12 simulated scan',jsonb_build_object('kind','dast','adapter_mode','simulated')));
  BEGIN
   PERFORM public.thread_record_assurance(actor,jsonb_build_object('subject_id',subject.id,'kind','penetration','result','passed','evidence_refs',jsonb_build_array(evidence.id),'rationale','synthetic is not live'));
   ok:=false;
  EXCEPTION WHEN OTHERS THEN ok:=SQLERRM LIKE 'LIVE_CURRENT_EVIDENCE_REQUIRED%'; END;
  checks:=checks||jsonb_build_array(jsonb_build_object('name','simulated scan cannot pass penetration assurance','pass',ok));
  report:=public.thread_record_assurance(actor,jsonb_build_object('subject_id',subject.id,'kind','penetration','result','pending_live_adapter','evidence_refs',jsonb_build_array(evidence.id),'rationale','await independent authorized test'));
  checks:=checks||jsonb_build_array(jsonb_build_object('name','pending condition recorded honestly','pass',report->>'result'='pending_live_adapter'));
  checks:=checks||jsonb_build_array(jsonb_build_object('name','assurance has ledger-first subject edge','pass',EXISTS(SELECT 1 FROM public.edges WHERE from_id=subject.id AND to_id=(report->>'id')::uuid AND verb='control_checked_by')));
  BEGIN
   PERFORM public.thread_record_assurance(actor,jsonb_build_object('subject_id',subject.id,'kind','load','result','passed','evidence_refs','[]'::jsonb,'rationale','no evidence'));
   ok:=false;
  EXCEPTION WHEN OTHERS THEN ok:=SQLERRM LIKE 'EVIDENCE_REQUIRED%'; END;
  checks:=checks||jsonb_build_array(jsonb_build_object('name','empty assurance evidence refused','pass',ok));
  BEGIN
   PERFORM public._assert_independent_judgment(subject.id,evidence.id,actor); ok:=false;
  EXCEPTION WHEN OTHERS THEN ok:=SQLERRM LIKE 'INDEPENDENT_JUDGMENT_REQUIRED%'; END;
  checks:=checks||jsonb_build_array(jsonb_build_object('name','arbitrary evidence is not independent judgment','pass',ok));
  ctx:=public.human_surface_context(subject.id);
  checks:=checks||jsonb_build_array(jsonb_build_object('name','bounded context keeps connected assurance','pass',jsonb_array_length(ctx->'objects')>=2 AND jsonb_array_length(ctx->'objects')<=200 AND jsonb_array_length(ctx->'edges')<=1000));
  RAISE EXCEPTION 'PHASE12_FIXTURE_ROLLBACK';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'PHASE12_FIXTURE_ROLLBACK' THEN checks:=checks||jsonb_build_array(jsonb_build_object('name','fixture execution','pass',false,'error',SQLERRM)); END IF;
 END;
 checks:=checks||jsonb_build_array(jsonb_build_object('name','fixture objects rolled back','pass',(SELECT count(*)=before_objects FROM public.objects)));
 RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE c->>'pass' IS DISTINCT FROM 'true'),'checks',checks,'mode','simulated','fixtures','rollback-only');
END $$;
REVOKE ALL ON FUNCTION public.thread_phase12_behavioral_selftest() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_phase12_behavioral_selftest() TO service_role;
DO $acceptance$
DECLARE report jsonb;
BEGIN
 report:=public.thread_phase12_behavioral_selftest();
 IF report->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PHASE12_BEHAVIORAL_ACCEPTANCE_FAILED: %',report; END IF;
 report:=public.thread_phase11_selftest();
 IF report->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PHASE11_REGRESSION: %',report; END IF;
END $acceptance$;
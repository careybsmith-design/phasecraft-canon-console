-- Regression suite: all fixture writes live in a rollback-only subtransaction; live labels here are test inputs, never assurance proof.
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
   callback:=jsonb_build_object('run_id',run_id,'external_run_id','audit-external-'||run_id,'status','failed','failure_reason','rollback-only callback test','artifacts','[]'::jsonb);
   a:=jsonb_build_object('kind','system','id','build-platform:lovable','authority_used','observe');
   x:=public.thread_receive_build_result(a,'lovable',callback);
   checks:=checks||jsonb_build_object('name','callback before dispatch response binds external identity','pass',EXISTS(SELECT 1 FROM public.build_runs WHERE object_id=run_id AND external_run_id=callback->>'external_run_id' AND status='failed'));
   x:=public.thread_bind_external_build(a,run_id,callback->>'external_run_id');
   checks:=checks||jsonb_build_object('name','late dispatch binding is idempotent','pass',x->>'already_bound'='true');
   x:=public.thread_receive_build_result(a,'lovable',callback);
   checks:=checks||jsonb_build_object('name','identical callback retry is idempotent','pass',x->>'duplicate'='true');
   BEGIN PERFORM public.thread_receive_build_result(a,'lovable',callback||'{"failure_reason":"changed"}'::jsonb); checks:=checks||jsonb_build_object('name','conflicting callback refused','pass',false); EXCEPTION WHEN OTHERS THEN checks:=checks||jsonb_build_object('name','conflicting callback refused','pass',SQLERRM LIKE 'RESULT_CONFLICT%'); END;
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
DO $$ DECLARE r jsonb; BEGIN r:=public.thread_audit_security_selftest(); IF r->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'AUDIT_REGRESSION_FAILED: %',r; END IF; END $$;
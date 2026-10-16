ALTER TABLE public.build_runs ADD COLUMN result_payload_hash text;
CREATE OR REPLACE FUNCTION public.thread_bind_external_build(p_actor jsonb,p_run uuid,p_external text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE br public.build_runs; o public.objects;
BEGIN
 PERFORM public._assert_actor(p_actor);
 IF coalesce(btrim(p_external),'')='' OR length(p_external)>200 THEN RAISE EXCEPTION 'EXTERNAL_RUN_REQUIRED'; END IF;
 SELECT * INTO br FROM public.build_runs WHERE object_id=p_run FOR UPDATE;
 SELECT * INTO o FROM public.objects WHERE id=p_run;
 IF br.object_id IS NULL OR br.adapter_mode<>'live' THEN RAISE EXCEPTION 'LIVE_RUN_REQUIRED'; END IF;
 IF p_actor->>'kind'<>'system' THEN PERFORM public._assert_can_write(p_actor,o); END IF;
 IF br.external_run_id IS NOT NULL THEN
  IF br.external_run_id<>p_external THEN RAISE EXCEPTION 'EXTERNAL_RUN_MISMATCH'; END IF;
  RETURN jsonb_build_object('run_id',p_run,'external_run_id',p_external,'already_bound',true);
 END IF;
 IF br.status IN ('succeeded','failed') THEN RAISE EXCEPTION 'RUN_FINISHED'; END IF;
 PERFORM public._ledger_write(o.provenance_chain_id,p_actor,'build.accepted',o,jsonb_build_object('external_run_id',p_external,'adapter_mode','live'));
 UPDATE public.build_runs SET external_run_id=p_external WHERE object_id=p_run;
 RETURN jsonb_build_object('run_id',p_run,'external_run_id',p_external);
END $$;
CREATE OR REPLACE FUNCTION public.thread_receive_build_result(p_actor jsonb,p_platform text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE br public.build_runs; o public.objects; fingerprint text; result jsonb;
BEGIN
 PERFORM public._assert_actor(p_actor);
 IF p_actor->>'kind'<>'system' OR p_actor->>'id' IS DISTINCT FROM 'build-platform:'||p_platform THEN RAISE EXCEPTION 'VERIFIED_PLATFORM_REQUIRED'; END IF;
 SELECT * INTO br FROM public.build_runs WHERE object_id=(p->>'run_id')::uuid FOR UPDATE;
 IF br.object_id IS NULL OR br.adapter_mode<>'live' OR br.platform<>p_platform THEN RAISE EXCEPTION 'LIVE_RUN_REQUIRED'; END IF;
 IF coalesce(btrim(p->>'external_run_id'),'')='' THEN RAISE EXCEPTION 'EXTERNAL_RUN_REQUIRED'; END IF;
 fingerprint:=encode(extensions.digest(convert_to(p::text,'UTF8'),'sha256'),'hex');
 IF br.status IN ('succeeded','failed') THEN
  IF br.result_payload_hash=fingerprint THEN RETURN jsonb_build_object('run_id',br.object_id,'status',br.status,'duplicate',true); END IF;
  RAISE EXCEPTION 'RESULT_CONFLICT: finished result cannot be changed';
 END IF;
 PERFORM public.thread_bind_external_build(p_actor,br.object_id,p->>'external_run_id');
 result:=public.thread_record_build_result(p_actor,p);
 SELECT * INTO o FROM public.objects WHERE id=br.object_id;
 PERFORM public._ledger_write(o.provenance_chain_id,p_actor,'build.callback_receipt',o,jsonb_build_object('result_payload_hash',fingerprint,'adapter_mode','live'));
 UPDATE public.build_runs SET result_payload_hash=fingerprint WHERE object_id=br.object_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.thread_bind_external_build(jsonb,uuid,text),public.thread_receive_build_result(jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_bind_external_build(jsonb,uuid,text),public.thread_receive_build_result(jsonb,text,jsonb) TO service_role;

-- Exact assertions confirm applied assurance patches and endpoint isolation.
DO $audit$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.thread_record_assurance(jsonb,jsonb)'::regprocedure) INTO d;
 IF position('_audit_current_evidence(subject)' IN d)=0 OR position('_audit_current_evidence(e)' IN d)=0 OR position('COMPLIANCE_EXECUTION_REQUIRED' IN d)=0 THEN RAISE EXCEPTION 'ASSURANCE_PATCH_NOT_APPLIED'; END IF;
 IF has_function_privilege('authenticated','public.thread_receive_build_result(jsonb,text,jsonb)','execute') OR has_function_privilege('anon','public.thread_bind_external_build(jsonb,uuid,text)','execute') THEN RAISE EXCEPTION 'PLATFORM_WRITE_EXPOSED'; END IF;
END $audit$;
CREATE OR REPLACE FUNCTION public.thread_detection_sweep(p_actor jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x record; nn int:=0; nr int:=0; seq bigint; candidates jsonb;
BEGIN
 PERFORM public._assert_actor(p_actor); PERFORM public._phase10_register(); PERFORM pg_advisory_xact_lock(hashtext('thread-detection-sweep')); PERFORM set_config('thread.detection_sweeping','on',true);
 UPDATE public.detector_findings SET state='open',accepted_by=NULL,accepted_until=NULL,resolution=resolution||jsonb_build_object('expired_acceptance_at',now()) WHERE state='accepted_risk' AND accepted_until<=now();
 PERFORM public.thread_graph_sweep(p_actor); PERFORM public.thread_framing_sweep(p_actor);
 -- Compute the native candidate set once, not once per open finding plus once again for insertion.
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO candidates FROM public.detection_candidates() c;
 UPDATE public.detector_findings f SET state='resolved',resolved_at=now(),resolution=jsonb_build_object('kind','condition_cleared','at',now())
 WHERE f.state='open' AND f.evidence->>'phase10'='true' AND NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(candidates) AS c(detector_key text,object_id uuid,severity text,evidence jsonb)
 WHERE c.detector_key=f.detector_key AND c.object_id IS NOT DISTINCT FROM f.object_id AND coalesce(c.evidence->>'observation_id',c.evidence->>'rendition_id','')=coalesce(f.evidence->>'observation_id',f.evidence->>'rendition_id',''));
 GET DIAGNOSTICS nr=ROW_COUNT;
 FOR x IN SELECT DISTINCT ON(c.detector_key,c.object_id,coalesce(c.evidence->>'observation_id',c.evidence->>'rendition_id','')) c.*,d.owner_id
 FROM jsonb_to_recordset(candidates) AS c(detector_key text,object_id uuid,severity text,evidence jsonb) JOIN public.detectors d ON d.key=c.detector_key LOOP
  IF NOT EXISTS(SELECT 1 FROM public.detector_findings f WHERE f.detector_key=x.detector_key AND f.object_id IS NOT DISTINCT FROM x.object_id AND f.state IN('open','accepted_risk') AND coalesce(f.evidence->>'observation_id',f.evidence->>'rendition_id','')=coalesce(x.evidence->>'observation_id',x.evidence->>'rendition_id','')) THEN
   INSERT INTO public.detector_findings(id,detector_key,object_id,severity,owner_id,state,evidence) VALUES(public.uuid_v7(),x.detector_key,x.object_id,x.severity,x.owner_id,'open',x.evidence||jsonb_build_object('phase10',true)); nn:=nn+1;
  END IF;
 END LOOP;
 seq:=public._mcp_ledger(p_actor,'detector.sweep.phase10',NULL,jsonb_build_object('new',nn,'resolved',nr)); PERFORM set_config('thread.detection_sweeping','off',true);
 RETURN jsonb_build_object('new',nn,'resolved',nr,'ledger_seq',seq,'computed_at',now());
END $$;
REVOKE ALL ON FUNCTION public.thread_detection_sweep(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_detection_sweep(jsonb) TO service_role;
DO $$ DECLARE r jsonb; BEGIN r:=public.thread_phase10_selftest(); IF r->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'DETECTOR_REGRESSION_FAILED: %',r; END IF; END $$;
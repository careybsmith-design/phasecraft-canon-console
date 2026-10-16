CREATE OR REPLACE FUNCTION public.phase10_flow_intervals() RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
WITH s AS (SELECT o.id,o.human_ref,o.type,o.created_at,
(SELECT min(v.updated_at) FROM public.object_versions v WHERE v.id=o.id AND v.lifecycle_state='enriched') enriched,
(SELECT min(v.updated_at) FROM public.object_versions v WHERE v.id=o.id AND v.lifecycle_state='activated') activated,
(SELECT min(v.updated_at) FROM public.object_versions v WHERE v.id=o.id AND v.lifecycle_state IN('skeleton','succeeded')) working,
(SELECT min(v.updated_at) FROM public.object_versions v WHERE v.id=o.id AND v.lifecycle_state IN('verified_in_simulation','verified_in_shadow')) validation,
(SELECT min(v.updated_at) FROM public.object_versions v WHERE v.id=o.id AND v.lifecycle_state='shadow') shadow,
(SELECT min(v.updated_at) FROM public.object_versions v WHERE v.id=o.id AND v.lifecycle_state='limited_exposure') bounded
FROM public.objects o WHERE NOT o.is_tombstone), r AS (
SELECT 'Signal detection to enrichment' label,id,human_ref,created_at t0,enriched t1 FROM s WHERE type='ValueSignal'
UNION ALL SELECT 'Signal to mission activation',m.id,m.human_ref,s.created_at,m.activated FROM s JOIN public.edges e ON e.retired_at IS NULL AND e.verb IN('promoted_from','signals') AND (e.from_id=s.id OR e.to_id=s.id) JOIN s m ON m.type='ValueMission' AND (m.id=e.from_id OR m.id=e.to_id) WHERE s.type='ValueSignal'
UNION ALL SELECT 'Activation to first working evidence',m.id,m.human_ref,m.activated,min(w.working) FROM s m JOIN public.objects c ON c.body->>'mission_ref'=m.id::text JOIN s w ON w.id=c.id WHERE m.type='ValueMission' GROUP BY m.id,m.human_ref,m.activated
UNION ALL SELECT 'First working evidence to Co-Creator validation',id,human_ref,working,validation FROM s WHERE type IN('WorkingCapability','ComposableCapability')
UNION ALL SELECT 'Validation to production shadow',id,human_ref,validation,shadow FROM s WHERE type IN('WorkingCapability','ComposableCapability')
UNION ALL SELECT 'Shadow to bounded production',id,human_ref,shadow,bounded FROM s WHERE type IN('WorkingCapability','ComposableCapability')
UNION ALL SELECT 'Decision to implemented change',d.id,d.human_ref,d.created_at,min(v.updated_at) FROM public.objects d JOIN public.objects b ON b.body->>'source_decision_ref' IN(d.id::text,d.human_ref) JOIN public.object_versions v ON v.id=b.id AND v.lifecycle_state IN('generating','verified_in_simulation','verified_in_shadow','verified_in_production') WHERE d.type='ConfirmedDecision' AND NOT d.is_tombstone AND NOT b.is_tombstone GROUP BY d.id,d.human_ref,d.created_at)
SELECT coalesce(jsonb_agg(jsonb_build_object('label',label,'id',id,'ref',human_ref,'from',t0,'to',t1,'hours',public.phase10_elapsed_hours(t0,t1),'status',CASE WHEN t0 IS NULL OR t1 IS NULL THEN 'NO_EVIDENCE' ELSE 'measured' END,'source','object versions and typed links')),'[]') FROM r $$;
REVOKE ALL ON FUNCTION public.phase10_flow_intervals() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.phase10_flow_intervals() TO authenticated,service_role;
DO $$ DECLARE source text; BEGIN SELECT pg_get_functiondef('public.phase10_measurements_extended()'::regprocedure) INTO source; source:=replace(source,'f:=b->''flow'';','f:=b->''flow''||jsonb_build_object(''computed_intervals'',public.phase10_flow_intervals());'); EXECUTE source; END $$;
CREATE OR REPLACE FUNCTION public.thread_phase10_risk_test() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE own uuid; f uuid; x jsonb; ok boolean:=false; result jsonb:='[]'; BEGIN SELECT user_id INTO own FROM public.user_roles WHERE role='steward' ORDER BY user_id LIMIT 1; PERFORM public._phase10_register();
BEGIN
INSERT INTO public.detector_findings(id,detector_key,severity,owner_id,state,evidence) VALUES(public.uuid_v7(),'WikiDrift','high',own,'open','{"test":true}') RETURNING id INTO f;
PERFORM public.thread_resolve_finding(jsonb_build_object('kind','human','id',own,'authority_used','observe'),f,'Time-limited acceptance for isolated test',now()+interval '1 hour');
SELECT state='accepted_risk' AND accepted_by=own AND accepted_until>now() AND resolution ? 'explanation' INTO ok FROM public.detector_findings WHERE id=f;
result:=result||jsonb_build_object('name','Accepted risk records approver and expiry','pass',ok);
BEGIN PERFORM public.thread_resolve_finding(jsonb_build_object('kind','human','id',own,'authority_used','observe'),f,'Invalid expired acceptance',now()-interval '1 hour'); ok:=false; EXCEPTION WHEN OTHERS THEN ok:=SQLERRM LIKE 'FUTURE_EXPIRY_REQUIRED%'; END;
result:=result||jsonb_build_object('name','Past accepted-risk expiry is refused','pass',ok);
UPDATE public.detector_findings SET accepted_until=now()-interval '1 second' WHERE id=f; PERFORM public.thread_detection_sweep('{"kind":"system","id":"phase10-risk-test","authority_used":"observe"}');
result:=result||jsonb_build_object('name','Accepted risk reopens on expiry','pass',EXISTS(SELECT 1 FROM public.detector_findings WHERE id=f AND state='open'));
RAISE EXCEPTION SQLSTATE 'PT010' USING MESSAGE='rollback fixtures'; EXCEPTION WHEN SQLSTATE 'PT010' THEN NULL; END;
RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result) r WHERE r->>'pass'<>'true'),'checks',result); END $$;
REVOKE ALL ON FUNCTION public.thread_phase10_risk_test() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.thread_phase10_risk_test() TO service_role;
DO $$ DECLARE ev jsonb; source text; BEGIN ev:=public.thread_phase10_risk_test(); IF ev->>'passed'<>'true' THEN RAISE EXCEPTION 'Risk acceptance test failed: %',ev; END IF; SELECT pg_get_functiondef('public.thread_record_phase10_evidence(jsonb)'::regprocedure) INTO source; source:=replace(source,'ev->''checks''||(graph_ev->''checks'')','ev->''checks''||(graph_ev->''checks'')||(public.thread_phase10_risk_test()->''checks'')'); EXECUTE source; END $$;
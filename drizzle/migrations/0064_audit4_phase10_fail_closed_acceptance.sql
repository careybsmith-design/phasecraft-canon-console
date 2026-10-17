-- Audit round 4: close four acceptance gaps found in the Section 17/anti-wiki re-check.
-- 1) NULL assertions must fail, not pass: '<>'true'' excludes NULL under three-valued logic.
-- 2) Recorded Phase 10 evidence must aggregate the risk-test verdict, not just its checks.
-- 3) The native signal-detector check must match the finding to the fixture it created.

CREATE OR REPLACE FUNCTION public.thread_phase10_selftest() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c record; own uuid; obs uuid; results jsonb:='[]'; ok boolean; BEGIN PERFORM public._phase10_register(); SELECT owner_id INTO own FROM public.detectors LIMIT 1;
BEGIN FOR c IN SELECT * FROM public.detection_catalogue() LOOP INSERT INTO public.detection_observations(owner_id,facts,rationale) VALUES(own,jsonb_build_object(c.fact,true),'Isolated deliberate failure fixture') RETURNING id INTO obs; PERFORM public.thread_detection_sweep('{"kind":"system","id":"phase10-selftest","authority_used":"observe"}'); SELECT EXISTS(SELECT 1 FROM public.detector_findings WHERE detector_key=c.key AND owner_id IS NOT NULL AND evidence->>'observation_id'=obs::text AND state='open') INTO ok; results:=results||jsonb_build_object('name',c.key,'pass',ok,'detail','Explicit evidence observation detected with owner'); UPDATE public.detection_observations SET expires_at=now()-interval '1 second' WHERE id=obs; END LOOP;
results:=results||jsonb_build_object('name','Rejected measure schema','pass',(public.phase10_schema_check()->>'pass')::boolean,'detail','Public fields and tables'); results:=results||jsonb_build_object('name','Intent-to-value arithmetic','pass',public.phase10_elapsed_hours('2026-10-01 12:00Z','2026-10-03 18:00Z')=54,'detail','54 hours'); RAISE EXCEPTION SQLSTATE 'PT010' USING MESSAGE='rollback fixtures'; EXCEPTION WHEN SQLSTATE 'PT010' THEN NULL; END; RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(results) r WHERE r->>'pass' IS DISTINCT FROM 'true'),'checks',results,'fixture_mode','explicit_observation; rollback; native graph inductions remain separate'); END $$;

CREATE OR REPLACE FUNCTION public.thread_phase10_graph_test() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE a jsonb:='{"kind":"system","id":"phase10-graph-selftest","authority_used":"observe"}'; sig public.objects; sig2 public.objects; dec public.objects; bs public.objects; cap public.objects; po public.objects; vm public.objects; res jsonb:='[]'; m jsonb; BEGIN
BEGIN
sig:=public.thread_create_object(a,public._fx_payload('ValueSignal','Phase10 measurable signal','{"observed_condition":"claims wait","baseline_performance":"9 days"}'));
dec:=public.thread_create_object(a,public._fx_payload('ConfirmedDecision','Phase10 confirmed intent',jsonb_build_object('signal_ref',sig.id,'decision','reduce wait','effective_from','2026-10-01T12:00:00Z')));
bs:=public.thread_create_object(a,public._fx_payload('BehaviorStatement','Phase10 measurable behaviour',jsonb_build_object('condition','claim arrives','observable_result','claim routed','source_decision_ref',dec.id,'confirmation',jsonb_build_object('at','2026-10-01T12:00:00Z'))));
bs:=public.thread_transition_object(a,bs.id,bs.version,'confirmed','isolated fixture');
cap:=public.thread_create_object(a,public._fx_payload('ComposableCapability','Phase10 capability',public._p4_cap_body('Claim routing',ARRAY['claim'],ARRAY['route'])));
PERFORM public.thread_create_edge(a,jsonb_build_object('verb','references_capability','from_id',bs.id,'to_id',cap.id,'source','stated','rationale','isolated fixture'));
po:=public.thread_create_object(a,public._fx_payload('ProductionOutcome','Phase10 live outcome',jsonb_build_object('capability_ref',cap.id,'adapter_mode','live','provenance',jsonb_build_object('simulated',false),'behaviour_observed','routed')));
vm:=public.thread_create_object(a,public._fx_payload('ValueMeasure','Phase10 cycle time',jsonb_build_object('baseline',9,'delta',-6,'value',3,'unit','days','source_evidence',jsonb_build_array(po.id),'realised_at','2026-10-03T18:00:00Z','adapter_mode','live','provenance',jsonb_build_object('simulated',false))));
PERFORM public.thread_create_edge(a,jsonb_build_object('verb','observed_as','from_id',cap.id,'to_id',po.id,'source','stated','rationale','isolated fixture'));
PERFORM public.thread_create_edge(a,jsonb_build_object('verb','values','from_id',po.id,'to_id',vm.id,'source','stated','rationale','isolated fixture'));
m:=public.get_intent_to_value_time(cap.id); res:=res||jsonb_build_object('name','Intent-to-value computed from connected graph','pass',(m->>'hours')::numeric=54 AND m->>'status'='measured','detail',m);
BEGIN PERFORM public.thread_create_object(a,public._fx_payload('Metric','story points','{"definition":"activity"}')); res:=res||jsonb_build_object('name','Rejected measure write refused','pass',false); EXCEPTION WHEN OTHERS THEN res:=res||jsonb_build_object('name','Rejected measure write refused','pass',SQLERRM LIKE 'MEASURE_REFUSED%','detail',SQLERRM); END;
BEGIN PERFORM public.thread_create_object(a,public._fx_payload('Metric','Draft progress','{"counts_drafts":true}')); res:=res||jsonb_build_object('name','Draft measure write refused','pass',false); EXCEPTION WHEN OTHERS THEN res:=res||jsonb_build_object('name','Draft measure write refused','pass',SQLERRM LIKE 'MEASURE_REFUSED%','detail',SQLERRM); END;
sig2:=public.thread_create_object(a,public._fx_payload('ValueSignal','Phase10 unframed solution','{"requested_solution_candidates":["an app"]}'));
res:=res||jsonb_build_object('name','Native graph signal detector runs on write','pass',EXISTS(SELECT 1 FROM public.detector_findings WHERE detector_key='RequestedSolutionWithoutCondition' AND evidence->>'source'='graph' AND owner_id IS NOT NULL AND object_id=sig2.id));
RAISE EXCEPTION SQLSTATE 'PT010' USING MESSAGE='rollback fixtures'; EXCEPTION WHEN SQLSTATE 'PT010' THEN NULL; END;
RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(res) r WHERE r->>'pass' IS DISTINCT FROM 'true'),'checks',res); END $$;

CREATE OR REPLACE FUNCTION public.thread_phase10_risk_test() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE own uuid; f uuid; ok boolean:=false; result jsonb:='[]'; BEGIN SELECT user_id INTO own FROM public.user_roles WHERE role='steward' ORDER BY user_id LIMIT 1; PERFORM public._phase10_register();
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
RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result) r WHERE r->>'pass' IS DISTINCT FROM 'true'),'checks',result); END $$;

CREATE OR REPLACE FUNCTION public.thread_record_phase10_evidence(p_actor jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ev jsonb; graph_ev jsonb; risk_ev jsonb; seq bigint; BEGIN PERFORM public._assert_actor(p_actor); IF p_actor->>'kind'<>'human' OR NOT public.has_role((p_actor->>'id')::uuid,'steward') THEN RAISE EXCEPTION 'STEWARD_REQUIRED'; END IF;
ev:=public.thread_phase10_selftest(); graph_ev:=public.thread_phase10_graph_test(); risk_ev:=public.thread_phase10_risk_test();
ev:=jsonb_build_object('passed',(ev->>'passed')::boolean AND (graph_ev->>'passed')::boolean AND (risk_ev->>'passed')::boolean,'checks',ev->'checks'||(graph_ev->'checks')||(risk_ev->'checks'),'fixture_mode','rollback-only explicit observations plus native graph temporal chain; not live production evidence');
seq:=public._mcp_ledger(p_actor,'phase10.exit_evidence',NULL,ev); RETURN ev||jsonb_build_object('ledger_seq',seq); END $$;

REVOKE ALL ON FUNCTION public.thread_phase10_selftest(),public.thread_phase10_graph_test(),public.thread_phase10_risk_test(),public.thread_record_phase10_evidence(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_phase10_selftest(),public.thread_phase10_graph_test(),public.thread_phase10_risk_test(),public.thread_record_phase10_evidence(jsonb) TO service_role;
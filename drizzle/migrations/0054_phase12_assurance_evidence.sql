-- Assurance stays in registered operating/evidence objects; no separate approval workflow.
CREATE OR REPLACE FUNCTION public.thread_record_assurance(p_actor jsonb,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE subject public.objects; e public.objects; check_object public.objects; actor uuid; refs uuid[]; kind text; result text; classification public.data_classification; body jsonb;
BEGIN
 PERFORM public._assert_actor(p_actor); actor:=(p_actor->>'id')::uuid;
 IF p_actor->>'kind'<>'human' OR NOT(public.has_role(actor,'steward') OR public.has_role(actor,'compliance')) THEN RAISE EXCEPTION 'ASSURANCE_AUTHORITY_REQUIRED'; END IF;
 kind:=p->>'kind'; result:=p->>'result';
 IF kind NOT IN ('penetration','accessibility','recovery','load','independent_verification','compliance_walkthrough') OR kind IS NULL
 OR result NOT IN ('passed','failed','pending_live_adapter') OR result IS NULL OR coalesce(btrim(p->>'rationale'),'')='' THEN RAISE EXCEPTION 'INVALID_ASSURANCE'; END IF;
 SELECT * INTO subject FROM public.objects WHERE id=(p->>'subject_id')::uuid AND NOT is_tombstone;
 IF subject.id IS NULL OR NOT public._can_read_as(actor,subject.permission,subject.data_classification) THEN RAISE EXCEPTION 'SUBJECT_NOT_PERMITTED'; END IF;
 refs:=ARRAY(SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(p->'evidence_refs'));
 IF cardinality(refs)<1 OR cardinality(refs)>20 THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED'; END IF;
 classification:=subject.data_classification;
 FOREACH actor IN ARRAY refs LOOP
  SELECT * INTO e FROM public.objects WHERE id=actor AND NOT is_tombstone;
  IF e.id IS NULL OR NOT public._can_read_as((p_actor->>'id')::uuid,e.permission,e.data_classification) THEN RAISE EXCEPTION 'EVIDENCE_NOT_PERMITTED'; END IF;
  IF e.permission<>subject.permission THEN RAISE EXCEPTION 'PERMISSION_INTERSECTION_REQUIRED: evidence and subject must have identical access predicates'; END IF;
  IF e.data_classification>classification THEN classification:=e.data_classification; END IF;
  IF result='passed' AND (coalesce(e.body->'provenance'->>'simulated','false')='true' OR coalesce(e.body->>'adapter_mode','')<>'live'
   OR e.review_date<current_date OR e.lifecycle_state='draft' OR e.body->>'results'='not_executed') THEN RAISE EXCEPTION 'LIVE_CURRENT_EVIDENCE_REQUIRED'; END IF;
 END LOOP;
 IF result='passed' THEN
  IF kind='accessibility' AND NOT EXISTS(SELECT 1 FROM public.objects WHERE id=ANY(refs) AND type='AccessibilityEvaluation' AND body->>'standard'='WCAG 2.2 AA' AND body->>'result'='passed') THEN RAISE EXCEPTION 'WCAG_AUDIT_REQUIRED'; END IF;
  IF kind='penetration' AND NOT EXISTS(SELECT 1 FROM public.objects WHERE id=ANY(refs) AND type='SecurityScan' AND body->>'kind'='dast' AND body->>'independent_assessor' IS NOT NULL AND body->>'unaddressed_findings'='0') THEN RAISE EXCEPTION 'INDEPENDENT_PENETRATION_EVIDENCE_REQUIRED'; END IF;
  IF kind='recovery' AND NOT EXISTS(SELECT 1 FROM public.objects WHERE id=ANY(refs) AND body->>'restore_executed'='true' AND (body->>'rpo_minutes')::numeric BETWEEN 0 AND 15 AND (body->>'rto_minutes')::numeric BETWEEN 0 AND 240 AND body->>'post_restore_ledger_verified'='true') THEN RAISE EXCEPTION 'TIMED_RESTORE_EVIDENCE_REQUIRED'; END IF;
  IF kind='load' AND NOT EXISTS(SELECT 1 FROM public.objects WHERE id=ANY(refs) AND (body->>'scale_multiplier')::numeric>=10 AND body->>'budgets_met'='true') THEN RAISE EXCEPTION 'TENFOLD_LOAD_EVIDENCE_REQUIRED'; END IF;
  IF kind='independent_verification' AND NOT EXISTS(SELECT 1 FROM public.objects WHERE id=ANY(refs) AND type='TestSuite' AND body->>'provenance'='independently_authored' AND body->>'code_route'<>body->>'test_route' AND body->>'implementation_visible'='false' AND body->>'human_reviewed'='true') THEN RAISE EXCEPTION 'BLIND_INDEPENDENT_VERIFICATION_REQUIRED'; END IF;
 END IF;
 body:=jsonb_build_object('control_ref','phase12.'||kind,'subject_ref',subject.id,'result',result,'evidence',to_jsonb(refs),'evaluator',p_actor,
  'rationale',p->>'rationale','adapter_mode','none','assurance_kind',kind,'verification_basis','Recorded evidence; not an attestation that evidence is true');
 check_object:=public.thread_create_object(p_actor,jsonb_build_object('type','ControlCheck','title',kind||' assurance for '||subject.human_ref,
  'statement',p->>'rationale','machine_description','Evidence-linked assurance condition (Parts 14.6, 21)',
  'body',body,'review_date',subject.review_date,'expiration_condition',subject.expiration_condition,'retirement_path',jsonb_build_object('mode','archive_evidence'),
  'risk_tier','1','owner_id',subject.owner_id,'permission',subject.permission,'data_classification',classification,
  'evidence_refs',to_jsonb(refs),'derived_from',jsonb_build_array(subject.id),'rationale',p->>'rationale'));
 PERFORM public.thread_create_edge(p_actor,jsonb_build_object('from_id',subject.id,'to_id',check_object.id,'verb','control_checked_by','source','stated','rationale','Cited assurance evidence'));
 RETURN jsonb_build_object('id',check_object.id,'human_ref',check_object.human_ref,'result',result);
END $$;
REVOKE ALL ON FUNCTION public.thread_record_assurance(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_record_assurance(jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.thread_hardening_checks(p_actor jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid; exposed integer; missing_rls integer; missing_expiration bigint; ledger_result jsonb; replay jsonb; payload jsonb; receipt bigint;
BEGIN
 PERFORM public._assert_actor(p_actor); actor:=(p_actor->>'id')::uuid;
 IF p_actor->>'kind'<>'human' OR NOT(public.has_role(actor,'steward') OR public.has_role(actor,'compliance')) THEN RAISE EXCEPTION 'ASSURANCE_AUTHORITY_REQUIRED'; END IF;
 SELECT count(*) INTO exposed FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.prosecdef AND p.proname LIKE 'thread_%' AND p.proname NOT IN ('thread_verify_ledger','thread_restore_rehearsal') AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute'));
 SELECT count(*) INTO missing_rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e');
 SELECT count(*) INTO missing_expiration FROM public.objects WHERE NOT is_tombstone AND (review_date IS NULL OR expiration_condition IS NULL OR retirement_path IS NULL);
 ledger_result:=public.thread_verify_ledger(); replay:=public.thread_restore_rehearsal();
 payload:=jsonb_build_object('checked_at',clock_timestamp(),'exposed_privileged_writes',exposed,'tables_without_rls',missing_rls,
  'live_objects_without_expiration',missing_expiration,'ledger',ledger_result,'snapshot_replay',replay,
  'passed_internal_checks',exposed=0 AND missing_rls=0 AND missing_expiration=0 AND (ledger_result->>'ok')::boolean AND (replay->>'ok')::boolean,
  'live_restore','pending_live_adapter','penetration','pending_live_adapter','wcag_audit','pending_live_adapter','tenfold_load','pending_live_adapter','aw5_threshold',NULL);
 receipt:=public._rendition_ledger(p_actor,'phase12.internal_checks','simulated',payload);
 RETURN payload||jsonb_build_object('ledger_seq',receipt);
END $$;
REVOKE ALL ON FUNCTION public.thread_hardening_checks(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_hardening_checks(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.phase12_assurance_checks() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'human_ref',human_ref,'title',title,'body',body,'review_date',review_date,'owner_id',owner_id) ORDER BY created_at DESC),'[]'::jsonb)
 FROM (SELECT * FROM public.objects WHERE type='ControlCheck' AND body ? 'assurance_kind' AND NOT is_tombstone ORDER BY created_at DESC LIMIT 200) c
$$;
REVOKE ALL ON FUNCTION public.phase12_assurance_checks() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase12_assurance_checks() TO authenticated,service_role;

DO $acceptance$
BEGIN
 IF has_function_privilege('authenticated','public.thread_record_assurance(jsonb,jsonb)','execute') THEN RAISE EXCEPTION 'Assurance write exposed'; END IF;
 IF has_function_privilege('anon','public.phase12_assurance_checks()','execute') THEN RAISE EXCEPTION 'Assurance read exposed'; END IF;
END $acceptance$;
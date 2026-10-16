-- Null subject metadata never establishes independent judgment.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public._assert_independent_judgment(uuid,uuid,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'OR NOT (judgment.body->>''subject_ref''=cap.id::text OR judgment.body->>''capability_ref''=cap.id::text OR cap.id=ANY(judgment.evidence_refs))',
 'OR NOT coalesce((judgment.body->>''subject_ref''=cap.id::text OR judgment.body->>''capability_ref''=cap.id::text OR cap.id=ANY(judgment.evidence_refs)),false)');
 EXECUTE definition;
END $patch$;

CREATE OR REPLACE FUNCTION public.thread_phase12_selftest() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; replay jsonb; integrity jsonb; ctx jsonb; checks jsonb:='[]';
BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.prosecdef AND p.proname LIKE 'thread_%' AND p.proname NOT IN ('thread_verify_ledger','thread_restore_rehearsal') AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute'));
 checks:=checks||jsonb_build_array(jsonb_build_object('name','privileged writes service-role only','pass',n=0,'count',n));
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e');
 checks:=checks||jsonb_build_array(jsonb_build_object('name','application tables enforce RLS','pass',n=0,'count',n));
 SELECT count(*) INTO n FROM public.objects WHERE NOT is_tombstone AND (review_date IS NULL OR expiration_condition IS NULL OR retirement_path IS NULL);
 checks:=checks||jsonb_build_array(jsonb_build_object('name','expiration everywhere','pass',n=0,'count',n));
 integrity:=public.thread_verify_ledger(); replay:=public.thread_restore_rehearsal();
 checks:=checks||jsonb_build_array(jsonb_build_object('name','current ledger hash chain','pass',(integrity->>'ok')::boolean),jsonb_build_object('name','snapshot version integrity (simulated)','pass',(replay->>'ok')::boolean));
 ctx:=public.human_surface_context(NULL);
 checks:=checks||jsonb_build_array(jsonb_build_object('name','context node ceiling','pass',jsonb_array_length(ctx->'objects')<=200),jsonb_build_object('name','context edge ceiling','pass',jsonb_array_length(ctx->'edges')<=1000));
 checks:=checks||jsonb_build_array(jsonb_build_object('name','authenticated RLS predicates remain callable','pass',has_function_privilege('authenticated','public.can_read_object(jsonb,public.data_classification)','execute')));
 checks:=checks||jsonb_build_array(jsonb_build_object('name','Tier4 grant validates actual judgment','pass',position('_assert_independent_judgment' in pg_get_functiondef('public.thread_set_authority(jsonb,uuid,public.authority_level,text,text,uuid[],jsonb)'::regprocedure))>0));
 checks:=checks||jsonb_build_array(jsonb_build_object('name','every Tier4 exposure validates actual judgment','pass',position('_assert_independent_judgment' in pg_get_functiondef('public.thread_authorize_exposure(jsonb,uuid,jsonb)'::regprocedure))>0));
 RETURN jsonb_build_object('passed',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE c->>'pass' IS DISTINCT FROM 'true'),'checks',checks,'ledger',integrity,'snapshot_replay',replay,'mode','simulated','live_exit','pending_live_adapter');
END $$;
REVOKE ALL ON FUNCTION public.thread_phase12_selftest() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_phase12_selftest() TO service_role;
DO $acceptance$
DECLARE report jsonb;
BEGIN
 report:=public.thread_phase12_selftest();
 IF report->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PHASE12_INTERNAL_SELFTEST_FAILED: %',report; END IF;
 RAISE NOTICE 'PHASE12_INTERNAL_ACCEPTANCE: %',report;
END $acceptance$;
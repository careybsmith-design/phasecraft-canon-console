CREATE OR REPLACE FUNCTION public.phase10_action_ratios() RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$ WITH s AS(SELECT count(*) n,count(*) FILTER(WHERE mutating_actions>0) a,count(*) FILTER(WHERE mutating_actions=0 AND reads>0) r FROM public.usage_sessions),cfg AS(SELECT value,status FROM public.canon_settings WHERE key='anti_wiki.action_ratio') SELECT jsonb_build_object('action_pct',100.0*a/nullif(n,0),'read_only_pct',100.0*r/nullif(n,0),'status',CASE WHEN NOT EXISTS(SELECT 1 FROM cfg WHERE status='set' AND value IS NOT NULL) THEN 'THRESHOLD_UNSET' WHEN n=0 THEN 'NO_EVIDENCE' ELSE 'measured' END,'thresholds',(SELECT value FROM cfg),'evidence',jsonb_build_object('source','usage_sessions','sessions',n)) FROM s $$;
REVOKE ALL ON FUNCTION public.phase10_action_ratios() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase10_action_ratios() TO authenticated,service_role;
DO $$ DECLARE definition text; result jsonb; setting_status text; setting_value jsonb; BEGIN
 SELECT pg_get_functiondef('public.phase10_action_ratios()'::regprocedure) INTO definition;
 IF position('status=''set''' IN definition)=0 OR position('status=''decided''' IN definition)>0 THEN RAISE EXCEPTION 'ACTION_RATIO_STATUS_MISMATCH'; END IF;
 SELECT status,value INTO setting_status,setting_value FROM public.canon_settings WHERE key='anti_wiki.action_ratio';
 result:=public.phase10_action_ratios();
 IF (setting_status='open' OR setting_value IS NULL) AND result->>'status' IS DISTINCT FROM 'THRESHOLD_UNSET' THEN RAISE EXCEPTION 'AW5_OPEN_SETTING_MUST_FAIL_UNSET'; END IF;
 result:=public.thread_audit_security_selftest();
 IF result->>'passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'AUDIT_SECURITY_REGRESSION_FAILED: %',result; END IF;
 result:=public.thread_verify_ledger();
 IF result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'LEDGER_INTEGRITY_FAILED: %',result; END IF;
END $$;
DO $patch$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.session_mission_scope(uuid)'::regprocedure) INTO d;
 d:=replace(d,'public.objects','visible_objects');
 d:=replace(d,'WITH RECURSIVE walk','WITH RECURSIVE visible_objects AS (SELECT * FROM public.objects WHERE auth.uid() IS NULL OR public.can_read_object(permission,data_classification)), walk');
 EXECUTE d;
 SELECT pg_get_functiondef('public.thread_link_session_to_mission(jsonb,uuid,uuid,text,boolean,text)'::regprocedure) INTO d;
 d:=replace(d,'public._fx_payload(''ConfirmedDecision'',decision_body->>''decision'',decision_body)', 'jsonb_build_object(''type'',''ConfirmedDecision'',''title'',decision_body->>''decision'',''statement'',p_rationale,''machine_description'',''Recorded mission containment decision'',''body'',decision_body,''review_date'',greatest(m.review_date,current_date)::text,''expiration_condition'',m.expiration_condition,''retirement_path'',m.retirement_path,''risk_tier'',m.risk_tier::text)');
 EXECUTE d;
END $patch$;
-- Same fail-closed rollback suite after permission-path hardening.
DO $$ DECLARE r jsonb; BEGIN r:=public.thread_session_mission_selftest(); IF r->>'all_ok' IS DISTINCT FROM 'true' OR r->>'fixtures_rolled_back' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'SESSION_MISSION_ACCEPTANCE_FAILED: %',r; END IF; END $$;
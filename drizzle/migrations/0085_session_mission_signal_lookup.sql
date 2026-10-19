CREATE OR REPLACE FUNCTION public.need_promoted_signals(p_need uuid) RETURNS TABLE(id uuid,human_ref text,title text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT sig.id,sig.human_ref,sig.title FROM public.objects n JOIN public.objects sig ON sig.type='ValueSignal' AND sig.lifecycle_state='promoted' AND NOT sig.is_tombstone AND (lower(regexp_replace(coalesce(sig.body->>'observed_condition',sig.statement),'[^a-zA-Z0-9]+',' ','g'))=lower(regexp_replace(coalesce(n.body->>'observed_condition',n.statement),'[^a-zA-Z0-9]+',' ','g')) OR sig.search@@websearch_to_tsquery('english',left(coalesce(n.body->>'observed_condition',n.statement),600))) WHERE n.id=p_need AND n.type='NeedStatement' AND NOT n.is_tombstone ORDER BY sig.created_at LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.need_promoted_signals(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.need_promoted_signals(uuid) TO authenticated,service_role;
DO $patch$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.thread_session_mission_selftest()'::regprocedure) INTO d;
 d:=replace(d,'jsonb_build_object(''kind'',''agent'',''id'',other','jsonb_build_object(''kind'',''human'',''id'',other');
 EXECUTE d;
END $patch$;
DO $$ DECLARE r jsonb; BEGIN r:=public.thread_session_mission_selftest(); IF r->>'all_ok' IS DISTINCT FROM 'true' OR r->>'fixtures_rolled_back' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'SESSION_MISSION_ACCEPTANCE_FAILED: %',r; END IF; END $$;
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text)'::regprocedure) INTO definition;
 IF position('where token_hash = p_token_hash;' in definition)=0 OR position('where id = p_confirmation;' in definition)=0 THEN RAISE EXCEPTION 'AGENT_RESERVATION_PATCH_CONTEXT_CHANGED'; END IF;
 definition:=replace(definition,'where token_hash = p_token_hash;','where token_hash = p_token_hash FOR UPDATE;');
 definition:=replace(definition,'where id = p_confirmation;','where id = p_confirmation FOR UPDATE;');
 definition:=replace(definition,'c.expires_at < now()','c.expires_at <= now()');
 definition:=replace(definition,'  select count(*) filter (where started_at', E'  IF p_cost IS NULL OR p_cost < 0 THEN RAISE EXCEPTION ''INVALID_CALL_COST''; END IF;\n  select count(*) filter (where started_at');
 EXECUTE definition;
END $patch$;
REVOKE ALL ON FUNCTION public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text) TO service_role;
COMMENT ON FUNCTION public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text) IS 'Serializes quota/cost reservation on the agent row and locks confirmation before checking/consuming it; caller cannot race single-use tokens. Peak concurrent execution proof remains separate acceptance.';
DO $verify$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text)'::regprocedure) INTO d;
 IF position('where token_hash = p_token_hash FOR UPDATE;' in d)=0 OR position('where id = p_confirmation FOR UPDATE;' in d)=0 OR position('c.expires_at <= now()' in d)=0 OR position('INVALID_CALL_COST' in d)=0 THEN RAISE EXCEPTION 'AGENT_RESERVATION_GUARD_MISSING'; END IF;
 IF has_function_privilege('authenticated','public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text)','EXECUTE') OR has_function_privilege('anon','public.thread_agent_begin_call(text,text,text,public.authority_level,numeric,boolean,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'AGENT_RESERVATION_PRIVILEGE_LEAK'; END IF;
END $verify$;
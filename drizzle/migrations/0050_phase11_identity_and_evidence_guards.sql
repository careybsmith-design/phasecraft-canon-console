DO $$ DECLARE s text; BEGIN
s:=pg_get_functiondef('public.thread_human_operation(jsonb,text,jsonb)'::regprocedure);
s:=replace(s,'IF (p->>''maximum_investment'')::numeric < 0 OR (p->>''review_date'')::date < current_date','IF p->>''maximum_investment'' IS NULL OR p->>''review_date'' IS NULL OR (p->>''maximum_investment'')::numeric < 0 OR (p->>''review_date'')::date < current_date');
s:=replace(s,'THEN RAISE EXCEPTION ''TWO_DISTINCT_HUMANS_REQUIRED''; END IF;','OR EXISTS(SELECT 1 FROM public.agents WHERE auth_user_id IN(co,bu)) THEN RAISE EXCEPTION ''TWO_DISTINCT_HUMANS_REQUIRED''; END IF;');
s:=replace(s,'THEN RAISE EXCEPTION ''TWO_EMPOWERED_HUMANS_REQUIRED''; END IF;','OR EXISTS(SELECT 1 FROM public.agents WHERE auth_user_id IN(co,bu)) THEN RAISE EXCEPTION ''TWO_EMPOWERED_HUMANS_REQUIRED''; END IF;');
s:=replace(s,'IF p_operation IN(''cell'',''burst'',''finish_burst'') THEN PERFORM public._assert_can_write(p_actor,src); END IF;','IF p_operation IN(''cell'',''burst'',''finish_burst'') THEN PERFORM public._assert_can_write(p_actor,src); END IF; IF p_operation=''cell'' AND (src.review_date<current_date OR src.lifecycle_state IN(''closed'',''redirected'',''retired'')) THEN RAISE EXCEPTION ''MISSION_EXPIRED''; END IF;');
s:=replace(s,'IF NOT ((output.type','IF NOT coalesce(((output.type');
s:=replace(s,'output.body->>''disproved''=''true'')) THEN','output.body->>''disproved''=''true'')),false) THEN');
s:=replace(s,'IF src.body->>''end'' IS NOT NULL THEN','IF src.lifecycle_state<>''draft'' THEN RAISE EXCEPTION ''BURST_IMMUTABLE: active burst changes require the canon change path''; END IF; IF src.body->>''end'' IS NOT NULL THEN');
EXECUTE s;
END $$;
GRANT UPDATE ON public.surface_follows TO authenticated;
COMMENT ON FUNCTION public.thread_human_operation(jsonb,text,jsonb) IS 'Phase11 bounded ledger-first writes. Human account identities exclude registered agents; null proof flags cannot satisfy substantive outputs. Full two-human acceptance is blocked until a second human account exists.';
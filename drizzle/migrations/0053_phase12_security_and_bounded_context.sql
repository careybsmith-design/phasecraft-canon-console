-- Phase 12: close publicly callable privileged writes, preserve authenticated permission predicates.
DO $hardening$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND
      (p.proname LIKE 'thread_%' AND p.proname NOT IN ('thread_verify_ledger','thread_restore_rehearsal')
       OR p.prorettype='trigger'::regtype)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('_is_current_member','has_role','can_read_object','can_read_session')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',f.signature);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proconfig IS NULL AND NOT EXISTS
      (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path=public',f.signature);
  END LOOP;
END $hardening$;

-- Bounded breadth-first expansion: permission predicates apply before nodes join the frontier.
CREATE OR REPLACE FUNCTION public.human_surface_context(p_root uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE seen uuid[]:='{}'; frontier uuid[]:='{}'; next_nodes uuid[]; depth integer; more boolean:=false; result jsonb; room integer;
BEGIN
 IF p_root IS NULL THEN
  SELECT coalesce(array_agg(id),'{}') INTO seen FROM (SELECT id FROM public.objects WHERE NOT is_tombstone ORDER BY updated_at DESC,id LIMIT 201) s;
  more:=cardinality(seen)>200; seen:=seen[1:200];
 ELSE
  SELECT coalesce(array_agg(id),'{}') INTO seen FROM public.objects WHERE id=p_root AND NOT is_tombstone;
  frontier:=seen;
  FOR depth IN 1..3 LOOP
   EXIT WHEN cardinality(frontier)=0 OR cardinality(seen)>=200;
   room:=200-cardinality(seen);
   SELECT coalesce(array_agg(id),'{}') INTO next_nodes FROM (
    SELECT DISTINCT o.id FROM public.objects o JOIN (
      SELECT e.to_id AS id FROM public.edges e WHERE e.from_id=ANY(frontier) AND e.retired_at IS NULL
      UNION SELECT e.from_id AS id FROM public.edges e WHERE e.to_id=ANY(frontier) AND e.retired_at IS NULL
    ) candidates ON candidates.id=o.id WHERE NOT o.is_tombstone AND NOT(o.id=ANY(seen)) ORDER BY o.id LIMIT room+1
   ) s;
   IF cardinality(next_nodes)>room THEN more:=true; next_nodes:=next_nodes[1:room]; END IF;
   seen:=seen||next_nodes; frontier:=next_nodes;
  END LOOP;
  IF cardinality(seen)>=200 THEN more:=true; END IF;
 END IF;
 SELECT jsonb_build_object('objects',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',id,'human_ref',human_ref,'type',type,'title',title,'statement',statement,'body',body,'version',version,
  'lifecycle_state',lifecycle_state,'risk_tier',risk_tier,'authority_level',authority_level,'confidence_bundle',confidence_bundle,
  'review_date',review_date,'expiration_condition',expiration_condition,'data_classification',data_classification,'content_hash',content_hash,
  'owner_id',owner_id,'co_creator_id',co_creator_id,'builder_id',builder_id,'updated_at',updated_at) ORDER BY updated_at DESC,id)
  FROM public.objects WHERE id=ANY(seen)),'[]'::jsonb),
  'edges',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM public.edges WHERE retired_at IS NULL AND from_id=ANY(seen) AND to_id=ANY(seen) ORDER BY id LIMIT 1000) e),'[]'::jsonb),
  'truncated',more OR (SELECT count(*)>1000 FROM public.edges WHERE retired_at IS NULL AND from_id=ANY(seen) AND to_id=ANY(seen)),
  'node_budget',200,'edge_budget',1000) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.human_surface_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.human_surface_context(uuid) TO authenticated,service_role;
CREATE INDEX IF NOT EXISTS phase12_edges_active_from ON public.edges(from_id,to_id) WHERE retired_at IS NULL;
CREATE INDEX IF NOT EXISTS phase12_edges_active_to ON public.edges(to_id,from_id) WHERE retired_at IS NULL;

-- Independent judgment is a real, current decision about this capability, never a nonempty arbitrary string.
CREATE OR REPLACE FUNCTION public._assert_independent_judgment(p_capability uuid,p_judgment uuid,p_actor jsonb) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cap public.objects; judgment public.objects; who uuid;
BEGIN
 SELECT * INTO cap FROM public.objects WHERE id=p_capability AND NOT is_tombstone;
 SELECT * INTO judgment FROM public.objects WHERE id=p_judgment AND NOT is_tombstone;
 IF cap.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: capability'; END IF;
 IF judgment.id IS NULL OR judgment.type<>'ConfirmedDecision' OR judgment.lifecycle_state<>'recorded'
  OR judgment.review_date<current_date OR (judgment.expires_at IS NOT NULL AND judgment.expires_at<=now())
  OR judgment.created_by->>'kind'<>'human'
  OR coalesce(judgment.body->'provenance'->>'simulated','false')='true'
  OR judgment.body->>'adapter_mode'='simulated'
  OR NOT (judgment.body->>'subject_ref'=cap.id::text OR judgment.body->>'capability_ref'=cap.id::text OR cap.id=ANY(judgment.evidence_refs)) THEN
  RAISE EXCEPTION 'INDEPENDENT_JUDGMENT_REQUIRED: current human decision must identify the capability';
 END IF;
 who:=(judgment.created_by->>'id')::uuid;
 IF NOT public._is_current_member(who) OR EXISTS(SELECT 1 FROM public.agents WHERE auth_user_id=who)
  OR cap.builder_id IS NULL OR who=cap.builder_id
  OR (cap.created_by->>'kind'='human' AND who=(cap.created_by->>'id')::uuid)
  OR p_actor->>'kind'<>'human' OR who<>(p_actor->>'id')::uuid THEN
  RAISE EXCEPTION 'INDEPENDENT_HUMAN_REQUIRED: authorising human must be distinct from the named Builder and creator';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public._assert_independent_judgment(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._assert_independent_judgment(uuid,uuid,jsonb) TO service_role;

DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.thread_set_authority(jsonb,uuid,public.authority_level,text,text,uuid[],jsonb)'::regprocedure) INTO definition;
 IF position('if p_to < o.authority_level then' in definition)=0 THEN RAISE EXCEPTION 'Authority patch target missing'; END IF;
 definition:=replace(definition,'if p_to < o.authority_level then',
  'if o.risk_tier = ''4'' then perform public._assert_independent_judgment(o.id, nullif(p_conditions->>''independent_human_judgment_ref'','''')::uuid, p_actor); end if; if p_to < o.authority_level then');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.thread_authorize_exposure(jsonb,uuid,jsonb)'::regprocedure) INTO definition;
 IF position('select * into ev from public.objects' in definition)=0 THEN RAISE EXCEPTION 'Exposure patch target missing'; END IF;
 definition:=replace(definition,'select * into ev from public.objects',
  'if cap.risk_tier = ''4'' then perform public._assert_independent_judgment(cap.id, nullif(p->>''independent_human_judgment_ref'','''')::uuid, p_actor); end if; select * into ev from public.objects');
 EXECUTE definition;
END $patch$;

-- Acceptance assertions inspect actual runtime privileges; a regression aborts the migration.
DO $acceptance$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public'
 AND p.prosecdef AND p.proname LIKE 'thread_%' AND p.proname NOT IN ('thread_verify_ledger','thread_restore_rehearsal')
 AND (has_function_privilege('anon',p.oid,'execute') OR has_function_privilege('authenticated',p.oid,'execute'));
 IF n<>0 THEN RAISE EXCEPTION 'PRIVILEGED_WRITE_EXPOSED: % functions',n; END IF;
 IF NOT has_function_privilege('authenticated','public.can_read_object(jsonb,public.data_classification)','execute') THEN RAISE EXCEPTION 'RLS predicate missing'; END IF;
 IF has_function_privilege('anon','public._assert_independent_judgment(uuid,uuid,jsonb)','execute') THEN RAISE EXCEPTION 'Private judgment helper exposed'; END IF;
END $acceptance$;
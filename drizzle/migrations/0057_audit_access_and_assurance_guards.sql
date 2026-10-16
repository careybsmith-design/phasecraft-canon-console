-- Whole-build audit: narrow object-linked metadata reads without bypassing object permissions.
ALTER POLICY "read versions by permission" ON public.object_versions USING (public.can_read_object(permission,data_classification) AND EXISTS(SELECT 1 FROM public.objects o WHERE o.id=object_versions.id));
ALTER POLICY "read aliases" ON public.legacy_aliases USING (EXISTS(SELECT 1 FROM public.objects o WHERE o.id=legacy_aliases.object_id));
ALTER POLICY "read cost ceilings" ON public.cost_ceilings USING (EXISTS(SELECT 1 FROM public.objects o WHERE o.id=cost_ceilings.scope_id));
ALTER POLICY "read restricted embeddings" ON public.object_embeddings_restricted USING ((public.has_role(auth.uid(),'steward') OR public.has_role(auth.uid(),'compliance')) AND EXISTS(SELECT 1 FROM public.objects o WHERE o.id=object_embeddings_restricted.object_id));
ALTER POLICY "read ref sequences" ON public.ref_sequences USING (public.has_role(auth.uid(),'steward') OR public.has_role(auth.uid(),'compliance'));
ALTER POLICY "read reuse checks" ON public.reuse_checks USING (
 (checked_by->>'id'=auth.uid()::text OR public.has_role(auth.uid(),'steward') OR public.has_role(auth.uid(),'compliance'))
 AND (behavior_statement_id IS NULL OR EXISTS(SELECT 1 FROM public.objects o WHERE o.id=reuse_checks.behavior_statement_id))
 AND jsonb_typeof(results)='array'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(results)='array' THEN results ELSE '[]'::jsonb END) r WHERE NOT EXISTS(SELECT 1 FROM public.objects o WHERE o.id::text=r->>'capability_id')));
ALTER POLICY "read ledger" ON public.ledger USING (
 ((object_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.objects o WHERE o.id=ledger.object_id))
 OR (object_id IS NULL AND (public.has_role(auth.uid(),'steward') OR public.has_role(auth.uid(),'compliance')
 OR (actor->>'kind'='human' AND actor->>'id'=auth.uid()::text)
 OR (actor->>'kind'='agent' AND EXISTS(SELECT 1 FROM public.agents a WHERE a.owner_id=auth.uid() AND (a.id::text=ledger.actor->>'agent_id' OR a.auth_user_id::text=ledger.actor->>'id'))))))
 AND NOT EXISTS(SELECT 1 FROM unnest(evidence_refs) e WHERE NOT EXISTS(SELECT 1 FROM public.objects o WHERE o.id=e)));
ALTER POLICY "read findings of readable sessions" ON public.framing_live_findings USING (public.can_read_session(session_id) AND (statement_id IS NULL OR EXISTS(SELECT 1 FROM public.objects o WHERE o.id=framing_live_findings.statement_id)) AND (related_object_id IS NULL OR EXISTS(SELECT 1 FROM public.objects o WHERE o.id=framing_live_findings.related_object_id)));

CREATE OR REPLACE FUNCTION public._assert_actor(_actor jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF jsonb_typeof(_actor) IS DISTINCT FROM 'object' OR (_actor->>'kind') IS NULL OR (_actor->>'kind') NOT IN ('human','agent','system') OR coalesce(btrim(_actor->>'id'),'')='' OR (_actor->>'authority_used') IS NULL OR (_actor->>'authority_used') NOT IN ('observe','recommend','act_with_confirmation','act_bounded','autonomous_with_exception') THEN RAISE EXCEPTION 'ACTOR_REQUIRED: actor kind, identity and authority are mandatory'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._assert_actor(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._assert_actor(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public._audit_current_evidence(o public.objects) RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT o.id IS NOT NULL AND NOT o.is_tombstone AND o.retired_at IS NULL AND o.review_date>=current_date AND (o.expires_at IS NULL OR o.expires_at>now()) AND o.lifecycle_state NOT IN ('draft','proposed','rejected','superseded','retired','deleted','stale','expired','failed')
$$;
REVOKE ALL ON FUNCTION public._audit_current_evidence(public.objects) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._audit_current_evidence(public.objects) TO service_role;

DO $patch$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.thread_record_assurance(jsonb,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'IF subject.id IS NULL OR NOT public._can_read_as(actor,subject.permission,subject.data_classification)', 'IF subject.id IS NULL OR (result=''passed'' AND public._audit_current_evidence(subject) IS NOT TRUE) OR NOT public._can_read_as(actor,subject.permission,subject.data_classification)');
 d:=replace(d,'IF result=''passed'' AND (coalesce', 'IF result=''passed'' AND (public._audit_current_evidence(e) IS NOT TRUE OR coalesce');
 d:=replace(d,'IF kind=''accessibility'' AND', 'IF kind=''compliance_walkthrough'' THEN RAISE EXCEPTION ''COMPLIANCE_EXECUTION_REQUIRED: no verified walkthrough execution adapter is connected''; END IF; IF kind=''accessibility'' AND');
 EXECUTE d;
 SELECT pg_get_functiondef('public._assert_independent_judgment(uuid,uuid,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'BEGIN','BEGIN PERFORM public._assert_actor(p_actor);');
 d:=replace(d,'judgment.created_by->>''kind''<>''human''','judgment.created_by->>''kind'' IS DISTINCT FROM ''human''');
 d:=replace(d,'p_actor->>''kind''<>''human''','p_actor->>''kind'' IS DISTINCT FROM ''human''');
 d:=replace(d,'who<>(p_actor->>''id'')::uuid','who IS DISTINCT FROM (p_actor->>''id'')::uuid');
 EXECUTE d;
END $patch$;

-- Conservative composition intersection: every component exists, is distinct/readable/current, and has the same predicate.
CREATE OR REPLACE FUNCTION public.thread_compose_capabilities(p_actor jsonb,p_ids uuid[],p_title text,p_scenario text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.objects; part public.objects; i uuid; common_permission jsonb; eff public.authority_level;
BEGIN
 PERFORM public._assert_actor(p_actor);
 IF cardinality(p_ids)<2 OR cardinality(p_ids)>10 OR cardinality(p_ids) IS NULL OR (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>cardinality(p_ids) THEN RAISE EXCEPTION 'COMPOSITION_NEEDS_DISTINCT_PARTS'; END IF;
 FOREACH i IN ARRAY p_ids LOOP
  SELECT * INTO part FROM public.objects WHERE id=i;
  IF part.id IS NULL OR part.type<>'ComposableCapability' OR public._audit_current_evidence(part) IS NOT TRUE OR part.body->>'is_machine_discoverable' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'NOT_PUBLISHED: every component must be a current published capability'; END IF;
  IF p_actor->>'kind'<>'system' AND NOT public._can_read_as((p_actor->>'id')::uuid,part.permission,part.data_classification) THEN RAISE EXCEPTION 'COMPONENT_NOT_PERMITTED'; END IF;
  IF common_permission IS NULL THEN common_permission:=part.permission; ELSIF common_permission<>part.permission THEN RAISE EXCEPTION 'PERMISSION_INTERSECTION_REQUIRED: different component scopes cannot be broadened'; END IF;
 END LOOP;
 w:=public.thread_create_object(p_actor,jsonb_build_object('type','WorkingCapability','title',p_title,'statement',coalesce(p_scenario,p_title),'machine_description','Composition of current published capabilities; least component authority',
 'body',jsonb_build_object('capability_refs',to_jsonb(p_ids),'scenario',p_scenario),'review_date',(SELECT min(review_date)::text FROM public.objects WHERE id=ANY(p_ids)),
 'expiration_condition',jsonb_build_object('kind','review_date_passes'),'retirement_path',jsonb_build_object('mode','tombstone'),'risk_tier',(SELECT max(risk_tier)::text FROM public.objects WHERE id=ANY(p_ids)),
 'permission',common_permission,'data_classification',(SELECT max(data_classification)::text FROM public.objects WHERE id=ANY(p_ids)), 'rationale','compose capabilities (7.5)', 'owner_id',(SELECT owner_id FROM public.objects WHERE id=p_ids[1])));
 FOREACH i IN ARRAY p_ids LOOP PERFORM public.thread_create_edge(p_actor,jsonb_build_object('verb','composes','from_id',w.id,'to_id',i,'source','stated','rationale','part of composition')); END LOOP;
 eff:=public.composition_effective_authority(w.id);
 RETURN jsonb_build_object('composition_id',w.id,'human_ref',w.human_ref,'effective_authority',eff);
END $$;
REVOKE ALL ON FUNCTION public.thread_compose_capabilities(jsonb,uuid[],text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_compose_capabilities(jsonb,uuid[],text,text) TO service_role;

-- Regression assertions exercise rules rather than matching function text.
DO $acceptance$
DECLARE good public.objects; bad public.objects; a jsonb:='{"kind":"system","id":"audit","authority_used":"observe"}'; rejected boolean;
BEGIN
 BEGIN PERFORM public._assert_actor('{"id":"forged","authority_used":"observe"}'); RAISE EXCEPTION 'NULL_ACTOR_ACCEPTED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'ACTOR_REQUIRED%' THEN RAISE; END IF; END;
 SELECT * INTO good FROM public.objects WHERE NOT is_tombstone AND review_date>=current_date LIMIT 1;
 bad:=good; bad.expires_at:=now()-interval '1 second'; IF public._audit_current_evidence(bad) IS NOT FALSE THEN RAISE EXCEPTION 'EXPIRED_EVIDENCE_ACCEPTED'; END IF;
 bad:=good; bad.lifecycle_state:='superseded'; IF public._audit_current_evidence(bad) IS NOT FALSE THEN RAISE EXCEPTION 'SUPERSEDED_EVIDENCE_ACCEPTED'; END IF;
 bad:=good; bad.retired_at:=now(); IF public._audit_current_evidence(bad) IS NOT FALSE THEN RAISE EXCEPTION 'RETIRED_EVIDENCE_ACCEPTED'; END IF;
 BEGIN PERFORM public.thread_compose_capabilities(a,ARRAY[good.id,good.id],'duplicate','test'); RAISE EXCEPTION 'DUPLICATE_COMPONENT_ACCEPTED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'COMPOSITION_NEEDS_DISTINCT_PARTS%' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public._assert_actor(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'PRIVATE_HELPER_EXPOSED'; END IF;
END $acceptance$;
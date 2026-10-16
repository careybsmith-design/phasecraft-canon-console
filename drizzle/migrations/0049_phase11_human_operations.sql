CREATE TABLE public.surface_follows (user_id uuid NOT NULL, kind text NOT NULL CHECK (kind IN ('domain','mission','capability','outcome','learning')), value text NOT NULL CHECK(length(value) BETWEEN 1 AND 200), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,kind,value));
GRANT SELECT,INSERT,DELETE ON public.surface_follows TO authenticated;
GRANT ALL ON public.surface_follows TO service_role;
ALTER TABLE public.surface_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_surface_follows ON public.surface_follows TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.thread_human_operation(p_actor jsonb,p_operation text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; src public.objects; o public.objects; parent public.objects; output public.objects; payload jsonb; body jsonb; co uuid; bu uuid; x uuid; verb text; cls public.data_classification; perm jsonb; minutes int;
BEGIN
 PERFORM public._assert_actor(p_actor); uid:=(p_actor->>'id')::uuid;
 IF NOT public._is_current_member(uid) THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
 IF p_operation='mission' THEN
  SELECT * INTO src FROM public.objects WHERE id=(p->>'signal_id')::uuid AND type='ValueSignal' AND NOT is_tombstone;
 ELSIF p_operation='cell' THEN
  SELECT * INTO src FROM public.objects WHERE id=(p->>'mission_id')::uuid AND type='ValueMission' AND NOT is_tombstone FOR UPDATE;
 ELSIF p_operation='burst' THEN
  SELECT * INTO src FROM public.objects WHERE id=(p->>'cell_id')::uuid AND type='ValueCell' AND NOT is_tombstone FOR UPDATE;
 ELSIF p_operation='finish_burst' THEN
  SELECT * INTO src FROM public.objects WHERE id=(p->>'burst_id')::uuid AND type='ValueBurst' AND NOT is_tombstone FOR UPDATE;
 ELSIF p_operation IN('simulation','adversarial') THEN
  SELECT * INTO src FROM public.objects WHERE id=(p->>'capability_id')::uuid AND type IN('ComposableCapability','WorkingCapability') AND NOT is_tombstone;
 ELSE RAISE EXCEPTION 'UNKNOWN_OPERATION'; END IF;
 IF src.id IS NULL OR NOT public._can_read_as(uid,src.permission,src.data_classification) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 cls:=src.data_classification; perm:=src.permission;
 IF p_operation IN('cell','burst','finish_burst') THEN PERFORM public._assert_can_write(p_actor,src); END IF;
 IF p_operation='mission' THEN
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['title','measurable_condition','baseline','target','affected_population','operating_boundaries','proof_required','decision_authority','stop_conditions','value_hypothesis']) k WHERE length(btrim(coalesce(p->>k,'')))=0) THEN RAISE EXCEPTION 'MISSION_BOUNDS_REQUIRED'; END IF;
  co:=(p->>'co_creator')::uuid; bu:=(p->>'builder')::uuid;
  IF co IS NULL OR bu IS NULL OR co=bu OR NOT public._is_current_member(co) OR NOT public._is_current_member(bu) THEN RAISE EXCEPTION 'TWO_DISTINCT_HUMANS_REQUIRED'; END IF;
  IF (p->>'maximum_investment')::numeric < 0 OR (p->>'review_date')::date < current_date THEN RAISE EXCEPTION 'INVALID_MISSION_BOUND'; END IF;
  IF NOT public._can_read_as(co,perm,cls) OR NOT public._can_read_as(bu,perm,cls) THEN RAISE EXCEPTION 'PARTICIPANT_NOT_PERMITTED'; END IF;
  body:=(p-'signal_id'-'title'-'risk_tier'-'review_date')||jsonb_build_object('signal_ref',src.id,'maximum_time',p->>'review_date','decision_date',p->>'review_date','completion_criteria',p->>'proof_required','current_condition',p->>'baseline','available_data_tools_capabilities','[]'::jsonb);
  payload:=jsonb_build_object('type','ValueMission','title',p->>'title','statement',format('Change %s from %s to %s for %s within %s, proven by %s.',p->>'measurable_condition',p->>'baseline',p->>'target',p->>'affected_population',p->>'operating_boundaries',p->>'proof_required'),'body',body,'co_creator_id',co,'builder_id',bu,'review_date',p->>'review_date','risk_tier',coalesce(p->>'risk_tier','1'));
  verb:='promoted_from';
 ELSIF p_operation='cell' THEN
  co:=coalesce(src.co_creator_id,(src.body->>'co_creator')::uuid); bu:=coalesce(src.builder_id,(src.body->>'builder')::uuid);
  IF co IS NULL OR bu IS NULL OR co=bu OR NOT public._is_current_member(co) OR NOT public._is_current_member(bu) OR coalesce(src.body->>'decision_authority','')='' THEN RAISE EXCEPTION 'TWO_EMPOWERED_HUMANS_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM public.objects c WHERE c.type='ValueCell' AND NOT c.is_tombstone AND c.body->>'mission_ref'=src.id::text AND c.lifecycle_state NOT IN('retired','superseded')) THEN RAISE EXCEPTION 'CELL_ALREADY_EXISTS'; END IF;
  FOR x IN SELECT v::uuid FROM jsonb_array_elements_text(coalesce(p->'agents','[]')) v LOOP
   IF NOT EXISTS(SELECT 1 FROM public.agents a WHERE a.id=x AND a.owner_id=uid) THEN RAISE EXCEPTION 'AGENT_NOT_PERMITTED'; END IF;
  END LOOP;
  payload:=jsonb_build_object('type','ValueCell','title','Cell: '||src.title,'statement','Two people operating a bounded mission with governed agents.','body',jsonb_build_object('mission_ref',src.id,'co_creator',co,'builder',bu,'agents',coalesce(p->'agents','[]'),'authority_boundaries',src.body->'decision_authority','formed_at',now(),'dissolution_condition',src.body->>'stop_conditions','contribution_log','[]'::jsonb),'co_creator_id',co,'builder_id',bu);
  verb:='derives_from';
 ELSIF p_operation='burst' THEN
  IF src.review_date<current_date OR src.lifecycle_state IN('retired','superseded') THEN RAISE EXCEPTION 'CELL_EXPIRED'; END IF;
  minutes:=coalesce((p->>'minutes')::int,180); IF minutes<60 OR minutes>180 THEN RAISE EXCEPTION 'BURST_BOUND_60_180'; END IF;
  IF jsonb_array_length(coalesce(p->'phases','[]')) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'BURST_PHASES_REQUIRED'; END IF;
  payload:=jsonb_build_object('type','ValueBurst','title','Burst: '||src.title,'statement','Time-boxed learning inside the mission authority boundary.','body',jsonb_build_object('cell_ref',src.id,'start',now(),'planned_end',now()+make_interval(mins=>minutes),'phases',p->'phases','minutes',minutes,'mode','operating','output_refs','[]'::jsonb));
  verb:='derives_from';
 ELSIF p_operation='finish_burst' THEN
  IF p_actor->>'kind'<>'human' THEN RAISE EXCEPTION 'HUMAN_DECISION_REQUIRED'; END IF;
  IF src.body->>'end' IS NOT NULL THEN RAISE EXCEPTION 'BURST_ALREADY_FINISHED'; END IF;
  IF length(btrim(coalesce(p->>'rationale','')))=0 OR jsonb_array_length(coalesce(p->'output_ids','[]'))=0 THEN RAISE EXCEPTION 'SUBSTANTIVE_OUTPUT_REQUIRED'; END IF;
  FOR x IN SELECT v::uuid FROM jsonb_array_elements_text(p->'output_ids') v LOOP
   SELECT * INTO output FROM public.objects WHERE id=x AND NOT is_tombstone;
   IF output.id IS NULL OR NOT public._can_read_as(uid,output.permission,output.data_classification) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
   IF NOT ((output.type='WorkingCapability' AND output.lifecycle_state NOT IN('proposed','draft','retired')) OR (output.type='ProductionOutcome' AND output.body->>'adapter_mode'='live' AND coalesce(output.body->'provenance'->>'simulated','false')<>'true') OR (output.type='ConfirmedDecision' AND coalesce(output.body->>'decision','')<>'') OR (output.type='Assumption' AND output.body->>'disproved'='true')) THEN RAISE EXCEPTION 'SUBSTANTIVE_OUTPUT_REQUIRED'; END IF;
   PERFORM public.thread_create_edge(p_actor,jsonb_build_object('from_id',src.id,'to_id',x,'verb','produced','source','stated','rationale',p->>'rationale'));
  END LOOP;
  o:=public.thread_revise_object(p_actor,src.id,src.version,jsonb_build_object('body',src.body||jsonb_build_object('end',now(),'output_refs',p->'output_ids','refinement',p->>'rationale')),p->>'rationale');
  RETURN jsonb_build_object('id',o.id,'human_ref',o.human_ref,'version',o.version);
 ELSE
  IF length(btrim(coalesce(p->>'scenario','')))=0 THEN RAISE EXCEPTION 'SCENARIO_REQUIRED'; END IF;
  payload:=jsonb_build_object('type',CASE WHEN p_operation='adversarial' THEN 'AdversarialRun' ELSE 'SimulationRun' END,'title',CASE WHEN p_operation='adversarial' THEN 'Adversarial probe: ' ELSE 'Simulation: ' END||src.title,'statement',p->>'scenario','body',jsonb_build_object('capability_ref',src.id,'scenario_spec',p->>'scenario','attack_spec',p->>'scenario','synthetic_population','scenario only','conditions_covered',jsonb_build_array(p->>'scenario'),'results','not_executed','findings','[]'::jsonb,'adapter_mode','simulated','provenance',jsonb_build_object('simulated',true),'pending_live_adapter','capability execution harness'));
  verb:=CASE WHEN p_operation='adversarial' THEN 'challenged_by' ELSE 'simulated_by' END;
 END IF;
 payload:=jsonb_build_object('machine_description','Permission-scoped human surface operation','owner_id',uid,'review_date',greatest(src.review_date,current_date)::text,'expiration_condition',src.expiration_condition,'retirement_path',src.retirement_path,'risk_tier',src.risk_tier::text,'permission',perm,'data_classification',cls::text,'rationale','Human surface operation from '||src.human_ref)||payload;
 o:=public.thread_create_object(p_actor,payload);
 IF p_operation IN('simulation','adversarial') THEN
  PERFORM public.thread_create_edge(p_actor,jsonb_build_object('from_id',o.id,'to_id',src.id,'verb','derives_from','source','stated','rationale','Probe derived from capability; no execution or authority is claimed'));
 ELSE
  PERFORM public.thread_create_edge(p_actor,jsonb_build_object('from_id',o.id,'to_id',src.id,'verb',verb,'source','stated','rationale','Bounded operating lineage'));
 END IF;
 PERFORM public.thread_refresh_graph_layout();
 RETURN jsonb_build_object('id',o.id,'human_ref',o.human_ref,'version',o.version,'lifecycle_state',o.lifecycle_state);
END $$;
REVOKE ALL ON FUNCTION public.thread_human_operation(jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_human_operation(jsonb,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.human_surface_context(p_root uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH RECURSIVE walk(id,depth) AS (SELECT id,0 FROM public.objects WHERE id=p_root AND NOT is_tombstone UNION SELECT CASE WHEN e.from_id=w.id THEN e.to_id ELSE e.from_id END,w.depth+1 FROM walk w JOIN public.edges e ON(e.from_id=w.id OR e.to_id=w.id) AND e.retired_at IS NULL WHERE w.depth<3), visible AS (SELECT o.* FROM public.objects o WHERE NOT o.is_tombstone AND (p_root IS NULL OR o.id IN(SELECT id FROM walk)) ORDER BY updated_at DESC LIMIT 200)
SELECT jsonb_build_object('objects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'human_ref',human_ref,'type',type,'title',title,'statement',statement,'body',body,'version',version,'lifecycle_state',lifecycle_state,'risk_tier',risk_tier,'authority_level',authority_level,'confidence_bundle',confidence_bundle,'review_date',review_date,'expiration_condition',expiration_condition,'data_classification',data_classification,'content_hash',content_hash,'owner_id',owner_id,'co_creator_id',co_creator_id,'builder_id',builder_id,'updated_at',updated_at)) FROM visible),'[]'::jsonb),'edges',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.edges e WHERE e.retired_at IS NULL AND e.from_id IN(SELECT id FROM visible) AND e.to_id IN(SELECT id FROM visible)),'[]'::jsonb)) $$;
REVOKE ALL ON FUNCTION public.human_surface_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.human_surface_context(uuid) TO authenticated,service_role;
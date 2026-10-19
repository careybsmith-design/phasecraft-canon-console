-- Optional and reversible mission containment; existing signatures are appended, never replaced.
UPDATE public.relationship_verbs SET from_types = from_types || ARRAY['FramingSession'], to_types = to_types || ARRAY['ValueMission'], signatures = signatures || '[{"from":["FramingSession"],"to":["ValueMission"]}]'::jsonb WHERE verb='scoped_to' AND NOT public._edge_signature_ok('scoped_to','FramingSession','ValueMission');
UPDATE public.relationship_verbs SET to_types = to_types || ARRAY['NeedStatement'], signatures = signatures || '[{"from":["ValueMission"],"to":["NeedStatement"]}]'::jsonb WHERE verb='promoted_from' AND NOT public._edge_signature_ok('promoted_from','ValueMission','NeedStatement');
CREATE OR REPLACE FUNCTION public.chain_edge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s public.objects;
BEGIN
 IF NEW.verb IN ('promoted_from','signals') THEN
  SELECT * INTO s FROM public.objects WHERE id=CASE WHEN NEW.verb='promoted_from' THEN NEW.to_id ELSE NEW.from_id END;
  IF s.type='ValueSignal' AND (coalesce(btrim(s.body->>'observed_condition'),'')='' OR coalesce(s.body->>'baseline_performance',s.body->>'magnitude') IS NULL) THEN
   RAISE EXCEPTION 'SIGNAL_NOT_FRAMED: % cannot become a mission without a framed measurable condition (observed condition and baseline) (Part 5.2)',s.human_ref;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.chain_edge_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.chain_edge_guard() TO service_role;

-- Every hop runs under the calling read role, and only containment/intent lineage is traversed.
CREATE OR REPLACE FUNCTION public.session_mission_scope(p_session uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH RECURSIVE walk(id,path,depth,origin) AS (
 SELECT o.id,ARRAY[o.id],0,'containment'::text FROM public.objects o WHERE o.id=p_session AND o.type='FramingSession' AND NOT o.is_tombstone
 UNION ALL
 SELECT parent.id,w.path||parent.id,w.depth+1,CASE WHEN w.depth=0 AND e.verb='scoped_to' THEN coalesce(child.body->'mission_association'->>'origin','stated') ELSE w.origin END
 FROM walk w JOIN public.objects child ON child.id=w.id
 JOIN public.objects parent ON NOT parent.is_tombstone AND (
  (child.type='FramingSession' AND parent.type='ValueBurst' AND parent.id::text IN(child.body->>'burst_ref',child.body->>'value_burst_ref')) OR
  (child.type='ValueBurst' AND parent.type='ValueCell' AND parent.id::text=child.body->>'cell_ref') OR
  (child.type='ValueCell' AND parent.type='ValueMission' AND parent.id::text=child.body->>'mission_ref') OR
  (child.type='FramingSession' AND parent.type='ValueMission' AND parent.id::text=child.body->>'mission_ref') OR
  EXISTS(SELECT 1 FROM public.edges x WHERE x.retired_at IS NULL AND x.from_id=child.id AND x.to_id=parent.id AND x.verb IN('scoped_to','derives_from') AND ((child.type='FramingSession' AND parent.type IN('ValueBurst','ValueMission')) OR (child.type='ValueBurst' AND parent.type='ValueCell') OR (child.type='ValueCell' AND parent.type='ValueMission'))) OR
  (child.type='FramingSession' AND parent.type='ValueMission' AND EXISTS(SELECT 1 FROM public.edges x JOIN public.objects n ON n.id=x.to_id AND n.type='NeedStatement' AND NOT n.is_tombstone WHERE x.retired_at IS NULL AND x.verb='promoted_from' AND x.from_id=parent.id AND n.body->>'origin_session_ref'=child.id::text)))
 LEFT JOIN public.edges e ON e.from_id=child.id AND e.to_id=parent.id AND e.verb='scoped_to' AND e.retired_at IS NULL
 WHERE w.depth<4 AND NOT parent.id=ANY(w.path)
), candidates AS (SELECT m.*,w.origin,w.depth FROM walk w JOIN public.objects m ON m.id=w.id AND m.type='ValueMission')
SELECT (SELECT jsonb_build_object('id',id,'human_ref',human_ref,'title',title,'origin',CASE WHEN depth=1 THEN coalesce((SELECT s.body->'mission_association'->>'origin' FROM public.objects s WHERE s.id=p_session),origin) ELSE 'containment' END,'depth',depth) FROM candidates ORDER BY CASE WHEN origin='containment' AND depth>1 THEN 0 ELSE 1 END,depth,id LIMIT 1)
$$;
REVOKE ALL ON FUNCTION public.session_mission_scope(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.session_mission_scope(uuid) TO authenticated,service_role;

-- MissionContract is embedded in ValueMission's typed co_creator/decision_authority fields.
-- Delegation is accepted only through a current grant issued by that named human, scoped to this action.
CREATE OR REPLACE FUNCTION public._mission_link_authority(p_user uuid,p_mission public.objects) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE co text; g public.objects;
BEGIN
 co:=coalesce(p_mission.co_creator_id::text,p_mission.body->>'co_creator');
 IF co=p_user::text AND btrim(coalesce(p_mission.body->>'decision_authority',''))<>'' THEN RETURN jsonb_build_object('kind','mission_contract','mission_id',p_mission.id,'holder',p_user,'boundary',p_mission.body->>'decision_authority'); END IF;
 SELECT a.* INTO g FROM public.objects a JOIN public.edges e ON e.to_id=a.id AND e.from_id=p_mission.id AND e.verb='authority_granted_by' AND e.retired_at IS NULL
 WHERE a.type='AuthorityGrant' AND NOT a.is_tombstone AND a.lifecycle_state='recorded' AND a.review_date>=current_date AND (a.expires_at IS NULL OR a.expires_at>now())
 AND a.created_by->>'kind'='human' AND a.created_by->>'id'=co AND a.body->>'granted_by'=co
 AND a.body->>'granted_to'=p_user::text AND a.body->>'subject_ref'=p_mission.id::text AND a.body->>'scope'='link_session_to_mission'
 AND public._can_read_as(p_user,a.permission,a.data_classification) ORDER BY a.created_at DESC LIMIT 1;
 IF g.id IS NOT NULL THEN RETURN jsonb_build_object('kind','authority_grant','grant_id',g.id,'mission_id',p_mission.id,'holder',p_user); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._mission_link_authority(uuid,public.objects) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._mission_link_authority(uuid,public.objects) TO service_role;

-- This narrow edge writer bypasses generic object ownership only after mission authority was checked.
CREATE OR REPLACE FUNCTION public._session_scope_edge(p_actor jsonb,s public.objects,m public.objects,rationale text,p_retire uuid DEFAULT NULL) RETURNS public.edges LANGUAGE plpgsql SET search_path=public AS $$
DECLARE e public.edges;
BEGIN
 IF p_retire IS NULL THEN
  e.id:=public.uuid_v7();e.verb:='scoped_to';e.from_id:=s.id;e.to_id:=m.id;e.source:='stated';e.authority_used:='act_with_confirmation';e.evidence_refs:='{}';e.created_by:=p_actor;e.created_at:=now();e.rationale:=rationale;
  PERFORM public._ledger_write(s.provenance_chain_id,p_actor,'edge.create',s,jsonb_build_object('edge_id',e.id,'verb',e.verb,'from_id',s.id,'to_id',m.id,'rationale',rationale));
  INSERT INTO public.edges SELECT e.* RETURNING * INTO e;
 ELSE
  SELECT * INTO e FROM public.edges WHERE id=p_retire AND from_id=s.id AND to_id=m.id AND verb='scoped_to' AND retired_at IS NULL FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'ASSOCIATION_NOT_FOUND'; END IF;
  PERFORM public._ledger_write(s.provenance_chain_id,p_actor,'edge.retire',s,jsonb_build_object('edge_id',e.id,'reason',rationale));
  UPDATE public.edges SET retired_at=now() WHERE id=e.id RETURNING * INTO e;
 END IF;
 RETURN e;
END $$;
REVOKE ALL ON FUNCTION public._session_scope_edge(jsonb,public.objects,public.objects,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._session_scope_edge(jsonb,public.objects,public.objects,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.thread_link_session_to_mission(p_actor jsonb,p_session uuid,p_mission uuid,p_rationale text,p_reverse boolean DEFAULT false,p_origin text DEFAULT 'backfilled') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.objects;m public.objects;d public.objects;e public.edges;uid uuid;authority jsonb;a jsonb;scope jsonb;decision_body jsonb;
BEGIN
 PERFORM public._assert_actor(p_actor);uid:=(p_actor->>'id')::uuid;
 IF NOT public._is_current_member(uid) THEN RAISE EXCEPTION 'MEMBER_REQUIRED'; END IF;
 IF length(btrim(p_rationale)) NOT BETWEEN 3 AND 2000 OR p_rationale IS NULL THEN RAISE EXCEPTION 'RATIONALE_REQUIRED'; END IF;
 IF p_origin NOT IN('stated','backfilled') THEN RAISE EXCEPTION 'INVALID_ASSOCIATION_ORIGIN'; END IF;
 SELECT * INTO s FROM public.objects WHERE id=p_session AND type='FramingSession' AND NOT is_tombstone FOR UPDATE;
 SELECT * INTO m FROM public.objects WHERE id=p_mission AND type='ValueMission' AND NOT is_tombstone FOR UPDATE;
 IF s.id IS NULL OR m.id IS NULL OR NOT public._can_read_as(uid,s.permission,s.data_classification) OR NOT public._can_read_as(uid,m.permission,m.data_classification) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 IF NOT p_reverse AND (m.lifecycle_state IN('closed','redirected') OR m.review_date<current_date OR (m.expires_at IS NOT NULL AND m.expires_at<=now())) THEN RAISE EXCEPTION 'MISSION_EXPIRED'; END IF;
 IF p_actor->>'kind'='human' THEN authority:=public._mission_link_authority(uid,m); END IF;
 IF authority IS NULL THEN
  PERFORM public._ledger_write(s.provenance_chain_id,p_actor,'session.mission.suggest',s,jsonb_build_object('recorded_as','suggestion','mission_id',m.id,'rationale',p_rationale,'reverse',p_reverse,'authority_mismatch',true));
  INSERT INTO public.framing_live_findings(session_id,kind,related_object_id,message,payload) VALUES(s.id,'authority_mismatch',m.id,'Recorded as a suggestion — mission association belongs to its named Co-Creator or scoped authority holder.',jsonb_build_object('operation','link_session_to_mission','recorded_as','suggestion','actor',p_actor,'rationale',p_rationale,'reverse',p_reverse));
  RETURN jsonb_build_object('recorded_as','suggestion','edge',NULL,'decision_id',NULL,'authority_mismatch',true);
 END IF;
 scope:=public.session_mission_scope(s.id);
 IF NOT p_reverse AND scope IS NOT NULL AND scope->>'id'<>m.id::text THEN RAISE EXCEPTION 'SESSION_ALREADY_SCOPED: reverse the existing direct association first; containment cannot be overwritten'; END IF;
 SELECT * INTO e FROM public.edges WHERE from_id=s.id AND to_id=m.id AND verb='scoped_to' AND retired_at IS NULL;
 IF NOT p_reverse AND e.id IS NOT NULL THEN RETURN jsonb_build_object('recorded_as','decision','edge',to_jsonb(e),'decision_id',s.body->'mission_association'->'decision_id','unchanged',true); END IF;
 IF p_reverse AND (e.id IS NULL OR s.body->>'mission_ref' IS DISTINCT FROM m.id::text) THEN RAISE EXCEPTION 'DIRECT_ASSOCIATION_REQUIRED: containment links are not reversed here'; END IF;
 a:=p_actor||jsonb_build_object('authority_used','act_with_confirmation');
 decision_body:=jsonb_build_object('session_ref',s.id,'mission_ref',m.id,'decision',CASE WHEN p_reverse THEN 'Reverse session mission association' ELSE 'Associate session intent with mission' END,'decided_by',uid,'authority_used','act_with_confirmation','authority_basis',authority,'effective_from',now(),'rationale',p_rationale,'reversibility','Retire the scoped_to edge; prior confirmations remain intact','alternatives','[]'::jsonb,'context',s.human_ref,'consequences','Only containment changes; confirmed objects remain unchanged');
 d:=public.thread_create_object(a,public._fx_payload('ConfirmedDecision',decision_body->>'decision',decision_body)||jsonb_build_object('owner_id',uid,'permission',s.permission,'data_classification',greatest(s.data_classification,m.data_classification)::text,'rationale',p_rationale));
 IF p_reverse THEN e:=public._session_scope_edge(a,s,m,p_rationale,e.id); ELSE e:=public._session_scope_edge(a,s,m,p_rationale); END IF;
 s.body:=s.body||jsonb_build_object('mission_ref',CASE WHEN p_reverse THEN NULL ELSE m.id::text END,'mission_association',jsonb_build_object('mission_id',CASE WHEN p_reverse THEN NULL ELSE m.id::text END,'origin',p_origin,'decision_id',d.id,'edge_id',e.id,'actor',uid,'authority_basis',authority,'at',now(),'reversal',p_reverse));
 s.version:=s.version+1;
 PERFORM set_config('thread.session_mission_write','on',true);
 s:=public._thread_apply(a,s,'session.mission.decide',jsonb_build_object('decision_id',d.id,'authority_basis',authority,'rationale',p_rationale,'reverse',p_reverse));
 PERFORM set_config('thread.session_mission_write','off',true);
 IF NOT p_reverse THEN UPDATE public.framing_live_findings SET state='resolved',resolved_at=now(),resolution=jsonb_build_object('decision_id',d.id) WHERE session_id=s.id AND kind='authority_mismatch' AND related_object_id=m.id AND state='open' AND payload->>'operation'='link_session_to_mission'; END IF;
 PERFORM public.thread_refresh_graph_layout();
 RETURN jsonb_build_object('recorded_as','decision','edge',to_jsonb(e),'decision_id',d.id,'authority_basis',authority,'mission_ref',s.body->'mission_ref','origin',p_origin,'reversed',p_reverse);
END $$;
REVOKE ALL ON FUNCTION public.thread_link_session_to_mission(jsonb,uuid,uuid,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_link_session_to_mission(jsonb,uuid,uuid,text,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.session_mission_write_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.type='FramingSession' AND ((TG_OP='INSERT' AND nullif(NEW.body->>'mission_ref','') IS NOT NULL) OR (TG_OP='UPDATE' AND (NEW.body->'mission_ref',NEW.body->'mission_association') IS DISTINCT FROM (OLD.body->'mission_ref',OLD.body->'mission_association'))) AND current_setting('thread.session_mission_write',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'MISSION_ASSOCIATION_OPERATION_REQUIRED'; END IF;
 IF TG_TABLE_NAME='edges' THEN RETURN NEW; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.session_mission_write_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.session_mission_write_guard() TO service_role;
CREATE TRIGGER session_mission_write_guard BEFORE INSERT OR UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.session_mission_write_guard();

CREATE OR REPLACE FUNCTION public.thread_start_scoped_session(p_actor jsonb,p jsonb,p_mission uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.objects;r jsonb;
BEGIN
 PERFORM public._assert_actor(p_actor);
 s:=public.thread_create_object(p_actor,jsonb_set(p,'{body,mission_ref}','null'::jsonb));
 IF s.type<>'FramingSession' THEN RAISE EXCEPTION 'SESSION_REQUIRED'; END IF;
 IF p_mission IS NOT NULL THEN r:=public.thread_link_session_to_mission(p_actor,s.id,p_mission,'Session started within this mission',false,'stated'); END IF;
 RETURN jsonb_build_object('id',s.id,'human_ref',s.human_ref,'association',r);
END $$;
REVOKE ALL ON FUNCTION public.thread_start_scoped_session(jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_start_scoped_session(jsonb,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.intent_mission_frontier(p_session uuid DEFAULT NULL) RETURNS TABLE(id uuid,human_ref text,type text,title text,lifecycle_state text,why text,session_id uuid,detector_key text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT o.id,o.human_ref,o.type,o.title,o.lifecycle_state,
 CASE WHEN o.type='NeedStatement' AND o.body->>'status'='becomes_mission' AND NOT EXISTS(SELECT 1 FROM public.objects sig WHERE sig.type='ValueSignal' AND NOT sig.is_tombstone AND sig.lifecycle_state='promoted' AND (lower(regexp_replace(coalesce(sig.body->>'observed_condition',sig.statement),'[^a-zA-Z0-9]+',' ','g'))=lower(regexp_replace(coalesce(o.body->>'observed_condition',o.statement),'[^a-zA-Z0-9]+',' ','g')) OR sig.search@@websearch_to_tsquery('english',left(coalesce(o.body->>'observed_condition',o.statement),600)))) THEN 'intent awaiting a signal' ELSE 'intent awaiting a mission' END,
 s.id,'ConfirmedIntentWithoutMission'::text
 FROM public.objects o JOIN public.objects s ON s.id::text=o.body->>'origin_session_ref' AND s.type='FramingSession' AND NOT s.is_tombstone
 WHERE o.type IN('NeedStatement','BehaviorStatement') AND NOT o.is_tombstone AND o.lifecycle_state IN('confirmed','active','generating','verified_in_simulation','verified_in_shadow','verified_in_production') AND (p_session IS NULL OR s.id=p_session) AND public.session_mission_scope(s.id) IS NULL
 UNION ALL SELECT f.id,s.human_ref,'FramingSession',s.title,s.lifecycle_state,f.message,s.id,'AuthorityMismatch' FROM public.framing_live_findings f JOIN public.objects s ON s.id=f.session_id WHERE f.kind='authority_mismatch' AND f.state='open' AND f.payload->>'operation'='link_session_to_mission' AND (p_session IS NULL OR s.id=p_session)
$$;
REVOKE ALL ON FUNCTION public.intent_mission_frontier(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.intent_mission_frontier(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.thread_need_to_mission(p_actor jsonb,p_need uuid,p_mission jsonb,p_rationale text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n public.objects;s public.objects;sig public.objects;m public.objects;r jsonb;linked jsonb;
BEGIN
 PERFORM public._assert_actor(p_actor);
 IF p_actor->>'kind'<>'human' THEN RAISE EXCEPTION 'HUMAN_DECISION_REQUIRED'; END IF;
 SELECT * INTO n FROM public.objects WHERE id=p_need AND type='NeedStatement' AND NOT is_tombstone FOR UPDATE;
 IF n.id IS NULL OR NOT public._can_read_as((p_actor->>'id')::uuid,n.permission,n.data_classification) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
 SELECT * INTO s FROM public.objects WHERE id::text=n.body->>'origin_session_ref' AND type='FramingSession' AND NOT is_tombstone;
 IF s.id IS NULL OR NOT public._can_read_as((p_actor->>'id')::uuid,s.permission,s.data_classification) THEN RAISE EXCEPTION 'SESSION_REQUIRED'; END IF;
 IF n.lifecycle_state<>'confirmed' THEN RAISE EXCEPTION 'CONFIRMED_NEED_REQUIRED'; END IF;
 SELECT * INTO sig FROM public.objects WHERE id::text=p_mission->>'signal_id' AND type='ValueSignal' AND NOT is_tombstone AND lifecycle_state='promoted' AND public._can_read_as((p_actor->>'id')::uuid,permission,data_classification);
 IF sig.id IS NULL THEN RAISE EXCEPTION 'INTENT_AWAITING_SIGNAL: record and promote a readable signal through /signals first'; END IF;
 IF p_mission->>'co_creator' IS DISTINCT FROM p_actor->>'id' THEN RAISE EXCEPTION 'MISSION_CO_CREATOR_REQUIRED'; END IF;
 IF length(btrim(p_rationale)) NOT BETWEEN 3 AND 2000 OR p_rationale IS NULL THEN RAISE EXCEPTION 'RATIONALE_REQUIRED'; END IF;
 r:=public.thread_human_operation(p_actor,'mission',p_mission);
 SELECT * INTO m FROM public.objects WHERE id=(r->>'id')::uuid;
 PERFORM public.thread_create_edge(p_actor,jsonb_build_object('verb','promoted_from','from_id',m.id,'to_id',n.id,'source','stated','rationale',p_rationale));
 linked:=public.thread_link_session_to_mission(p_actor,s.id,m.id,p_rationale);
 IF linked->>'recorded_as'<>'decision' THEN RAISE EXCEPTION 'MISSION_CO_CREATOR_REQUIRED'; END IF;
 -- No confirmed object is rewritten: scope derives from the originating session, reversibly.
 RETURN r||jsonb_build_object('association',linked,'need_id',n.id,'confirmed_objects_modified',0);
END $$;
REVOKE ALL ON FUNCTION public.thread_need_to_mission(jsonb,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_need_to_mission(jsonb,uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.intent_mission_creation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.objects o WHERE o.id=ANY(NEW.source_behavior_ids) AND o.body ? 'origin_session_ref' AND NOT EXISTS(SELECT 1 FROM public.objects s WHERE s.id::text=o.body->>'origin_session_ref' AND public.session_mission_scope(s.id) IS NOT NULL)) THEN RAISE EXCEPTION 'INTENT_AWAITING_MISSION: associate confirmed intent with a mission before creation'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.intent_mission_creation_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intent_mission_creation_guard() TO service_role;
CREATE TRIGGER intent_mission_creation_guard BEFORE INSERT ON public.creation_prompts FOR EACH ROW EXECUTE FUNCTION public.intent_mission_creation_guard();

-- Advisory extension stays separate from the canonical blocking detector set.
CREATE OR REPLACE FUNCTION public.session_mission_advisory_catalogue() RETURNS TABLE(key text,severity text,blocking boolean) LANGUAGE sql IMMUTABLE AS $$ SELECT 'ConfirmedIntentWithoutMission'::text,'advisory'::text,false $$;
REVOKE ALL ON FUNCTION public.session_mission_advisory_catalogue() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.session_mission_advisory_catalogue() TO authenticated,service_role;
DO $$
BEGIN
 IF NOT public._edge_signature_ok('scoped_to','ValueMission','ValueCell') OR NOT public._edge_signature_ok('scoped_to','FramingSession','ValueMission') OR NOT public._edge_signature_ok('promoted_from','ValueMission','ValueSignal') OR NOT public._edge_signature_ok('promoted_from','ValueMission','NeedStatement') THEN RAISE EXCEPTION 'SESSION_MISSION_SIGNATURE_REGRESSION'; END IF;
END $$;
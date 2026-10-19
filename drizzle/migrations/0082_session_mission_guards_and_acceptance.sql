-- Harden the narrow association path and exercise actual transactions, not SQL text.
CREATE OR REPLACE FUNCTION public.session_scope_edge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.verb='scoped_to' AND EXISTS(SELECT 1 FROM public.objects o WHERE o.id=NEW.from_id AND o.type='FramingSession') AND current_setting('thread.session_scope_edge_write',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'MISSION_ASSOCIATION_OPERATION_REQUIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.session_scope_edge_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.session_scope_edge_guard() TO service_role;
CREATE TRIGGER session_scope_edge_guard BEFORE INSERT OR UPDATE ON public.edges FOR EACH ROW EXECUTE FUNCTION public.session_scope_edge_guard();
DO $patch$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public._session_scope_edge(jsonb,public.objects,public.objects,text,uuid)'::regprocedure) INTO d;
 d:=replace(d,'BEGIN','BEGIN PERFORM set_config(''thread.session_scope_edge_write'',''on'',true);');
 d:=replace(d,' RETURN e;',' PERFORM set_config(''thread.session_scope_edge_write'',''off'',true); RETURN e;');
 EXECUTE d;
 SELECT pg_get_functiondef('public.session_mission_scope(uuid)'::regprocedure) INTO d;
 -- A reversal overrides the supplementary need-promotion path, not burst containment.
 d:=replace(d,'child.type=''FramingSession'' AND parent.type=''ValueMission'' AND EXISTS','child.type=''FramingSession'' AND coalesce(child.body->''mission_association''->>''reversal'',''false'')<>''true'' AND parent.type=''ValueMission'' AND EXISTS');
 EXECUTE d;
 SELECT pg_get_functiondef('public.thread_link_session_to_mission(jsonb,uuid,uuid,text,boolean,text)'::regprocedure) INTO d;
 -- Actor-filter every scope hop when the service-only writer resolves containment.
 d:=replace(d,' scope:=public.session_mission_scope(s.id);',' PERFORM set_config(''request.jwt.claim.sub'',uid::text,true); scope:=public.session_mission_scope(s.id);');
 EXECUTE d;
END $patch$;

CREATE OR REPLACE FUNCTION public.thread_session_mission_selftest() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a jsonb;sys jsonb:='{"kind":"system","id":"session-mission-selftest","authority_used":"observe"}';u uuid;other uuid;sig public.objects;bad public.objects;m public.objects;s public.objects;started jsonb;cell public.objects;burst public.objects;traverse public.objects;n public.objects;snapshot jsonb;r jsonb;checks jsonb:='[]';ok boolean;detail text;st text;before_count bigint;
BEGIN
 SELECT user_id INTO u FROM public.user_roles WHERE role='steward' ORDER BY user_id LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'SELFTEST_STEWARD_REQUIRED'; END IF;
 a:=jsonb_build_object('kind','human','id',u,'authority_used','observe');
 SELECT auth_user_id INTO other FROM public.agents WHERE auth_user_id IS NOT NULL AND auth_user_id<>u LIMIT 1;
 IF other IS NULL THEN other:=public.uuid_v7(); END IF;
 SELECT count(*) INTO before_count FROM public.objects;
 BEGIN
 sig:=public.thread_create_object(sys,public._fx_payload('ValueSignal','Scope selftest measurable condition',jsonb_build_object('observed_condition','Scope selftest unique condition','baseline_performance','10 minutes')));
 sig:=public.thread_transition_object(sys,sig.id,sig.version,'promoted','Fixture promoted signal');
 m:=public.thread_create_object(sys,public._fx_payload('ValueMission','Scope selftest mission',public._selftest_body('ValueMission','{}')||jsonb_build_object('signal_ref',sig.id,'co_creator',u,'builder',other,'decision_authority','Own this mission intent'))||jsonb_build_object('co_creator_id',u,'builder_id',other));
 started:=public.thread_start_scoped_session(a,public._fx_payload('FramingSession','Scope selftest stated',public._selftest_body('FramingSession','{}')),m.id);
 SELECT * INTO s FROM public.objects WHERE id=(started->>'id')::uuid;
 r:=public.session_mission_scope(s.id);
 checks:=checks||jsonb_build_object('item',1,'ok',s.body->>'mission_ref'=m.id::text AND r->>'id'=m.id::text AND r->>'origin'='stated','output',r);
 cell:=public.thread_create_object(sys,public._fx_payload('ValueCell','Scope selftest cell',public._selftest_body('ValueCell','{}')||jsonb_build_object('mission_ref',m.id)));
 burst:=public.thread_create_object(sys,public._fx_payload('ValueBurst','Scope selftest burst',public._selftest_body('ValueBurst','{}')||jsonb_build_object('cell_ref',cell.id)));
 traverse:=public.thread_create_object(sys,public._fx_payload('FramingSession','Scope selftest containment',public._selftest_body('FramingSession','{}')||jsonb_build_object('burst_ref',burst.id)));
 r:=public.session_mission_scope(traverse.id);
 checks:=checks||jsonb_build_object('item',2,'ok',traverse.body->>'mission_ref' IS NULL AND r->>'id'=m.id::text AND r->>'origin'='containment','output',r);
 s:=public.thread_create_object(sys,public._fx_payload('FramingSession','Scope selftest retrospective',public._selftest_body('FramingSession','{}')));
 n:=public.thread_create_object(sys,public._fx_payload('BehaviorStatement','Scope selftest confirmed intent',jsonb_build_object('condition','A test condition','observable_result','A test result','operating_constraints','[]'::jsonb)));
 -- Create the confirmation before adding its session provenance, using the existing confirmation contract.
 n.body:=n.body||jsonb_build_object('origin_session_ref',s.id,'confirmation',jsonb_build_object('actor_id',u,'at',now(),'authority_used','observe'),'material',false);
 n.version:=n.version+1;n.lifecycle_state:='confirmed';
 n:=public._thread_apply(sys,n,'object.transition',jsonb_build_object('rationale','Rollback-only confirmed intent fixture'));
 snapshot:=to_jsonb(n);
 ok:=EXISTS(SELECT 1 FROM public.intent_mission_frontier(s.id) WHERE id=n.id AND why='intent awaiting a mission');
 r:=public.thread_link_session_to_mission(a,s.id,m.id,'Retrospective scope decision');
 checks:=checks||jsonb_build_object('item',3,'ok',r->>'recorded_as'='decision' AND r->>'origin'='backfilled' AND r->'authority_basis'->>'holder'=u::text,'output',r);
 checks:=checks||jsonb_build_object('item',7,'ok',ok AND NOT EXISTS(SELECT 1 FROM public.intent_mission_frontier(s.id) WHERE id=n.id),'output',jsonb_build_object('before',ok,'after',EXISTS(SELECT 1 FROM public.intent_mission_frontier(s.id) WHERE id=n.id)));
 checks:=checks||jsonb_build_object('item',6,'ok',(SELECT to_jsonb(o)=snapshot FROM public.objects o WHERE o.id=n.id),'output',jsonb_build_object('confirmed_object_unchanged',(SELECT to_jsonb(o)=snapshot FROM public.objects o WHERE o.id=n.id)));
 r:=public.thread_link_session_to_mission(a,s.id,m.id,'Reverse retrospective scope decision',true);
 checks:=checks||jsonb_build_object('item',4,'ok',(SELECT to_jsonb(o)=snapshot FROM public.objects o WHERE o.id=n.id) AND public.session_mission_scope(s.id) IS NULL,'output',r);
 INSERT INTO public.user_roles(user_id,role) VALUES(other,'member') ON CONFLICT DO NOTHING;
 r:=public.thread_link_session_to_mission(jsonb_build_object('kind','agent','id',other,'authority_used','recommend'),s.id,m.id,'Participant association suggestion');
 checks:=checks||jsonb_build_object('item',5,'ok',r->>'recorded_as'='suggestion' AND (SELECT body->>'mission_ref' IS NULL FROM public.objects WHERE id=s.id) AND EXISTS(SELECT 1 FROM public.intent_mission_frontier(s.id) WHERE detector_key='AuthorityMismatch'),'output',r);
 PERFORM public.thread_create_edge(sys,jsonb_build_object('verb','scoped_to','from_id',m.id,'to_id',cell.id,'source','stated','rationale','Preserve existing mission cell signature'));
 checks:=checks||jsonb_build_object('item',9,'ok',EXISTS(SELECT 1 FROM public.edges WHERE from_id=m.id AND to_id=cell.id AND verb='scoped_to' AND retired_at IS NULL),'output','ValueMission -> ValueCell scoped_to inserted');
 bad:=public.thread_create_object(sys,public._fx_payload('ValueSignal','Scope selftest unframed','{}'));
 ok:=false;
 BEGIN PERFORM public.thread_create_edge(sys,jsonb_build_object('verb','promoted_from','from_id',m.id,'to_id',bad.id,'source','stated','rationale','Unframed signal must fail')); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT,st=RETURNED_SQLSTATE;ok:=st='P0001' AND detail LIKE 'SIGNAL_NOT_FRAMED:%'; END;
 n:=public.thread_create_object(sys,public._fx_payload('NeedStatement','Scope selftest need without signal',jsonb_build_object('need','Scope selftest nonexistent condition')));
 PERFORM public.thread_create_edge(sys,jsonb_build_object('verb','promoted_from','from_id',m.id,'to_id',n.id,'source','stated','rationale','Need is intent not a signal'));
 checks:=checks||jsonb_build_object('item',10,'ok',ok AND EXISTS(SELECT 1 FROM public.edges WHERE from_id=m.id AND to_id=n.id AND verb='promoted_from'),'output',jsonb_build_object('signal_sqlstate',st,'signal_exception',detail,'need_edge_inserted',true));
 n.body:=n.body||jsonb_build_object('origin_session_ref',s.id,'status','becomes_mission','observed_condition','zqvxxnonexistentcondition','confirmation',jsonb_build_object('actor_id',u,'at',now(),'authority_used','observe'),'material',false);n.version:=n.version+1;n.lifecycle_state:='confirmed';n:=public._thread_apply(sys,n,'object.transition',jsonb_build_object('rationale','Rollback-only need fixture'));
 ok:=false;detail:=NULL;
 BEGIN PERFORM public.thread_need_to_mission(a,n.id,jsonb_build_object('signal_id',public.uuid_v7(),'co_creator',u),'Need must resolve a promoted signal'); EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS detail=MESSAGE_TEXT,st=RETURNED_SQLSTATE;ok:=st='P0001' AND detail LIKE 'INTENT_AWAITING_SIGNAL:%'; END;
 checks:=checks||jsonb_build_object('item',8,'ok',ok AND EXISTS(SELECT 1 FROM public.intent_mission_frontier(s.id) WHERE id=n.id AND why='intent awaiting a signal'),'output',jsonb_build_object('sqlstate',st,'exception',detail,'frontier', (SELECT why FROM public.intent_mission_frontier(s.id) WHERE id=n.id)));
 RAISE EXCEPTION USING ERRCODE='TT001',MESSAGE='SELFTEST_ROLLBACK';
 EXCEPTION WHEN SQLSTATE 'TT001' THEN NULL;
 END;
 RETURN jsonb_build_object('suite','session_mission','checks',checks,'all_ok',jsonb_array_length(checks)=10 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE c->>'ok' IS DISTINCT FROM 'true'),'fixtures_rolled_back',(SELECT count(*)=before_count FROM public.objects));
END $$;
REVOKE ALL ON FUNCTION public.thread_session_mission_selftest() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.thread_session_mission_selftest() TO service_role;
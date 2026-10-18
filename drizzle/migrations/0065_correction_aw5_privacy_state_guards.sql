-- L-10: no application-role read of person-level activity. Aggregates are the only read path.
DROP POLICY IF EXISTS "own usage sessions" ON public.usage_sessions;
REVOKE ALL ON public.usage_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.usage_sessions TO service_role;
CREATE OR REPLACE FUNCTION public.anti_wiki_action_ratio(p_window interval DEFAULT interval '30 days') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint; a bigint; r bigint; cfg public.canon_settings; ap numeric; rp numeric; valid boolean; ok boolean;
BEGIN
 IF p_window IS NULL OR p_window<=interval '0 seconds' OR p_window>interval '366 days' THEN RAISE EXCEPTION 'INVALID_MEASUREMENT_WINDOW'; END IF;
 SELECT count(*),count(*) FILTER(WHERE mutating_actions>0),count(*) FILTER(WHERE mutating_actions=0 AND reads>0) INTO n,a,r FROM public.usage_sessions WHERE started_at>=now()-p_window;
 SELECT * INTO cfg FROM public.canon_settings WHERE key='anti_wiki.action_ratio';
 ap:=100.0*a/nullif(n,0); rp:=100.0*r/nullif(n,0);
 valid:=cfg.status='set' AND jsonb_typeof(cfg.value->'min_action_pct')='number' AND jsonb_typeof(cfg.value->'max_read_only_pct')='number';
 IF valid THEN valid:=(cfg.value->>'min_action_pct')::numeric BETWEEN 0 AND 100 AND (cfg.value->>'max_read_only_pct')::numeric BETWEEN 0 AND 100; END IF;
 ok:=coalesce(valid AND ap>=(cfg.value->>'min_action_pct')::numeric AND rp<=(cfg.value->>'max_read_only_pct')::numeric,false);
 RETURN jsonb_build_object('action_pct',ap,'read_only_pct',rp,'status',CASE WHEN cfg.status='open' THEN 'THRESHOLD_UNSET' WHEN NOT coalesce(valid,false) THEN 'THRESHOLD_UNSET' WHEN n=0 THEN 'NO_EVIDENCE' ELSE 'measured' END,'thresholds',cfg.value,'pass',ok,'release_blocking',CASE WHEN cfg.status='open' THEN false ELSE NOT ok END,'severity',CASE WHEN cfg.status='open' THEN 'warning' WHEN ok THEN 'none' ELSE 'error' END,'evidence',jsonb_build_object('source','aggregate_usage_sessions','sessions',n,'window_seconds',extract(epoch FROM p_window)));
END $$;
REVOKE ALL ON FUNCTION public.anti_wiki_action_ratio(interval) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.anti_wiki_action_ratio(interval) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.phase10_action_ratios() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.anti_wiki_action_ratio(interval '30 days') $$;
REVOKE ALL ON FUNCTION public.phase10_action_ratios() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase10_action_ratios() TO authenticated,service_role;
-- L-02: an OPEN setting has one owned warning, no expiry; setting it clears only this warning.
CREATE OR REPLACE FUNCTION public.sync_action_ratio_warning() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE own uuid;
BEGIN
 IF NEW.key<>'anti_wiki.action_ratio' THEN RETURN NEW; END IF;
 SELECT user_id INTO own FROM public.user_roles WHERE role='steward' ORDER BY user_id LIMIT 1;
 IF own IS NULL THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 INSERT INTO public.detectors(key,family,owner_id,schedule,event_triggers,params,version) VALUES('AntiWikiActionRatioThresholdUnset','thread',own,'0 * * * *',ARRAY['canon_setting.changed'],jsonb_build_object('severity','warning','release_blocking',false,'expiry',NULL,'rule','L-02','query','anti_wiki_action_ratio'),'1.0.0') ON CONFLICT(key) DO NOTHING;
 IF NEW.status='open' THEN
  IF NOT EXISTS(SELECT 1 FROM public.detector_findings WHERE detector_key='AntiWikiActionRatioThresholdUnset' AND state='open') THEN
   INSERT INTO public.detector_findings(id,detector_key,severity,owner_id,state,evidence) VALUES(public.uuid_v7(),'AntiWikiActionRatioThresholdUnset','warning',own,'open',jsonb_build_object('status','THRESHOLD_UNSET','release_blocking',false,'expiry',NULL,'measurement',public.phase10_action_ratios()));
  END IF;
 ELSE
  UPDATE public.detector_findings SET state='resolved',resolved_at=now(),resolution=jsonb_build_object('kind','threshold_no_longer_open','at',now()) WHERE detector_key='AntiWikiActionRatioThresholdUnset' AND state='open';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_action_ratio_warning() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_action_ratio_warning() TO service_role;
CREATE TRIGGER action_ratio_warning AFTER INSERT OR UPDATE ON public.canon_settings FOR EACH ROW EXECUTE FUNCTION public.sync_action_ratio_warning();
-- L-11: normalized token guard, shared across transitions, current objects and immutable versions.
CREATE OR REPLACE FUNCTION public.is_prohibited_lifecycle_state(s text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT coalesce(s,'') ~* '(^|[^a-z0-9])(approval|approved|approve|awaiting|gate|sign[ _-]?off|pending[ _-]?review|submitted[ _-]?for[ _-]?review|qa[ _-]?phase|in[ _-]?qa[ _-]?phase)([^a-z0-9]|$)' $$;
REVOKE ALL ON FUNCTION public.is_prohibited_lifecycle_state(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_prohibited_lifecycle_state(text) TO authenticated,service_role;
ALTER TABLE public.lifecycle_transitions DROP CONSTRAINT no_approval_states;
ALTER TABLE public.lifecycle_transitions ADD CONSTRAINT no_approval_states CHECK(NOT public.is_prohibited_lifecycle_state(from_state) AND NOT public.is_prohibited_lifecycle_state(to_state));
ALTER TABLE public.lifecycle_initial_states ADD CONSTRAINT initial_no_approval_states CHECK(NOT public.is_prohibited_lifecycle_state(state)) NOT VALID;
ALTER TABLE public.objects ADD CONSTRAINT objects_no_approval_states CHECK(NOT public.is_prohibited_lifecycle_state(lifecycle_state)) NOT VALID;
ALTER TABLE public.object_versions ADD CONSTRAINT versions_no_approval_states CHECK(NOT public.is_prohibited_lifecycle_state(lifecycle_state)) NOT VALID;
ALTER TABLE public.lifecycle_initial_states VALIDATE CONSTRAINT initial_no_approval_states;
ALTER TABLE public.objects VALIDATE CONSTRAINT objects_no_approval_states;
ALTER TABLE public.object_versions VALIDATE CONSTRAINT versions_no_approval_states;
-- L-10: technical field names cannot evade the generation/query refusal.
CREATE OR REPLACE FUNCTION public._prohibited_inference_base(t text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT (SELECT jsonb_build_object('key',k,'reason',r) FROM (VALUES
 ('activity_volume','(prompt|message|agent[ -]?call|keystroke|login|commit|meeting)s? (count|volume|total|frequency)','Infers performance from activity volume (14.3)',1),
 ('hours_connected','(hours|time) (connected|online|logged|active)','Infers performance from hours connected (14.3)',2),
 ('leaderboard','(leaderboard|league table)','Ranks individual humans (14.3)',3),
 ('rank_people','(rank|rate|score|compare)( the| all| our| each)? (individual|employee|people|person|staff|builder|co-creator|member|colleague)s?','Ranks, rates or compares individual humans (14.3)',4),
 ('individual_activity','(individual|per[- ](person|user|employee|builder)|each (person|employee|builder|user))(''s)? (activity|productivity|output|usage|performance)','Surfaces individual activity (14.3)',5),
 ('activity_by_person','(activity|productivity|usage|output) (by|per|for each) (person|user|employee|builder|individual)','Surfaces individual activity (14.3)',6),
 ('private_conversation','private (conversation|message|chat)s?','Scores people from private conversations (14.3)',7),
 ('discipline','disciplin(e|ary)','Uses coaching data for discipline (14.3)',8),
 ('progress_report','(progress against plan|task list|activity summary|status report)','Activity summary is not a rendition (10.4)',9)) x(k,p,r,o) WHERE coalesce(t,'') ~* p ORDER BY o LIMIT 1) $$;
REVOKE ALL ON FUNCTION public._prohibited_inference_base(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._prohibited_inference_base(text) TO service_role;
CREATE OR REPLACE FUNCTION public._prohibited_inference(t text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN coalesce(t,'') ~* '(actor_id(.|\n)*(reads|mutating_actions)|(reads|mutating_actions)(.|\n)*actor_id)' THEN jsonb_build_object('key','actor_activity_fields','reason','Actor-level usage-session activity is never exposed (L-10 / 14.3)') ELSE public._prohibited_inference_base(t) END $$;
-- Preserve authenticated callers of the existing invoker refusal helper.
GRANT EXECUTE ON FUNCTION public._prohibited_inference_base(text) TO authenticated;
COMMENT ON TABLE public.usage_sessions IS 'Private measurement input. No application-role table reads. Only security-definer aggregate functions return windowed ratios/counts; never actor-level activity.';
COMMENT ON FUNCTION public.ledger_row_hash(public.ledger) IS 'Single database canonicalization: jsonb_build_object text serialization, epoch text, explicit nulls and SQL pgcrypto digest. Application code must not reimplement this hash.';
COMMENT ON FUNCTION public.ledger_hash() IS 'Global transaction advisory lock before sequence allocation/head read. Serial append guarantees one chain; contention at 500 calls/s requires isolated load proof.';
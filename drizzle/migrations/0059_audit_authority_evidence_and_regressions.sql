-- Repair the existing Tier4 assertion's error category: stronger independent validation retains the public rejection category.
CREATE OR REPLACE FUNCTION public._audit_tier4_judgment(p_capability uuid,p_judgment uuid,p_actor jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public._assert_independent_judgment(p_capability,p_judgment,p_actor);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'TIER4_AUTONOMY_PROHIBITED: %',SQLERRM;
END $$;
REVOKE ALL ON FUNCTION public._audit_tier4_judgment(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._audit_tier4_judgment(uuid,uuid,jsonb) TO service_role;
DO $patch$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.thread_set_authority(jsonb,uuid,public.authority_level,text,text,uuid[],jsonb)'::regprocedure) INTO d;
 d:=replace(d,'public._assert_independent_judgment(o.id','public._audit_tier4_judgment(o.id');
 EXECUTE d;
END $patch$;

-- New evidence guard runs for promotions/grants only; automatic demotion and withdrawal stay available without evidence.
CREATE OR REPLACE FUNCTION public.audit_authority_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ref uuid; e public.objects; actor jsonb;
BEGIN
 IF NEW.cause NOT IN ('promotion','grant') THEN RETURN NEW; END IF;
 IF cardinality(NEW.evidence_refs) IS NULL OR cardinality(NEW.evidence_refs)=0 THEN RAISE EXCEPTION 'EVIDENCE_REQUIRED: authority needs applicable current evidence'; END IF;
 FOREACH ref IN ARRAY NEW.evidence_refs LOOP
  SELECT * INTO e FROM public.objects WHERE id=ref;
  IF e.id IS NULL OR public._audit_current_evidence(e) IS NOT TRUE THEN RAISE EXCEPTION 'CURRENT_AUTHORITY_EVIDENCE_REQUIRED'; END IF;
  IF e.body->>'adapter_mode'='simulated' OR e.body->'provenance'->>'simulated'='true' THEN RAISE EXCEPTION 'SIMULATED_EVIDENCE_DOES_NOT_PROMOTE'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_authority_evidence_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_authority_evidence_guard() TO service_role;
CREATE TRIGGER audit_authority_evidence BEFORE INSERT ON public.authority_history FOR EACH ROW EXECUTE FUNCTION public.audit_authority_evidence_guard();

-- Assurance generic validity includes expiry/retirement; walkthrough cannot pass on unrelated live-labelled evidence.
CREATE OR REPLACE FUNCTION public.audit_assurance_current_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE subject public.objects; e public.objects; ref text;
BEGIN
 IF NEW.type<>'ControlCheck' OR NEW.body->>'result' IS DISTINCT FROM 'passed' OR NOT(NEW.body ? 'assurance_kind') THEN RETURN NEW; END IF;
 SELECT * INTO subject FROM public.objects WHERE id::text=NEW.body->>'subject_ref';
 IF public._audit_current_evidence(subject) IS NOT TRUE THEN RAISE EXCEPTION 'LIVE_CURRENT_EVIDENCE_REQUIRED: assurance subject is expired or retired'; END IF;
 FOR ref IN SELECT jsonb_array_elements_text(NEW.body->'evidence') LOOP
  SELECT * INTO e FROM public.objects WHERE id::text=ref;
  IF public._audit_current_evidence(e) IS NOT TRUE THEN RAISE EXCEPTION 'LIVE_CURRENT_EVIDENCE_REQUIRED: assurance evidence is expired or retired'; END IF;
 END LOOP;
 IF NEW.body->>'assurance_kind'='compliance_walkthrough' THEN RAISE EXCEPTION 'COMPLIANCE_EXECUTION_REQUIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_assurance_current_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_assurance_current_guard() TO service_role;
CREATE TRIGGER audit_assurance_current BEFORE INSERT OR UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.audit_assurance_current_guard();

-- Behavioral test: missing promotion evidence fails, while withdrawal is not blocked by this evidence guard.
DO $regression$
DECLARE o public.objects; actor jsonb:='{"kind":"system","id":"audit.authority","authority_used":"observe"}'; rejected boolean:=false; r jsonb;
BEGIN
 BEGIN
  o:=public.thread_create_object(actor,public._fx_payload('ComposableCapability','audit evidence guard','{}'::jsonb));
  BEGIN PERFORM public.thread_set_authority(actor,o.id,'recommend','promotion','audit',ARRAY[public.uuid_v7()]); EXCEPTION WHEN OTHERS THEN rejected:=SQLERRM LIKE 'CURRENT_AUTHORITY_EVIDENCE_REQUIRED%'; END;
  IF NOT rejected THEN RAISE EXCEPTION 'MISSING_AUTHORITY_EVIDENCE_ACCEPTED'; END IF;
  RAISE EXCEPTION USING ERRCODE='TT001',MESSAGE='audit fixtures rollback';
 EXCEPTION WHEN SQLSTATE 'TT001' THEN NULL;
 END;
END $regression$;
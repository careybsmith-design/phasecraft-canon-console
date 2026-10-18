-- L-06 additive normalization; compatibility JSON is input only, not the constraint source.
ALTER TABLE public.extraction_spans ADD COLUMN span_kind text NOT NULL DEFAULT 'char_range';
ALTER TABLE public.extraction_spans ADD COLUMN drawing_region jsonb;
ALTER TABLE public.extraction_spans ADD COLUMN log_start bigint;
ALTER TABLE public.extraction_spans ADD COLUMN log_end bigint;
ALTER TABLE public.extraction_spans ADD CONSTRAINT spans_source_object FOREIGN KEY(source_ref) REFERENCES public.objects(id) NOT VALID;
CREATE INDEX extraction_spans_object_source ON public.extraction_spans(object_id,source_ref);
CREATE OR REPLACE FUNCTION public.persist_extraction_spans() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s jsonb; source uuid; k text; a bigint; b bigint;
BEGIN
 IF NOT (NEW.type IN('ExtractedStatement','NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation') OR NEW.body ? 'origin_session_ref') OR NEW.is_tombstone THEN RETURN NEW; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.body->'provenance_spans')='array' THEN NEW.body->'provenance_spans' ELSE '[]'::jsonb END) LOOP
  source:=(s->>'artifact_id')::uuid; k:=s->>'kind';
  IF source IS NULL OR NOT EXISTS(SELECT 1 FROM public.objects WHERE id=source AND NOT is_tombstone AND type='CoCreationArtifact') THEN RAISE EXCEPTION 'PROVENANCE_SOURCE_REQUIRED'; END IF;
  IF k='region' THEN
   IF jsonb_array_length(s->'start')<>2 OR jsonb_array_length(s->'end')<>2 OR NOT ((s->'start'->>0)::numeric>=0 AND (s->'start'->>1)::numeric>=0 AND (s->'end'->>0)::numeric<=1 AND (s->'end'->>1)::numeric<=1 AND (s->'end'->>0)::numeric>(s->'start'->>0)::numeric AND (s->'end'->>1)::numeric>(s->'start'->>1)::numeric) THEN RAISE EXCEPTION 'PROVENANCE_RANGE_REQUIRED'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.extraction_spans WHERE object_id=NEW.id AND source_ref=source AND drawing_region=jsonb_build_object('start',s->'start','end',s->'end')) THEN INSERT INTO public.extraction_spans(object_id,source_ref,speaker_id,span_kind,drawing_region) VALUES(NEW.id,source,(s->>'speaker_id')::uuid,k,jsonb_build_object('start',s->'start','end',s->'end')); END IF;
  ELSIF k IN('time_range','char_range','log_offset') THEN
   a:=(s->>'start')::bigint; b:=(s->>'end')::bigint;
   IF a IS NULL OR b IS NULL OR a<0 OR b<=a THEN RAISE EXCEPTION 'PROVENANCE_RANGE_REQUIRED'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.extraction_spans WHERE object_id=NEW.id AND source_ref=source AND span_kind=k AND coalesce(start_ms,char_start,log_start)=a AND coalesce(end_ms,char_end,log_end)=b) THEN
    INSERT INTO public.extraction_spans(object_id,source_ref,speaker_id,span_kind,start_ms,end_ms,char_start,char_end,log_start,log_end) VALUES(NEW.id,source,(s->>'speaker_id')::uuid,k,CASE WHEN k='time_range' THEN a END,CASE WHEN k='time_range' THEN b END,CASE WHEN k='char_range' THEN a::int END,CASE WHEN k='char_range' THEN b::int END,CASE WHEN k='log_offset' THEN a END,CASE WHEN k='log_offset' THEN b END);
   END IF;
  ELSE RAISE EXCEPTION 'PROVENANCE_RANGE_REQUIRED'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.persist_extraction_spans() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_extraction_spans() TO service_role;
-- Backfill normalized ranges from existing valid source-backed compatibility records.
INSERT INTO public.extraction_spans(object_id,source_ref,speaker_id,span_kind,start_ms,end_ms,char_start,char_end,log_start,log_end,drawing_region)
SELECT o.id,(s->>'artifact_id')::uuid,(s->>'speaker_id')::uuid,s->>'kind',CASE WHEN s->>'kind'='time_range' THEN (s->>'start')::bigint END,CASE WHEN s->>'kind'='time_range' THEN (s->>'end')::bigint END,CASE WHEN s->>'kind'='char_range' THEN (s->>'start')::int END,CASE WHEN s->>'kind'='char_range' THEN (s->>'end')::int END,CASE WHEN s->>'kind'='log_offset' THEN (s->>'start')::bigint END,CASE WHEN s->>'kind'='log_offset' THEN (s->>'end')::bigint END,CASE WHEN s->>'kind'='region' THEN jsonb_build_object('start',s->'start','end',s->'end') END
FROM public.objects o CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.body->'provenance_spans')='array' THEN o.body->'provenance_spans' ELSE '[]'::jsonb END) s JOIN public.objects src ON src.id=(s->>'artifact_id')::uuid AND src.type='CoCreationArtifact' AND NOT src.is_tombstone
WHERE s->>'kind' IN('time_range','char_range','log_offset','region') AND NOT EXISTS(SELECT 1 FROM public.extraction_spans e WHERE e.object_id=o.id AND e.source_ref=src.id);
CREATE TRIGGER b_persist_extraction_spans AFTER INSERT OR UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.persist_extraction_spans();
CREATE OR REPLACE FUNCTION public.require_extraction_span() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT NEW.is_tombstone AND (NEW.type IN('ExtractedStatement','NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation') OR NEW.body ? 'origin_session_ref') AND NOT EXISTS(SELECT 1 FROM public.extraction_spans s JOIN public.objects src ON src.id=s.source_ref WHERE s.object_id=NEW.id AND NOT src.is_tombstone AND src.type='CoCreationArtifact' AND ((s.span_kind='time_range' AND s.start_ms>=0 AND s.end_ms>s.start_ms) OR (s.span_kind='char_range' AND s.char_start>=0 AND s.char_end>s.char_start) OR (s.span_kind='log_offset' AND s.log_start>=0 AND s.log_end>s.log_start) OR (s.span_kind='region' AND s.drawing_region IS NOT NULL))) THEN RAISE EXCEPTION 'PROVENANCE_SPAN_REQUIRED: extracted object cannot commit without a source-backed span'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_extraction_span() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.require_extraction_span() TO service_role;
CREATE CONSTRAINT TRIGGER extraction_span_required AFTER INSERT OR UPDATE ON public.objects DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.require_extraction_span();
ALTER TABLE public.objects DROP CONSTRAINT objects_extracted_provenance_spans;
CREATE TRIGGER extraction_spans_immutable BEFORE UPDATE OR DELETE ON public.extraction_spans FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
COMMENT ON TABLE public.extraction_spans IS 'Authoritative normalized provenance; populated in the object transaction and checked at commit, including draft inserts. body.provenance_spans remains deprecated compatibility input/read rendering only.';
ALTER TABLE public.extraction_spans VALIDATE CONSTRAINT spans_source_object;

create or replace function public._fx_payload(_type text, _title text, _body jsonb) returns jsonb
language sql stable as $$
  select jsonb_build_object('type', _type, 'title', _title, 'statement', _title, 'machine_description', 'Phase 2B self-test fixture',
    'body', _body, 'review_date', (current_date + 30)::text, 'expiration_condition', jsonb_build_object('kind', 'review_date_passes'),
    'retirement_path', jsonb_build_object('mode', 'tombstone'), 'risk_tier', '1',
    'permission', jsonb_build_object('roles', '[]'::jsonb, 'purpose', 'phase2b self-test'), 'data_classification', 'internal',
    'rationale', 'Phase 2B self-test fixture')
$$;

create or replace function public.thread_phase2b_selftest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase2b","authority_used":"observe"}';
  s public.objects; art public.objects; xs public.objects; xs2 public.objects; xs3 public.objects; xs4 public.objects; bs public.objects;
  pa uuid := public.uuid_v7(); pb uuid := public.uuid_v7(); ua uuid := public.uuid_v7();
  res jsonb := '[]'; ok boolean; msg text; spans jsonb; fx uuid[] := '{}'; i uuid; v int; n int;
begin
  s := public.thread_create_object(a, public._fx_payload('FramingSession', 'Phase 2B self-test session', jsonb_build_object(
    'co_creator', pa, 'builder', pb, 'purpose', 'self-test', 'modalities', '["text"]'::jsonb,
    'participants', jsonb_build_array(
      jsonb_build_object('id', pa, 'name', 'Co-Creator', 'role', 'co_creator', 'decision_authority', true, 'user_id', ua),
      jsonb_build_object('id', pb, 'name', 'Builder', 'role', 'builder', 'decision_authority', false)))));
  fx := fx || s.id;

  begin perform public.thread_transition_object(a, s.id, s.version, 'capturing', 'open'); ok := false; msg := 'capture opened without consent';
  exception when others then ok := sqlerrm like 'CONSENT_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Capture cannot open without consent from every participant', 'pass', ok, 'detail', msg);

  insert into public.consent_records (id, session_id, participant_id, modalities, granted_at)
  values (public.uuid_v7(), s.id, pa, '{text}', now()), (public.uuid_v7(), s.id, pb, '{text}', now());
  s := public.thread_transition_object(a, s.id, s.version, 'capturing', 'consent recorded');
  res := res || jsonb_build_object('name', 'Capture opens once consent exists', 'pass', s.lifecycle_state = 'capturing', 'detail', s.lifecycle_state);

  begin perform public.thread_create_object(a, public._fx_payload('CoCreationArtifact', 'whiteboard', jsonb_build_object('session_ref', s.id, 'kind', 'whiteboard')));
    ok := false; msg := 'whiteboard captured without visual consent';
  exception when others then ok := sqlerrm like 'CONSENT_REQUIRED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'An artifact needs consent for its modality', 'pass', ok, 'detail', msg);

  art := public.thread_create_object(a, public._fx_payload('CoCreationArtifact', 'chat', jsonb_build_object('session_ref', s.id, 'kind', 'chat', 'extraction_state', 'extracted')));
  fx := fx || art.id;
  spans := jsonb_build_array(jsonb_build_object('artifact_id', art.id, 'kind', 'char_range', 'start', 0, 'end', 10, 'speaker_id', pa));

  begin perform public.thread_create_object(a, public._fx_payload('NeedStatement', 'need', jsonb_build_object('origin_session_ref', s.id, 'provenance_spans', '[]'::jsonb)));
    ok := false; msg := 'object without spans stored';
  exception when others then ok := sqlerrm like '%objects_extracted_provenance_spans%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'An extracted object with no provenance span is rejected', 'pass', ok, 'detail', msg);

  begin perform public.thread_create_object(a, public._fx_payload('ExtractedStatement', 'offhand rule', jsonb_build_object('origin_session_ref', s.id,
      'provenance_spans', spans, 'classification', 'decision', 'speaker_authority', jsonb_build_object('decision', false))));
    ok := false; msg := 'decision stored for a speaker without authority';
  exception when others then ok := sqlerrm like 'DECISION_WITHOUT_AUTHORITY%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A non-authority speaker cannot produce a decision', 'pass', ok, 'detail', msg);

  xs := public.thread_create_object(a, public._fx_payload('ExtractedStatement', 'context unit', jsonb_build_object('origin_session_ref', s.id,
      'provenance_spans', spans, 'classification', 'context', 'speaker_authority', jsonb_build_object('decision', true), 'material', false)));
  fx := fx || xs.id;
  begin perform public.thread_revise_object(a, xs.id, xs.version, jsonb_build_object('body', xs.body || '{"classification":"decision"}'::jsonb), 'machine promotion');
    ok := false; msg := 'context promoted by a machine';
  exception when others then ok := sqlerrm like 'RAW_SPEECH_PROMOTION_REQUIRES_HUMAN%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Raw speech becomes authority only by human re-classification', 'pass', ok, 'detail', msg);

  xs2 := public.thread_create_object(a, public._fx_payload('ExtractedStatement', 'suggestion unit', jsonb_build_object('origin_session_ref', s.id,
      'provenance_spans', spans, 'classification', 'suggestion', 'speaker_authority', jsonb_build_object('decision', false), 'material', false)));
  fx := fx || xs2.id;
  xs2 := public.thread_revise_object(a, xs2.id, xs2.version, jsonb_build_object('body', xs2.body || jsonb_build_object('confirmation',
      jsonb_build_object('actor_id', pb, 'authority_used', 'observe', 'at', now()))), 'confirm');
  xs2 := public.thread_transition_object(a, xs2.id, xs2.version, 'confirmed', 'confirmed');
  begin perform public.thread_revise_object(a, xs2.id, xs2.version, jsonb_build_object('body', xs2.body || '{"classification":"assumption","extractor":"v2"}'::jsonb), 're-extraction');
    ok := false; msg := 'confirmed object overwritten';
  exception when others then ok := sqlerrm like 'CONFIRMATION_PRESERVED%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Re-extraction cannot overwrite a confirmation', 'pass', ok, 'detail', msg);

  xs3 := public.thread_create_object(a, public._fx_payload('ExtractedStatement', 'decision unit', jsonb_build_object('origin_session_ref', s.id,
      'provenance_spans', spans, 'classification', 'decision', 'speaker_authority', jsonb_build_object('decision', true), 'material', true)));
  fx := fx || xs3.id;
  xs3 := public.thread_revise_object(a, xs3.id, xs3.version, jsonb_build_object('body', xs3.body || jsonb_build_object('confirmation',
      jsonb_build_object('actor_id', pb, 'authority_used', 'act_with_confirmation', 'at', now()))), 'confirm by builder');
  begin perform public.thread_transition_object(a, xs3.id, xs3.version, 'confirmed', 'confirm');
    ok := false; msg := 'material item confirmed without authority';
  exception when others then ok := sqlerrm like 'AUTHORITY_REQUIRED_TO_CONFIRM%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Material items are confirmed only by an authority holder', 'pass', ok, 'detail', msg);

  bs := public.thread_create_object(a, public._fx_payload('BehaviorStatement', 'draft behaviour', jsonb_build_object('origin_session_ref', s.id, 'provenance_spans', spans)));
  fx := fx || bs.id;
  begin
    insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by)
    values (public.uuid_v7(), '{}', 'self-test', '[]', 'create_new_no_match', 'self-test', a) returning id into i;
    insert into public.creation_prompts (object_id, reuse_check_id, source_behavior_ids, template_id, template_version, compiled_text, compiled_hash)
    values (bs.id, i, array[bs.id], public.uuid_v7(), '1', 'x', 'x');
    ok := false; msg := 'draft reached creation';
  exception when others then ok := sqlerrm like 'DRAFT_CANNOT_REACH_CREATION%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A draft object cannot reach creation', 'pass', ok, 'detail', msg);

  xs4 := public.thread_create_object(a, public._fx_payload('ExtractedStatement', 'open material', jsonb_build_object('origin_session_ref', s.id,
      'provenance_spans', spans, 'classification', 'decision', 'speaker_authority', jsonb_build_object('decision', true), 'material', true)));
  fx := fx || xs4.id;
  s := public.thread_revise_object(a, s.id, s.version, jsonb_build_object('body', s.body || '{"entry_test_result":{"completed":false,"sentence":null}}'::jsonb), 'entry test');
  begin perform public.thread_transition_object(a, s.id, s.version, 'closed', 'close');
    ok := false; msg := 'closed with an unrecorded material item';
  exception when others then ok := sqlerrm like 'UNRECORDED_MATERIAL_ITEMS%' or sqlerrm like 'UNRECORDED_OPEN_ITEMS%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'A session cannot close with unrecorded material items', 'pass', ok, 'detail', msg);

  select * into xs4 from public.objects where id = xs4.id;
  xs4 := public.thread_revise_object(a, xs4.id, xs4.version, jsonb_build_object('body', xs4.body || jsonb_build_object('deferral',
      jsonb_build_object('owner', pa, 'due', current_date + 7, 'reason', 'self-test'))), 'explicit deferral');
  select * into xs3 from public.objects where id = xs3.id;
  xs3 := public.thread_revise_object(a, xs3.id, xs3.version, jsonb_build_object('body', xs3.body || jsonb_build_object('deferral',
      jsonb_build_object('owner', pa, 'due', current_date + 7, 'reason', 'self-test'))), 'explicit deferral');
  select * into s from public.objects where id = s.id;
  begin s := public.thread_transition_object(a, s.id, s.version, 'closed', 'close'); ok := s.lifecycle_state = 'closed'; msg := 'closed after explicit deferral';
  exception when others then ok := false; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Explicit deferral is a legitimate way to close', 'pass', ok, 'detail', msg);

  begin insert into public.session_events (session_id, t_offset_ms, kind, payload) values (s.id, 1, 'segment', '{}');
    ok := false; msg := 'event captured after close';
  exception when others then ok := sqlerrm like 'CAPTURE_NOT_OPEN%'; msg := sqlerrm; end;
  res := res || jsonb_build_object('name', 'Nothing is captured after a session closes', 'pass', ok, 'detail', msg);

  select count(*) into n from public.detectors where owner_id is not null and key in ('RawSpeechTreatedAsAuthority','UnextractedDecision','BehaviorWithoutNeed',
    'NeedWithoutBehavior','NeedWithoutMeasure','UnextractedSession','SessionWithoutConsent','ContradictionUnresolved','AssumptionUnverified','ProvenanceSpanMissing',
    'DraftObjectUsedAsBasis','DraftCountedAsProgress','SessionProducingMinutes','DependencyCycle','InferredEdgeAutoConfirmed','FramingSessionAsMeeting');
  res := res || jsonb_build_object('name', 'All 16 framing detectors are registered with an owner', 'pass', n = 16, 'detail', n || ' of 16');

  foreach i in array fx loop
    select version into v from public.objects where id = i and not is_tombstone;
    if v is not null then perform public.thread_tombstone_object(a, i, v, 'Phase 2B self-test fixture'); end if;
  end loop;

  return jsonb_build_object('passed', not exists (select 1 from jsonb_array_elements(res) r where not (r->>'pass')::boolean),
    'checks', res, 'ran_at', now());
end $$;

create or replace function public.thread_framing_sweep(p_actor jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare owner uuid; nn int := 0; nr int := 0;
  keys text[] := array['RawSpeechTreatedAsAuthority','UnextractedDecision','BehaviorWithoutNeed','NeedWithoutBehavior','NeedWithoutMeasure',
    'UnextractedSession','SessionWithoutConsent','ContradictionUnresolved','AssumptionUnverified','ProvenanceSpanMissing','DraftObjectUsedAsBasis',
    'DraftCountedAsProgress','SessionProducingMinutes','InferredEdgeAutoConfirmed','FramingSessionAsMeeting'];
begin
  perform public._assert_actor(p_actor);
  select owner_id into owner from public.detectors where key = 'RawSpeechTreatedAsAuthority';
  create temp table if not exists _fh (key text, object_id uuid, severity text, evidence jsonb) on commit drop;
  truncate _fh;

  insert into _fh select 'RawSpeechTreatedAsAuthority', b.id, 'critical', jsonb_build_object('ref', b.human_ref, 'source', x.human_ref,
      'explanation', 'Built from a ' || coalesce(x.body->>'initial_classification', x.body->>'classification') || ' unit without explicit human re-classification (8A.5).')
    from public.objects b join public.objects x on x.id = (b.body->>'source_statement_id')::uuid
    where not b.is_tombstone and b.type in ('BehaviorStatement','ConfirmedDecision')
      and (x.body->>'classification' in ('context','question')
        or (x.body->>'initial_classification' in ('context','question') and coalesce(x.body->'classification_change'->>'by_kind', '') <> 'human'));

  insert into _fh select 'UnextractedDecision', x.id, 'high', jsonb_build_object('ref', x.human_ref, 'session', s.human_ref,
      'explanation', 'A decision was stated in a closed session and no ConfirmedDecision records it.')
    from public.objects x join public.objects s on s.id = (x.body->>'origin_session_ref')::uuid
    where x.type = 'ExtractedStatement' and not x.is_tombstone and x.body->>'classification' = 'decision' and x.lifecycle_state = 'draft'
      and not (x.body ? 'deferral') and s.lifecycle_state = 'closed' and not s.is_tombstone;

  insert into _fh select 'BehaviorWithoutNeed', b.id, 'medium', jsonb_build_object('ref', b.human_ref, 'explanation', 'Behaviour with no articulated need.')
    from public.objects b where b.type = 'BehaviorStatement' and not b.is_tombstone and (b.body ? 'origin_session_ref')
      and not exists (select 1 from public.edges e where e.retired_at is null and ((e.verb = 'addresses' and e.from_id = b.id) or (e.verb = 'expressed_as' and e.to_id = b.id)));

  insert into _fh select 'NeedWithoutBehavior', nd.id, 'medium', jsonb_build_object('ref', nd.human_ref, 'explanation', 'Need past its elaboration window with no behaviour statement.')
    from public.objects nd where nd.type = 'NeedStatement' and not nd.is_tombstone and nd.lifecycle_state <> 'rejected'
      and nd.created_at < now() - make_interval(days => coalesce((select (params->>'elaboration_window_days')::int from public.detectors where key = 'NeedWithoutBehavior'), 14))
      and not exists (select 1 from public.edges e where e.retired_at is null and ((e.verb = 'expressed_as' and e.from_id = nd.id) or (e.verb = 'addresses' and e.to_id = nd.id)));

  insert into _fh select 'NeedWithoutMeasure', nd.id, 'medium', jsonb_build_object('ref', nd.human_ref, 'explanation', 'Confirmed need with no measurable character, baseline or target; not yet buildable.')
    from public.objects nd where nd.type = 'NeedStatement' and not nd.is_tombstone and nd.lifecycle_state = 'confirmed'
      and (coalesce(nd.body->>'measurable_character', '') = '' or coalesce(nd.body->>'baseline', '') = '' or coalesce(nd.body->>'target', '') = '');

  insert into _fh select 'UnextractedSession', ar.id, 'medium', jsonb_build_object('ref', ar.human_ref, 'explanation', 'Captured but never extracted.')
    from public.objects ar where ar.type = 'CoCreationArtifact' and not ar.is_tombstone and coalesce(ar.body->>'extraction_state', 'pending') = 'pending'
      and ar.created_at < now() - interval '10 minutes';

  insert into _fh select 'SessionWithoutConsent', ar.id, 'critical', jsonb_build_object('ref', ar.human_ref, 'explanation', 'A participant has no active consent for this artifact''s modality.')
    from public.objects ar join public.objects s on s.id = (ar.body->>'session_ref')::uuid
    where ar.type = 'CoCreationArtifact' and not ar.is_tombstone
      and exists (select 1 from jsonb_array_elements(coalesce(s.body->'participants', '[]')) p(v)
        where not exists (select 1 from public.consent_records c where c.session_id = s.id and c.participant_id = (p.v->>'id')::uuid
          and public.artifact_modality(ar.body->>'kind') = any(c.modalities) and c.withdrawn_at is null));

  insert into _fh select 'ContradictionUnresolved', coalesce(f.statement_id, f.session_id), 'high', jsonb_build_object('finding', f.id, 'message', f.message,
      'explanation', 'Contradiction still open past its resolution window.')
    from public.framing_live_findings f where f.kind = 'contradiction'
      and ((f.state = 'open' and f.created_at < now() - make_interval(hours => coalesce((select (params->>'resolution_window_hours')::int from public.detectors where key = 'ContradictionUnresolved'), 48)))
        or (f.state = 'deferred' and (f.resolution->>'due')::date < current_date));

  insert into _fh select 'AssumptionUnverified', asm.id, 'medium', jsonb_build_object('ref', asm.human_ref, 'explanation', 'Relied on by a confirmed behaviour with no verification attempt.')
    from public.objects asm where asm.type = 'Assumption' and not asm.is_tombstone
      and coalesce(jsonb_array_length(case when jsonb_typeof(asm.body->'verification_attempts') = 'array' then asm.body->'verification_attempts' end), 0) = 0
      and exists (select 1 from public.edges e join public.objects b on b.id = e.to_id where e.retired_at is null and e.verb = 'assumes' and e.from_id = asm.id
        and b.lifecycle_state not in ('proposed') and not b.is_tombstone);

  insert into _fh select 'ProvenanceSpanMissing', o.id, 'critical', jsonb_build_object('ref', o.human_ref, 'explanation', 'Extracted object with no source span (bypass).')
    from public.objects o where not o.is_tombstone and ((o.body ? 'origin_session_ref') or o.type in ('ExtractedStatement','NeedStatement','DependencyProposal'))
      and coalesce(jsonb_array_length(case when jsonb_typeof(o.body->'provenance_spans') = 'array' then o.body->'provenance_spans' end), 0) = 0;

  insert into _fh select 'DraftObjectUsedAsBasis', cp.object_id, 'critical', jsonb_build_object('explanation', 'A creation prompt cites a draft source.')
    from public.creation_prompts cp where exists (select 1 from public.objects o where o.id = any(cp.source_behavior_ids) and o.lifecycle_state in ('draft','proposed','rejected'));

  insert into _fh select 'DraftCountedAsProgress', null, 'high', jsonb_build_object('rendition', r.id, 'explanation', 'A live measure counts draft objects (8A.6).')
    from public.renditions r where r.state = 'live' and coalesce(r.body->>'counts_drafts', 'false') = 'true';

  insert into _fh select 'SessionProducingMinutes', s.id, 'medium', jsonb_build_object('ref', s.human_ref, 'explanation', 'The session produced a minutes-like document and no confirmed objects.')
    from public.objects s where s.type = 'FramingSession' and s.lifecycle_state = 'closed' and not s.is_tombstone
      and exists (select 1 from public.objects ar where ar.type = 'CoCreationArtifact' and ar.body->>'session_ref' = s.id::text and (ar.title || ' ' || ar.statement) ~* '(minutes|action items)')
      and not exists (select 1 from public.objects o where o.body->>'origin_session_ref' = s.id::text and o.lifecycle_state in ('confirmed','active','recorded') and not o.is_tombstone);

  insert into _fh select 'InferredEdgeAutoConfirmed', e.from_id, 'high', jsonb_build_object('edge', e.id, 'verb', e.verb, 'explanation', 'An inferred edge was confirmed without a human.')
    from public.edges e where e.retired_at is null and e.source = 'inferred' and coalesce(e.created_by->>'kind', '') <> 'human';

  insert into _fh select 'FramingSessionAsMeeting', s.id, 'medium', jsonb_build_object('ref', s.human_ref, 'explanation', 'Scheduled duration, an agenda and no objects: a meeting, not a framing session.')
    from public.objects s where s.type = 'FramingSession' and s.lifecycle_state = 'closed' and not s.is_tombstone and (s.body ? 'scheduled_duration_min')
      and exists (select 1 from public.objects ar where ar.type = 'CoCreationArtifact' and ar.body->>'session_ref' = s.id::text and (ar.title || ' ' || ar.statement) ~* 'agenda')
      and not exists (select 1 from public.objects o where o.body->>'origin_session_ref' = s.id::text and o.type <> 'CoCreationArtifact' and not o.is_tombstone);

  update public.detector_findings f set state = 'resolved' where f.state = 'open' and f.detector_key = any(keys)
    and not exists (select 1 from _fh h where h.key = f.detector_key and h.object_id is not distinct from f.object_id);
  get diagnostics nr = row_count;
  insert into public.detector_findings (id, detector_key, object_id, severity, owner_id, state, evidence, created_at)
  select public.uuid_v7(), h.key, h.object_id, h.severity, owner, 'open', h.evidence, now() from _fh h
  where not exists (select 1 from public.detector_findings f where f.state = 'open' and f.detector_key = h.key and f.object_id is not distinct from h.object_id);
  get diagnostics nn = row_count;
  return jsonb_build_object('new', nn, 'resolved', nr, 'open', (select count(*) from public.detector_findings where state = 'open' and detector_key = any(keys)));
end $$;

create or replace function public.thread_record_phase2b_evidence(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb; ev jsonb; s bigint; real_s uuid;
begin
  perform public._assert_actor(p_actor);
  st := public.thread_phase2b_selftest();
  select s2.id into real_s from public.objects s2 where s2.type = 'FramingSession' and s2.lifecycle_state = 'closed' and not s2.is_tombstone
    and (s2.body->>'adapter_mode') is distinct from 'simulated'
    and exists (select 1 from jsonb_array_elements(s2.body->'participants') p(v) where p.v->>'role' = 'co_creator' and p.v->>'user_id' is not null)
    and exists (select 1 from jsonb_array_elements(s2.body->'participants') p(v) where p.v->>'role' = 'builder' and p.v->>'user_id' is not null)
    and (select count(distinct p.v->>'user_id') from jsonb_array_elements(s2.body->'participants') p(v) where p.v->>'role' in ('co_creator','builder')) = 2
    and exists (select 1 from public.objects o where o.body->>'origin_session_ref' = s2.id::text and o.lifecycle_state in ('confirmed','active','recorded') and not o.is_tombstone)
  order by s2.updated_at desc limit 1;
  ev := jsonb_build_object(
    'selftest', st,
    'real_session', jsonb_build_object('session_id', real_s, 'met', real_s is not null,
       'confirmed_objects', (select count(*) from public.objects o where o.body->>'origin_session_ref' = real_s::text and o.lifecycle_state in ('confirmed','active','recorded') and not o.is_tombstone),
       'provenance_coverage_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where jsonb_array_length(o.body->'provenance_spans') > 0) / count(*), 1) end
          from public.objects o where o.body->>'origin_session_ref' = real_s::text and o.lifecycle_state in ('confirmed','active','recorded') and not o.is_tombstone)),
    'authority_mismatch_surfaced', exists (select 1 from public.framing_live_findings f join public.objects s3 on s3.id = f.session_id where f.kind = 'authority_mismatch' and not s3.is_tombstone),
    'live_cross_session_contradiction', (select jsonb_build_object('met', count(*) > 0, 'best_latency_ms', min(f.latency_ms)) from public.framing_live_findings f
        where f.kind = 'contradiction' and (f.payload->>'prior_session_ref') is not null and f.payload->>'prior_session_ref' <> f.session_id::text and f.latency_ms <= 5000),
    're_extraction', (select jsonb_build_object('met', count(*) > 0, 'preserved_confirmations', coalesce(sum(preserved_confirmations), 0)) from public.extraction_revisions where revision > 1 and preserved_confirmations > 0),
    'entry_test_reported', exists (select 1 from public.objects s4 where s4.type = 'FramingSession' and s4.lifecycle_state = 'closed' and not s4.is_tombstone and s4.body ? 'entry_test_result'),
    'quality_published', (select jsonb_build_object('met', count(*) > 0, 'rendition_id', max(r.id::text)) from public.renditions r where r.kind = 'extraction_quality' and r.state = 'live'),
    'latency_p95_ms', (select coalesce(jsonb_object_agg(stage, p95), '{}') from (select stage, percentile_cont(0.95) within group (order by latency_ms)::int p95 from public.extraction_timings group by stage) t),
    'client', p);
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), p_actor, 'observe', 'phase2b.exit_evidence', null, null, '{}', 'none', ev, '', 'pending-' || public.uuid_v7()::text)
  returning seq into s;
  return ev || jsonb_build_object('ledger_seq', s);
end $$;

revoke execute on function public.thread_phase2b_selftest() from public, anon, authenticated;
revoke execute on function public.thread_framing_sweep(jsonb) from public, anon, authenticated;
revoke execute on function public.thread_record_phase2b_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_phase2b_selftest() to service_role;
grant execute on function public.thread_framing_sweep(jsonb) to service_role;
grant execute on function public.thread_record_phase2b_evidence(jsonb, jsonb) to service_role;

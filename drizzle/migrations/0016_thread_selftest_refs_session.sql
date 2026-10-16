create or replace function public._selftest_body(_type text, _refs jsonb) returns jsonb language sql stable set search_path = public as $$
  select case
    when _type in ('ExtractedStatement','NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation')
      then '{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}'::jsonb
    when _type = 'CoCreationArtifact' then jsonb_build_object('session_ref', _refs->>'session', 'kind', 'chat')
    when _type = 'HumanDecisionRequest' then jsonb_build_object('exact_decision_required','self-test','reason_ai_cannot_safely_decide','self-test',
      'current_evidence_and_confidence', _refs->>'evidence','ai_recommendation','self-test','viable_alternatives','[{"option":"a","consequences":"none","affected_parties":[]}]'::jsonb,
      'affected_parties','[]'::jsonb,'deadline', now() + interval '1 day','cost_of_waiting','none','reversibility','reversible',
      'current_authority_boundary', _refs->>'evidence','proposed_next_machine_action','none')
    when _type = 'Decision' then jsonb_build_object('request_ref', _refs->>'hdr', 'response', 'decide', 'decision', 'self-test')
    when _type in ('CreationPrompt','BuildRun') then jsonb_build_object('reuse_check_ref', _refs->>'reuse_check')
    else '{}'::jsonb end
$$;
create or replace function public._selftest_refs(_actor jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.objects; h public.objects; s public.objects; rc uuid := public.uuid_v7(); pa uuid := public.uuid_v7(); pb uuid := public.uuid_v7();
begin
  ev := public.thread_create_object(_actor, public._fx_payload('PolicyEvaluation', 'Self-test fixture evidence', '{"deterministic":true}'::jsonb));
  h := public.thread_create_object(_actor, public._fx_payload('HumanDecisionRequest', 'Self-test fixture request', public._selftest_body('HumanDecisionRequest', jsonb_build_object('evidence', ev.id))));
  insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by)
  values (rc, '{"outcome":"self-test","inputs":[],"outputs":[],"domain":"selftest"}', 'self-test', '[]', 'create_new', 'self-test fixture: nothing to reuse', _actor);
  s := public.thread_create_object(_actor, public._fx_payload('FramingSession', 'Self-test fixture session', jsonb_build_object(
    'co_creator', pa, 'builder', pb, 'purpose', 'self-test', 'modalities', '["text"]'::jsonb,
    'participants', jsonb_build_array(jsonb_build_object('id', pa, 'name', 'Co-Creator', 'role', 'co_creator', 'decision_authority', true),
                                      jsonb_build_object('id', pb, 'name', 'Builder', 'role', 'builder', 'decision_authority', false)))));
  insert into public.consent_records (id, session_id, participant_id, modalities, granted_at)
  values (public.uuid_v7(), s.id, pa, '{text}', now()), (public.uuid_v7(), s.id, pb, '{text}', now());
  s := public.thread_transition_object(_actor, s.id, s.version, 'capturing', 'self-test fixture');
  perform public.thread_tombstone_object(_actor, ev.id, ev.version, 'self-test fixture');
  perform public.thread_tombstone_object(_actor, h.id, h.version, 'self-test fixture');
  return jsonb_build_object('evidence', ev.id, 'hdr', h.id, 'reuse_check', rc, 'session', s.id);
end $$;
revoke execute on function public._selftest_refs(jsonb) from public, anon, authenticated;

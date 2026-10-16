create or replace function public._selftest_next_state(_family text, _from text) returns text language sql stable set search_path = public as $$
  -- capturing needs per-session consent, which a generic fixture cannot have; every other later state is fine
  select to_state from public.lifecycle_transitions where lifecycle_family = _family and from_state = _from
  order by (to_state = 'capturing'), to_state limit 1
$$;

create or replace function public._selftest_body(_type text, _refs jsonb) returns jsonb language sql stable set search_path = public as $$
  select case
    when _type = 'ExtractedStatement' then '{"provenance_spans":[{"kind":"char_range","start":0,"end":1}],"classification":"suggestion","material":false,"speaker_authority":{"decision":false}}'::jsonb
    when _type in ('NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation')
      then '{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}'::jsonb
    when _type = 'FramingSession' then '{"entry_test_result":{"completed":false,"sentence":null}}'::jsonb
    when _type = 'CoCreationArtifact' then jsonb_build_object('session_ref', _refs->>'session', 'kind', 'chat')
    when _type = 'HumanDecisionRequest' then jsonb_build_object('exact_decision_required','self-test','reason_ai_cannot_safely_decide','self-test',
      'current_evidence_and_confidence', _refs->>'evidence','ai_recommendation','self-test','viable_alternatives','[{"option":"a","consequences":"none","affected_parties":[]}]'::jsonb,
      'affected_parties','[]'::jsonb,'deadline', now() + interval '1 day','cost_of_waiting','none','reversibility','reversible',
      'current_authority_boundary', _refs->>'evidence','proposed_next_machine_action','none')
    when _type = 'Decision' then jsonb_build_object('request_ref', _refs->>'hdr', 'response', 'decide', 'decision', 'self-test')
    when _type in ('CreationPrompt','BuildRun') then jsonb_build_object('reuse_check_ref', _refs->>'reuse_check')
    else '{}'::jsonb end
$$;

CREATE OR REPLACE FUNCTION public.thread_phase1_selftest()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare st_refs jsonb;
  results jsonb := '[]'; actor jsonb := '{"kind":"system","id":"phase1-selftest","authority_used":"observe"}';
  base jsonb; t record; o public.objects; nxt text; created int := 0; full_cycle int := 0; err text; ok boolean;
  rid uuid; chain jsonb; rest jsonb; sample public.objects;
begin
  begin
    base := jsonb_build_object('statement','Self-test object','machine_description','Phase 1 self-test object; rolled back.',
      'review_date', (current_date + 30)::text, 'expiration_condition', '{"kind":"review_date_passes"}'::jsonb,
      'retirement_path', '{"mode":"tombstone"}'::jsonb, 'risk_tier','1', 'permission','{"roles":[],"purpose":"selftest"}'::jsonb,
      'data_classification','internal', 'owner_id','00000000-0000-0000-0000-000000000000');

    st_refs := public._selftest_refs(actor);
    for t in select r.type, r.lifecycle_family from public.object_type_registry r order by r.type loop
      begin
        o := public.thread_create_object(actor, base || jsonb_build_object('type', t.type, 'title', 'Self-test ' || t.type, 'body', public._selftest_body(t.type, st_refs)));
        created := created + 1;
        o := public.thread_revise_object(actor, o.id, 1, '{"statement":"Revised by self-test"}', 'self-test revision');
        nxt := public._selftest_next_state(t.lifecycle_family, o.lifecycle_state);
        o := public.thread_transition_object(actor, o.id, 2, nxt, 'self-test transition');
        o := public.thread_tombstone_object(actor, o.id, 3, 'self-test tombstone');
        if o.version = 4 and o.is_tombstone
           and (select count(*) from public.object_versions where id = o.id) = 4
           and (select count(*) from public.ledger where object_id = o.id) = 4 then full_cycle := full_cycle + 1; end if;
      exception when others then
        results := results || jsonb_build_object('check','type_lifecycle:' || t.type,'ok', false, 'detail', sqlerrm);
      end;
    end loop;
    results := results || jsonb_build_object('check','every_type_full_lifecycle','ok', created = full_cycle and created > 0,
      'detail', format('%s of %s types created, versioned x4, tombstoned and audited', full_cycle, created));

    sample := public.thread_create_object(actor, base || '{"type":"Concept","title":"Probe"}');

    begin
      insert into public.objects (id, human_ref, type, schema_version, title, statement, machine_description, created_by, updated_by, lifecycle_state,
        review_date, expiration_condition, retirement_path, owner_id, risk_tier, permission, data_classification, content_hash, provenance_chain_id)
      values (public.uuid_v7(), 'CN-GAP-0001', 'Concept', '1.0.0', 'gap', 'gap', 'gap', actor, actor, 'draft', current_date + 1, '{}', '{}',
        '00000000-0000-0000-0000-000000000000', '1', '{}', 'internal', 'x', public.uuid_v7());
      ok := false; err := 'insert succeeded';
    exception when others then ok := sqlerrm like 'PROVENANCE_REQUIRED%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','provenance_gap_insert_rejected','ok', ok, 'detail', err);

    begin
      update public.objects set title = 'silent drift', version = version + 1 where id = sample.id;
      ok := false; err := 'update succeeded';
    exception when others then ok := sqlerrm like 'PROVENANCE_REQUIRED%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','provenance_gap_update_rejected','ok', ok, 'detail', err);

    begin
      insert into public.ledger (provenance_chain_id, actor, action, object_id, object_version, payload, prev_hash, hash)
        values (sample.provenance_chain_id, actor, 'forged', sample.id, 2, '{"content_hash":"forged"}', '', 'forged-' || public.uuid_v7());
      update public.objects set title = 'forged', version = 2 where id = sample.id;
      ok := false; err := 'forged write succeeded';
    exception when others then ok := sqlerrm like 'PROVENANCE_REQUIRED%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','forged_ledger_hash_rejected','ok', ok, 'detail', err);

    begin update public.ledger set action = 'tampered' where seq = (select max(seq) from public.ledger); ok := false; err := 'update succeeded';
    exception when others then ok := sqlerrm like 'APPEND_ONLY%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','ledger_update_rejected','ok', ok, 'detail', err);
    begin delete from public.ledger where seq = (select max(seq) from public.ledger); ok := false; err := 'delete succeeded';
    exception when others then ok := sqlerrm like 'APPEND_ONLY%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','ledger_delete_rejected','ok', ok, 'detail', err);

    begin update public.object_versions set title = 'rewrite history' where id = sample.id; ok := false; err := 'update succeeded';
    exception when others then ok := sqlerrm like 'APPEND_ONLY%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','version_snapshot_immutable','ok', ok, 'detail', err);

    begin delete from public.objects where id = sample.id; ok := false; err := 'delete succeeded';
    exception when others then ok := sqlerrm like 'TOMBSTONES_NOT_DELETIONS%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','object_delete_rejected','ok', ok, 'detail', err);

    begin perform public.thread_transition_object(actor, sample.id, 1, 'awaiting_approval', 'self-test'); ok := false; err := 'transition succeeded';
    exception when others then ok := sqlerrm like 'ILLEGAL_TRANSITION%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','illegal_transition_rejected','ok', ok, 'detail', err);

    begin insert into public.lifecycle_transitions values ('canon','draft','pending_sign_off'); ok := false; err := 'insert succeeded';
    exception when check_violation then ok := true; err := sqlerrm; end;
    results := results || jsonb_build_object('check','approval_state_unregisterable','ok', ok, 'detail', err);

    begin insert into public.object_type_registry values ('HandoffDocument','Canon','HX','canon','{}','{}','1.0.0'); ok := false; err := 'insert succeeded';
    exception when check_violation then ok := true; err := sqlerrm; end;
    results := results || jsonb_build_object('check','document_type_unregisterable','ok', ok, 'detail', err);

    begin perform public.thread_create_object(actor, (base - 'review_date') || '{"type":"Concept","title":"No review date"}'); ok := false; err := 'insert succeeded';
    exception when not_null_violation then ok := true; err := sqlerrm; end;
    results := results || jsonb_build_object('check','review_date_required','ok', ok, 'detail', err);
    begin perform public.thread_create_object(actor, (base - 'expiration_condition') || '{"type":"Concept","title":"No expiry"}'); ok := false; err := 'insert succeeded';
    exception when not_null_violation then ok := true; err := sqlerrm; end;
    results := results || jsonb_build_object('check','expiration_condition_required','ok', ok, 'detail', err);
    begin perform public.thread_create_object(actor, (base - 'retirement_path') || '{"type":"Concept","title":"No retirement"}'); ok := false; err := 'insert succeeded';
    exception when not_null_violation then ok := true; err := sqlerrm; end;
    results := results || jsonb_build_object('check','retirement_path_required','ok', ok, 'detail', err);

    rid := public.uuid_v7();
    insert into public.renditions (id, kind, generated_from, citations, generator, permission_context, expires_at)
      values (rid, 'explanation', jsonb_build_array(jsonb_build_object('id', sample.id, 'version', 1, 'content_hash', sample.content_hash)),
              jsonb_build_array(sample.id), '{"model":"none"}', '{"actor":"selftest","purpose":"selftest"}', now() + interval '1 day');
    begin perform public.thread_create_object(actor, base || jsonb_build_object('type','Concept','title','From rendition','derived_from', jsonb_build_array(rid)));
      ok := false; err := 'insert succeeded';
    exception when others then ok := sqlerrm like 'CANON_SUPREMACY%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','canon_not_derived_from_rendition','ok', ok, 'detail', err);

    sample := public.thread_revise_object(actor, sample.id, 1, '{"risk_tier":"3"}', 'raise tier');
    begin perform public.thread_revise_object(actor, sample.id, 2, '{"risk_tier":"1"}', 'lower tier'); ok := false; err := 'downgrade succeeded';
    exception when others then ok := sqlerrm like 'RISK_TIER_DOWNWARD%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','risk_tier_no_downward_override','ok', ok, 'detail', err);

    begin perform public.thread_create_object(actor, base || '{"type":"Concept","title":"Prohibited","data_classification":"prohibited"}'); ok := false; err := 'insert succeeded';
    exception when others then ok := sqlerrm like 'BLOCKED_PROHIBITED%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','prohibited_class_blocked','ok', ok, 'detail', err);

    begin perform public.thread_revise_object(actor, sample.id, 1, '{"title":"stale"}', 'stale write'); ok := false; err := 'stale write succeeded';
    exception when others then ok := sqlerrm like 'VERSION_CONFLICT%'; err := sqlerrm; end;
    results := results || jsonb_build_object('check','stale_version_rejected','ok', ok, 'detail', err);

    chain := public.thread_verify_ledger();
    results := results || jsonb_build_object('check','ledger_hash_chain_verifies','ok', (chain->>'ok')::boolean, 'detail', chain);
    rest := public.thread_restore_rehearsal();
    results := results || jsonb_build_object('check','restore_rehearsal','ok', (rest->>'ok')::boolean, 'detail', rest);

    raise exception using errcode = 'TT001', message = 'SELFTEST_ROLLBACK';
  exception when sqlstate 'TT001' then null;
  end;
  return jsonb_build_object('phase','1','ran_at', now(), 'all_ok', not exists (select 1 from jsonb_array_elements(results) x where not (x->>'ok')::boolean),
    'checks', results);
end $function$;

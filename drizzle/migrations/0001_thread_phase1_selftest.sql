create or replace function public.thread_phase1_selftest() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  results jsonb := '[]'; actor jsonb := '{"kind":"system","id":"phase1-selftest","authority_used":"observe"}';
  base jsonb; t record; o public.objects; nxt text; created int := 0; full_cycle int := 0; err text; ok boolean;
  rid uuid; chain jsonb; rest jsonb; sample public.objects;
begin
  begin
    base := jsonb_build_object('statement','Self-test object','machine_description','Phase 1 self-test object; rolled back.',
      'review_date', (current_date + 30)::text, 'expiration_condition', '{"kind":"review_date_passes"}'::jsonb,
      'retirement_path', '{"mode":"tombstone"}'::jsonb, 'risk_tier','1', 'permission','{"roles":[],"purpose":"selftest"}'::jsonb,
      'data_classification','internal', 'owner_id','00000000-0000-0000-0000-000000000000');

    for t in select r.type, r.lifecycle_family from public.object_type_registry r order by r.type loop
      o := public.thread_create_object(actor, base || jsonb_build_object('type', t.type, 'title', 'Self-test ' || t.type));
      created := created + 1;
      o := public.thread_revise_object(actor, o.id, 1, '{"statement":"Revised by self-test"}', 'self-test revision');
      select to_state into nxt from public.lifecycle_transitions where lifecycle_family = t.lifecycle_family and from_state = o.lifecycle_state limit 1;
      o := public.thread_transition_object(actor, o.id, 2, nxt, 'self-test transition');
      o := public.thread_tombstone_object(actor, o.id, 3, 'self-test tombstone');
      if o.version = 4 and o.is_tombstone
         and (select count(*) from public.object_versions where id = o.id) = 4
         and (select count(*) from public.ledger where object_id = o.id) = 4 then full_cycle := full_cycle + 1; end if;
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
end $$;

create or replace function public.thread_record_phase1_evidence(p_actor jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform public._assert_actor(p_actor);
  r := public.thread_phase1_selftest();
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, payload, adapter_mode, prev_hash, hash)
    values ('00000000-0000-0000-0000-0000000000e1', p_actor, 'observe', 'phase1.exit_evidence', r, 'none', '', 'pending-' || public.uuid_v7());
  return r;
end $$;
revoke execute on function public.thread_phase1_selftest() from public, anon, authenticated;
revoke execute on function public.thread_record_phase1_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.thread_phase1_selftest() to service_role;
grant execute on function public.thread_record_phase1_evidence(jsonb) to service_role;
create or replace function public._selftest_body(_type text, _refs jsonb) returns jsonb language sql stable set search_path = public as $$
  select case
    when _type in ('ExtractedStatement','NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation')
      then '{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}'::jsonb
    when _type = 'HumanDecisionRequest' then jsonb_build_object('exact_decision_required','self-test','reason_ai_cannot_safely_decide','self-test',
      'current_evidence_and_confidence', _refs->>'evidence','ai_recommendation','self-test','viable_alternatives','[{"option":"a","consequences":"none","affected_parties":[]}]'::jsonb,
      'affected_parties','[]'::jsonb,'deadline', now() + interval '1 day','cost_of_waiting','none','reversibility','reversible',
      'current_authority_boundary', _refs->>'evidence','proposed_next_machine_action','none')
    when _type = 'Decision' then jsonb_build_object('request_ref', _refs->>'hdr', 'response', 'decide', 'decision', 'self-test')
    when _type in ('CreationPrompt','BuildRun') then jsonb_build_object('reuse_check_ref', _refs->>'reuse_check')
    else '{}'::jsonb end
$$;
create or replace function public._selftest_refs(_actor jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare ev public.objects; h public.objects; rc uuid := public.uuid_v7();
begin
  ev := public.thread_create_object(_actor, public._fx_payload('PolicyEvaluation', 'Self-test fixture evidence', '{"deterministic":true}'::jsonb));
  h := public.thread_create_object(_actor, public._fx_payload('HumanDecisionRequest', 'Self-test fixture request', public._selftest_body('HumanDecisionRequest', jsonb_build_object('evidence', ev.id))));
  insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by)
  values (rc, '{"outcome":"self-test","inputs":[],"outputs":[],"domain":"selftest"}', 'self-test', '[]', 'create_new', 'self-test fixture: nothing to reuse', _actor);
  perform public.thread_tombstone_object(_actor, ev.id, ev.version, 'self-test fixture');
  perform public.thread_tombstone_object(_actor, h.id, h.version, 'self-test fixture');
  return jsonb_build_object('evidence', ev.id, 'hdr', h.id, 'reuse_check', rc);
end $$;
revoke execute on function public._selftest_refs(jsonb) from public, anon, authenticated;

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
      o := public.thread_create_object(actor, base || jsonb_build_object('type', t.type, 'title', 'Self-test ' || t.type, 'body', public._selftest_body(t.type, st_refs)));
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
end $function$;

CREATE OR REPLACE FUNCTION public.thread_phase2_selftest()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor jsonb := '{"kind":"system","id":"phase2-selftest","authority_used":"observe"}';
  base jsonb; results jsonb := '[]'; t record; o public.objects; canon_ids uuid[] := '{}'; fixture uuid[] := '{}'; edge_ids uuid[] := '{}';
  n1 public.objects; n2 public.objects; n3 public.objects; ev public.objects; bs public.objects; e public.edges;
  err text; ok boolean; j jsonb; ch public.canon_changes; nchal int; dec jsonb; t0 timestamptz; ms numeric; cnt int; i int; x uuid; ver int;
begin
  base := jsonb_build_object('statement', 'Phase 2 self-test fixture', 'machine_description', 'Phase 2 self-test fixture; tombstoned at the end of the run.',
    'review_date', (current_date + 30)::text, 'expiration_condition', '{"kind":"review_date_passes"}'::jsonb,
    'retirement_path', '{"mode":"tombstone"}'::jsonb, 'risk_tier', '1', 'permission', '{"roles":[],"purpose":"selftest"}'::jsonb,
    'data_classification', 'internal', 'owner_id', '00000000-0000-0000-0000-000000000000', 'rationale', 'Phase 2 self-test');

  for t in select r.type from public.object_type_registry r where r.family = 'Canon' order by r.type loop
    o := public.thread_create_object(actor, base || jsonb_build_object('type', t.type, 'title', 'P2 self-test ' || t.type, 'body', public._selftest_body(t.type, '{}')));
    o := public.thread_transition_object(actor, o.id, 1, 'active', 'self-test activation');
    canon_ids := canon_ids || o.id;
  end loop;
  fixture := fixture || canon_ids;
  select count(*) into cnt from public.objects where id = any(canon_ids) and lifecycle_state = 'active';
  results := results || jsonb_build_object('check', 'canon_family_live', 'ok', cnt = cardinality(canon_ids) and cnt = (select count(*) from public.object_type_registry where family = 'Canon'),
    'detail', format('%s of %s Canon-family types created and active', cnt, (select count(*) from public.object_type_registry where family = 'Canon')));

  ev := public.thread_create_object(actor, base || '{"type":"TestRun","title":"P2 self-test evidence"}');
  n1 := public.thread_create_object(actor, base || '{"type":"NeedStatement","title":"P2 need A","body":{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}}');
  n2 := public.thread_create_object(actor, base || '{"type":"NeedStatement","title":"P2 need B","body":{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}}');
  n3 := public.thread_create_object(actor, base || '{"type":"NeedStatement","title":"P2 need C","body":{"provenance_spans":[{"kind":"char_range","start":0,"end":1}]}}');
  bs := public.thread_create_object(actor, base || '{"type":"BehaviorStatement","title":"P2 behaviour"}');
  fixture := fixture || array[ev.id, n1.id, n2.id, n3.id, bs.id];

  for i in 1 .. cardinality(canon_ids) - 1 loop
    e := public.thread_create_edge(actor, jsonb_build_object('verb', 'cites', 'from_id', canon_ids[i], 'to_id', canon_ids[i + 1], 'rationale', 'self-test chain'));
    edge_ids := edge_ids || e.id;
  end loop;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'cites', 'from_id', canon_ids[1], 'to_id', ev.id, 'rationale', 'self-test evidence')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'kind', 'sequence', 'from_id', n1.id, 'to_id', n2.id, 'rationale', 'self-test')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'kind', 'data', 'from_id', n2.id, 'to_id', n3.id, 'rationale', 'self-test')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'kind', 'decision', 'from_id', n3.id, 'to_id', n1.id, 'rationale', 'deliberate cycle')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'relates_to', 'source', 'inferred', 'confidence', 0.6, 'from_id', n1.id, 'to_id', canon_ids[1], 'rationale', 'self-test link')); edge_ids := edge_ids || e.id;
  e := public.thread_create_edge(actor, jsonb_build_object('verb', 'addresses', 'from_id', bs.id, 'to_id', n1.id, 'rationale', 'self-test')); edge_ids := edge_ids || e.id;
  results := results || jsonb_build_object('check', 'typed_edges_recorded', 'ok',
    (select count(*) from public.ledger l where l.action = 'edge.create' and (l.payload->>'edge_id')::uuid = any(edge_ids)) = cardinality(edge_ids),
    'detail', format('%s typed edges, each with its own ledger entry', cardinality(edge_ids)));

  select count(*) into cnt from unnest(fixture) f(id) where not exists (select 1 from public.edges e2 where e2.retired_at is null and (e2.from_id = f.id or e2.to_id = f.id));
  results := results || jsonb_build_object('check', 'every_object_reachable', 'ok', cnt = 0,
    'detail', format('%s orphan(s) among %s fixture objects', cnt, cardinality(fixture)));

  t0 := clock_timestamp(); j := public.graph_cycles(null); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  ok := exists (select 1 from jsonb_array_elements(j) c where c->'path' ? n1.id::text and c->'path' ? n2.id::text and c->'path' ? n3.id::text);
  results := results || jsonb_build_object('check', 'cycle_surfaced', 'ok', ok, 'detail', format('depends_on cycle A->B->C->A detected in %s ms', round(ms, 1)));

  begin
    insert into public.edges (id, verb, from_id, to_id, source, authority_used, created_by) values (public.uuid_v7(), 'cites', n1.id, n2.id, 'stated', 'observe', actor);
    ok := false; err := 'inserted';
  exception when others then err := sqlerrm; ok := err like 'PROVENANCE_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'edge_without_ledger_rejected', 'ok', ok, 'detail', err);
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'expresses', 'from_id', canon_ids[1], 'to_id', canon_ids[2], 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'VERB_SIGNATURE%'; end;
  results := results || jsonb_build_object('check', 'verb_signature_enforced', 'ok', ok, 'detail', err);
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'affected_by_change', 'from_id', n1.id, 'to_id', n2.id, 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'COMPUTED_VERB%'; end;
  results := results || jsonb_build_object('check', 'computed_verb_never_stored', 'ok', ok, 'detail', err);
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'depends_on', 'from_id', n2.id, 'to_id', n1.id, 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'DEPENDENCY_KIND_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'dependency_kind_required', 'ok', ok, 'detail', err);
  begin
    delete from public.edges where id = edge_ids[1];
    ok := false; err := 'deleted';
  exception when others then err := sqlerrm; ok := err like 'TOMBSTONES_NOT_DELETIONS%'; end;
  results := results || jsonb_build_object('check', 'edges_never_deleted', 'ok', ok, 'detail', err);
  begin
    update public.edges set verb = 'relates_to' where id = edge_ids[1];
    ok := false; err := 'updated';
  exception when others then err := sqlerrm; ok := err like 'EDGE_IMMUTABLE%'; end;
  results := results || jsonb_build_object('check', 'edges_immutable', 'ok', ok, 'detail', err);

  t0 := clock_timestamp(); j := public.graph_neighbourhood(canon_ids[1], 3, 500, null); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  results := results || jsonb_build_object('check', 'traversal', 'ok', jsonb_array_length(j->'nodes') >= 4,
    'detail', format('%s nodes within 3 hops in %s ms (budget 250 ms)', jsonb_array_length(j->'nodes'), round(ms, 1)));
  t0 := clock_timestamp(); j := public.graph_paths(n3.id, canon_ids[3], 6, 10); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  results := results || jsonb_build_object('check', 'pathfinding', 'ok', jsonb_array_length(j->'paths') >= 1,
    'detail', format('%s path(s), shortest %s hops, in %s ms (budget 1 s)', jsonb_array_length(j->'paths'), j->>'shortest', round(ms, 1)));
  t0 := clock_timestamp(); j := public.graph_closure(canon_ids[cardinality(canon_ids)], 6); ms := extract(epoch from clock_timestamp() - t0) * 1000;
  results := results || jsonb_build_object('check', 'blast_radius', 'ok', (j->>'count')::int >= 6,
    'detail', format('%s objects affected within 6 hops in %s ms (budget 800 ms)', j->>'count', round(ms, 1)));

  select * into o from public.objects ob where ob.id = canon_ids[1];
  ver := o.version;
  begin
    perform public.thread_revise_object(actor, o.id, ver, '{"statement":"silent edit"}', 'silent edit attempt');
    ok := false; err := 'revised';
  exception when others then err := sqlerrm; ok := err like 'CANON_CHANGE_PATH_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'silent_canon_edit_rejected', 'ok', ok, 'detail', err);
  begin
    perform public.thread_propose_canon_change(actor, jsonb_build_object('object_id', o.id, 'base_version', ver, 'patch', '{"statement":"x"}'::jsonb, 'rationale', 'x', 'evidence_refs', '[]'::jsonb));
    ok := false; err := 'proposed';
  exception when others then err := sqlerrm; ok := err like 'EVIDENCE_REQUIRED%'; end;
  results := results || jsonb_build_object('check', 'change_without_evidence_rejected', 'ok', ok, 'detail', err);
  ch := public.thread_propose_canon_change(actor, jsonb_build_object('object_id', o.id, 'base_version', ver,
    'patch', '{"statement":"Phase 2 self-test fixture, revised through the canon change path"}'::jsonb,
    'rationale', 'Self-test of the P15 path', 'evidence_refs', jsonb_build_array(ev.id), 'challenge_hours', 24));
  select count(*) into nchal from public.canon_challenges where change_id = ch.id and origin = 'challenge_agent';
  results := results || jsonb_build_object('check', 'challenge_agent_counter_arguments', 'ok', nchal >= 1,
    'detail', format('%s counter-argument(s) generated for the proposal', nchal));
  begin
    perform public.thread_decide_canon_change(actor, ch.id, 'accept', 'too early');
    ok := false; err := 'decided';
  exception when others then err := sqlerrm; ok := err like 'CHALLENGE_WINDOW_OPEN%'; end;
  results := results || jsonb_build_object('check', 'decision_waits_for_challenge_window', 'ok', ok, 'detail', err);
  perform public._canon_ledger(o, actor, 'selftest.challenge_window_backdated', jsonb_build_object('change_id', ch.id, 'note', 'self-test only: window closed to exercise the decision step'));
  update public.canon_changes set challenge_closes_at = now() - interval '1 second' where id = ch.id;
  dec := public.thread_decide_canon_change(actor, ch.id, 'accept', 'Self-test decision under system authority');
  ok := (select ob.version from public.objects ob where ob.id = o.id) = ver + 1
    and exists (select 1 from public.object_versions v where v.id = o.id and v.version = ver and v.statement = o.statement)
    and exists (select 1 from public.objects d where d.id = (dec->>'decision_object_id')::uuid and d.type = 'ConfirmedDecision')
    and exists (select 1 from public.edges e3 where e3.verb = 'cites' and e3.from_id = (dec->>'decision_object_id')::uuid and e3.to_id = o.id);
  results := results || jsonb_build_object('check', 'canon_change_versioned_and_evidenced', 'ok', ok,
    'detail', format('new version v%s, old v%s preserved, decision %s recorded and linked', ver + 1, ver, dec->>'decision_ref'));
  fixture := fixture || (dec->>'decision_object_id')::uuid;
  j := public.canon_drift_report();
  ok := not exists (select 1 from jsonb_array_elements(j->'silent_changes') s where (s->>'id')::uuid = any(fixture));
  results := results || jsonb_build_object('check', 'no_silent_drift', 'ok', ok,
    'detail', format('drift rate %s; %s silent change(s) overall', j->>'drift_rate', jsonb_array_length(j->'silent_changes')));

  for x in select e4.id from public.edges e4 where e4.retired_at is null and (e4.from_id = any(fixture) or e4.to_id = any(fixture)) loop
    perform public.thread_retire_edge(actor, x, 'self-test cleanup');
  end loop;
  for x in select unnest(fixture) loop
    select ob.version into ver from public.objects ob where ob.id = x;
    perform public.thread_tombstone_object(actor, x, ver, 'Phase 2 self-test cleanup');
  end loop;
  begin
    perform public.thread_create_edge(actor, jsonb_build_object('verb', 'cites', 'from_id', n1.id, 'to_id', n2.id, 'rationale', 'x'));
    ok := false; err := 'created';
  exception when others then err := sqlerrm; ok := err like 'TOMBSTONED%'; end;
  results := results || jsonb_build_object('check', 'no_edges_to_tombstones', 'ok', ok, 'detail', err);

  return jsonb_build_object('ok', not exists (select 1 from jsonb_array_elements(results) r where not (r->>'ok')::boolean),
    'checks', results, 'ran_at', now());
end $function$;

CREATE OR REPLACE FUNCTION public.thread_phase2b_selftest()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    insert into public.reuse_checks (id, intent_shape, query_text, results, decision, rationale, checked_by, behavior_statement_id)
    values (public.uuid_v7(), '{"outcome":"x","inputs":[],"outputs":[],"domain":"selftest"}', 'self-test', '[]', 'create_new', 'self-test', a, bs.id) returning id into i;
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
end $function$;

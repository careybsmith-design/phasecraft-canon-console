
create or replace function public.thread_rendition_sweep(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_exp int; n_del int;
begin
  update public.renditions set delete_after = coalesce(stale_at, p_now) + interval '24 hours' where state = 'stale' and delete_after is null;
  with s as (update public.renditions set state = 'stale', stale_at = p_now, stale_reason = 'expired', delete_after = p_now + interval '24 hours'
    where state = 'live' and expires_at < p_now returning id)
  select count(*) into n_exp from s;
  with d as (update public.renditions set state = 'deleted', body = null, storage_path = null, deleted_at = p_now
    where state = 'stale' and delete_after <= p_now returning id)
  select count(*) into n_del from d;
  update public.rendition_regen_queue q set done_at = p_now where done_at is null
    and exists (select 1 from public.renditions r where r.id = q.rendition_id and r.state = 'deleted');
  if n_exp + n_del > 0 then
    perform public._rendition_ledger('{"kind":"system","id":"thread.rendition_sweep","authority_used":"act_bounded"}', 'rendition.sweep', 'none',
      jsonb_build_object('expired', n_exp, 'deleted', n_del));
  end if;
  return jsonb_build_object('expired', n_exp, 'deleted', n_del);
end $$;

create or replace function public.thread_phase8_selftest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a jsonb := '{"kind":"system","id":"thread.selftest.phase8","authority_used":"observe"}';
  u1 uuid := (select ur.user_id from public.user_roles ur where ur.role = 'steward' order by ur.user_id limit 1);
  u2 uuid := gen_random_uuid();
  h1 jsonb; h2 jsonb; res jsonb := '[]'; ok boolean; msg text; tag text := substr(md5(random()::text), 1, 6);
  c1 public.objects; c2 public.objects; rx public.objects; r jsonb; rid uuid; rn public.renditions; gen jsonb; q int; phrase text;
begin
  h1 := jsonb_build_object('kind','human','id',u1::text,'authority_used','observe');
  h2 := jsonb_build_object('kind','human','id',u2::text,'authority_used','observe');
  gen := '{"agent":"thread.selftest","model":"rule-based","route":"route.generate.selftest","template_version":"st1","adapter_mode":"none"}';
  begin
    c1 := public.thread_create_object(a, public._fx_payload('Concept', 'Generation source ' || tag, '{"definition":"a test term"}'));
    c2 := public.thread_create_object(a, public._fx_payload('Concept', 'Generation second source ' || tag, '{"definition":"another term"}'));
    rx := public.thread_create_object(a, public._fx_payload('Concept', 'Restricted source ' || tag, '{"definition":"restricted"}') || '{"data_classification":"restricted"}');

    begin perform public.thread_generate_rendition(h1, jsonb_build_object('kind','technical_explanation','purpose','st','sources',jsonb_build_array(c1.id),'citations','[]','generator',gen,'body','{}'));
      ok := false; msg := 'generated';
    exception when others then ok := sqlerrm like 'CITATIONS_REQUIRED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','Generated guidance without canon citations is refused (AW-8)','pass',ok,'detail',msg);

    begin perform public.thread_generate_rendition(h1, jsonb_build_object('kind','technical_explanation','purpose','st','sources',jsonb_build_array(c1.id),'citations',jsonb_build_array(c2.id),'generator',gen,'body','{}'));
      ok := false; msg := 'generated';
    exception when others then ok := sqlerrm like 'CITATION_NOT_A_SOURCE%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A citation that is not a source is refused','pass',ok,'detail',msg);

    begin perform public.thread_generate_rendition(h1, jsonb_build_object('kind','status_report','purpose','st','sources',jsonb_build_array(c1.id),'citations',jsonb_build_array(c1.id),'generator',gen,'body','{}'));
      ok := false; msg := 'generated';
    exception when others then ok := sqlerrm like 'UNKNOWN_RENDITION_KIND%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','An unregistered kind (e.g. status_report) is refused','pass',ok,'detail',msg);

    ok := true; msg := '';
    foreach phrase in array array['Show prompt count per builder','Leaderboard of builders','Rank individual employees by output','Hours connected for each person','Activity by person this week'] loop
      r := public.thread_generate_rendition(h1, jsonb_build_object('kind','executive_narrative','purpose','st','request_text',phrase,'sources',jsonb_build_array(c1.id),'citations',jsonb_build_array(c1.id),'generator',gen,'body','{}'));
      ok := ok and (r->>'refused')::boolean; msg := msg || phrase || ' -> ' || coalesce(r->>'rule','GENERATED') || '; ';
    end loop;
    res := res || jsonb_build_object('name','A rendition requesting individual activity metrics is refused at generation (14.3)','pass',ok,'detail',msg);

    r := public.thread_generate_rendition(h1, jsonb_build_object('kind','executive_narrative','purpose','st','sources',jsonb_build_array(c1.id),'citations',jsonb_build_array(c1.id),'generator',gen,
      'body', jsonb_build_object('sections', jsonb_build_array(jsonb_build_object('heading','x','text','Here is the leaderboard of builders')))));
    res := res || jsonb_build_object('name','Generated output containing a prohibited inference is refused, not filtered','pass',(r->>'refused')::boolean,'detail',r->>'reason');

    begin perform public.thread_generate_rendition(h1, jsonb_build_object('kind','technical_explanation','purpose','st','sources',jsonb_build_array(rx.id),'citations',jsonb_build_array(rx.id),
      'generator', gen || '{"adapter_mode":"live"}','body','{}'));
      ok := false; msg := 'generated';
    exception when others then ok := sqlerrm like 'TIER_ROUTE_REFUSED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','Restricted sources never go to a live model route','pass',ok,'detail',msg);

    begin perform public.thread_generate_rendition(h2, jsonb_build_object('kind','technical_explanation','purpose','st','sources',jsonb_build_array(rx.id),'citations',jsonb_build_array(rx.id),'generator',gen,'body','{}'));
      ok := false; msg := 'generated';
    exception when others then ok := sqlerrm like 'RENDITION_SOURCE_NOT_PERMITTED%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A rendition cannot be generated from sources outside the identity''s permissions','pass',ok,'detail',msg);

    begin perform public.thread_generate_rendition(h2, jsonb_build_object('for_user',u1,'kind','technical_explanation','purpose','st','sources',jsonb_build_array(c1.id),'citations',jsonb_build_array(c1.id),'generator',gen,'body','{}'));
      ok := false; msg := 'generated';
    exception when others then ok := sqlerrm like 'RENDITION_CONTEXT_MISMATCH%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A person cannot generate a rendition for someone else','pass',ok,'detail',msg);

    r := public.thread_generate_rendition(h1, jsonb_build_object('kind','capability_explanation','purpose','explain to me','context','selftest','sources',jsonb_build_array(c1.id, c2.id),
      'citations',jsonb_build_array(c1.id, c2.id),'generator',gen,'body',jsonb_build_object('sections', jsonb_build_array(jsonb_build_object('heading','What it is','text','A test term','cites',jsonb_build_array(c1.id))))));
    rid := (r->>'rendition_id')::uuid;
    select * into rn from public.renditions where id = rid;
    res := res || jsonb_build_object('name','A rendition is stamped with sources (id, version, content hash), generator, time and the marker','pass',
      rn.state = 'live' and jsonb_array_length(rn.generated_from) = 2 and rn.generated_from @> jsonb_build_array(jsonb_build_object('id',c1.id::text,'version',c1.version,'content_hash',c1.content_hash))
      and rn.generator->>'route' = 'route.generate.selftest' and rn.marker = 'Generated from canon. Not canon.' and rn.sources_hash is not null,'detail',rn.human_ref);

    r := public.thread_serve_rendition(h1, rid, 'explain to me');
    res := res || jsonb_build_object('name','The rendition is served to its own identity and purpose','pass',(r->>'id')::uuid = rid,'detail','served');

    begin perform public.thread_serve_rendition(h2, rid, 'explain to me'); ok := false; msg := 'served';
    exception when others then ok := sqlerrm like 'RENDITION_CONTEXT_MISMATCH%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A rendition cannot be served to a different identity','pass',ok,'detail',msg);

    begin perform public.thread_serve_rendition(h1, rid, 'board pack'); ok := false; msg := 'served';
    exception when others then ok := sqlerrm like 'RENDITION_CONTEXT_MISMATCH%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A rendition cannot be served for a different purpose','pass',ok,'detail',msg);

    begin update public.renditions set body = '{"sections":[]}' where id = rid; ok := false; msg := 'edited';
    exception when others then ok := sqlerrm like 'RENDITION_READ_ONLY%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A rendition cannot be edited (read-only)','pass',ok,'detail',msg);

    perform public.thread_revise_object(a, c2.id, c2.version, '{"statement":"Revised statement"}', 'phase 8 self-test');
    select * into rn from public.renditions where id = rid;
    select count(*) into q from public.rendition_regen_queue where rendition_id = rid and done_at is null;
    res := res || jsonb_build_object('name','Changing a canon source marks every dependent rendition stale and queues it','pass',rn.state = 'stale' and q = 1 and rn.delete_after is not null,'detail',rn.stale_reason);

    begin perform public.thread_serve_rendition(h1, rid, 'explain to me'); ok := false; msg := 'served';
    exception when others then ok := sqlerrm like 'RENDITION_STALE%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','A stale rendition is not served','pass',ok,'detail',msg);

    r := public.thread_rendition_sweep(now() + interval '25 hours');
    select * into rn from public.renditions where id = rid;
    res := res || jsonb_build_object('name','The scheduled sweep deletes stale renditions (content purged, stamp kept)','pass',rn.state = 'deleted' and rn.body is null and rn.deleted_at is not null,'detail',r::text);

    begin delete from public.renditions where id = rid; ok := false; msg := 'deleted';
    exception when others then ok := sqlerrm like 'RENDITION_DELETE_BY_SWEEP_ONLY%'; msg := sqlerrm; end;
    res := res || jsonb_build_object('name','Renditions are removed only by the sweep','pass',ok,'detail',msg);

    perform public.thread_create_object(a, public._fx_payload('Concept', 'Overdue term ' || tag, '{"definition":"overdue"}') || jsonb_build_object('review_date', (current_date - 1)::text));
    r := public.thread_generate_morning_brief(u1);
    select * into rn from public.renditions where id = (r->>'rendition_id')::uuid;
    res := res || jsonb_build_object('name','The morning brief is a cited rendition with judgment-only sections','pass',
      rn.kind = 'morning_intelligence_brief' and rn.permission_context->>'actor' = u1::text and jsonb_array_length(rn.citations) > 0
      and (select array_agg(s->>'heading') from jsonb_array_elements(rn.body->'sections') s) = array['Decisions requiring your input','Anomalies','Opportunities','Stop recommendations'],
      'detail', coalesce(rn.human_ref, r::text));

    raise exception 'P8_SELFTEST_ROLLBACK';
  exception when others then
    if sqlerrm <> 'P8_SELFTEST_ROLLBACK' then res := res || jsonb_build_object('name','Self-test ran to completion','pass',false,'detail',sqlerrm); end if;
  end;
  return jsonb_build_object('passed', not exists (select 1 from jsonb_array_elements(res) e where not (e->>'pass')::boolean) and jsonb_array_length(res) > 0, 'checks', res);
end $$;

create or replace function public.thread_record_phase8_evidence(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb; seq bigint;
begin
  st := public.thread_phase8_selftest();
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values ('00000000-0000-0000-0000-0000000000e8', p_actor, 'observe', 'phase8.exit_evidence', null, null, '{}', 'none',
    jsonb_build_object('phase', 8, 'selftest', st, 'note', 'generation layer (Part 10, 14.3); fixtures rolled back'),
    '', 'phase8-' || public.uuid_v7())
  returning ledger.seq into seq;
  return jsonb_build_object('ledger_seq', seq, 'selftest', st);
end $$;
revoke execute on function public.thread_phase8_selftest(), public.thread_record_phase8_evidence(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.thread_phase8_selftest(), public.thread_record_phase8_evidence(jsonb, jsonb) to service_role;

create or replace function public.thread_generate_rendition(p_actor jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; srcs uuid[]; cites uuid[]; hit jsonb; gf jsonb := '[]'; o public.objects; maxcls int := 0; cls text;
  rid uuid := public.uuid_v7(); ref text; seq bigint; mode text := coalesce(p->'generator'->>'adapter_mode', 'none');
  ranks constant text[] := array['public','internal','confidential','restricted'];
begin
  perform public._assert_actor(p_actor);
  begin uid := coalesce(nullif(p->>'for_user',''), p_actor->>'id')::uuid; exception when others then uid := null; end;
  if uid is null then raise exception 'IDENTITY_REQUIRED: a rendition is generated for one identity'; end if;
  if p_actor->>'kind' = 'human' and (p_actor->>'id') <> uid::text then
    raise exception 'RENDITION_CONTEXT_MISMATCH: a person may only generate renditions for themselves';
  end if;
  if coalesce(trim(p->>'purpose'),'') = '' then raise exception 'PURPOSE_REQUIRED: a rendition is generated for a stated purpose'; end if;
  if not exists (select 1 from public.rendition_kinds k where k.kind = p->>'kind') then raise exception 'UNKNOWN_RENDITION_KIND: %', p->>'kind'; end if;

  hit := public._prohibited_inference(coalesce(p->>'request_text','') || ' ' || (p->>'purpose') || ' ' || coalesce(p->>'context',''));
  if hit is null then hit := public._prohibited_inference(coalesce((p->'body')::text, '')); end if;
  if hit is not null then
    seq := public._rendition_ledger(p_actor, 'rendition.refused', 'none', jsonb_build_object('kind', p->>'kind', 'for_user', uid,
      'purpose', p->>'purpose', 'rule', hit->>'key', 'reason', hit->>'reason'));
    return jsonb_build_object('refused', true, 'code', 'PROHIBITED_INFERENCE', 'reason', hit->>'reason', 'rule', hit->>'key', 'ledger_seq', seq);
  end if;

  select coalesce(array_agg(distinct x::uuid), '{}') into srcs from jsonb_array_elements_text(case when jsonb_typeof(p->'sources') = 'array' then p->'sources' else '[]'::jsonb end) x;
  select coalesce(array_agg(distinct x::uuid), '{}') into cites from jsonb_array_elements_text(case when jsonb_typeof(p->'citations') = 'array' then p->'citations' else '[]'::jsonb end) x;
  if cardinality(srcs) = 0 then raise exception 'SOURCES_REQUIRED: a rendition is generated from canon objects'; end if;
  if cardinality(cites) = 0 then raise exception 'CITATIONS_REQUIRED: a rendition must cite the canon objects it renders'; end if;
  if exists (select 1 from unnest(cites) c where c <> all(srcs)) then raise exception 'CITATION_NOT_A_SOURCE: every citation must be one of the sources'; end if;

  for o in select * from public.objects where id = any(srcs) loop
    if o.is_tombstone then raise exception 'SOURCE_RETIRED: % is tombstoned', o.human_ref; end if;
    if not public._can_read_as(uid, o.permission, o.data_classification) then
      raise exception 'RENDITION_SOURCE_NOT_PERMITTED: % is outside this identity''s permissions', o.human_ref;
    end if;
    maxcls := greatest(maxcls, array_position(ranks, o.data_classification::text));
    gf := gf || jsonb_build_object('id', o.id::text, 'version', o.version, 'content_hash', o.content_hash, 'human_ref', o.human_ref);
  end loop;
  if jsonb_array_length(gf) <> cardinality(srcs) then raise exception 'SOURCE_NOT_FOUND: a source object does not exist'; end if;
  cls := ranks[maxcls];
  if mode = 'live' and cls in ('confidential','restricted') then
    raise exception 'TIER_ROUTE_REFUSED: % sources route in-boundary only', cls;
  end if;

  ref := 'RN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.rendition_ref_seq')::text, 4, '0');
  insert into public.renditions (id, human_ref, kind, generated_from, citations, generator, permission_context, expires_at, state, body, sources_hash, request)
  values (rid, ref, p->>'kind', gf, (select jsonb_agg(c::text) from unnest(cites) c),
    jsonb_build_object('agent', coalesce(p->'generator'->>'agent', 'thread.generator'), 'model', p->'generator'->>'model',
      'route', p->'generator'->>'route', 'template_version', p->'generator'->>'template_version', 'adapter_mode', mode),
    jsonb_build_object('actor', uid::text, 'purpose', p->>'purpose', 'context', coalesce(p->>'context',''), 'max_classification', cls),
    now() + make_interval(hours => least(greatest(coalesce((p->>'ttl_hours')::int, 168), 1), 720)),
    'live', p->'body',
    md5((select string_agg((e->>'id') || ':' || (e->>'content_hash'), ',' order by e->>'id') from jsonb_array_elements(gf) e)),
    jsonb_build_object('request_text', p->>'request_text'));
  seq := public._rendition_ledger(p_actor, 'rendition.generated', mode, jsonb_build_object('rendition_id', rid, 'human_ref', ref,
    'kind', p->>'kind', 'for_user', uid, 'purpose', p->>'purpose', 'generated_from', gf));
  return jsonb_build_object('refused', false, 'rendition_id', rid, 'human_ref', ref, 'ledger_seq', seq);
end $$;

CREATE OR REPLACE FUNCTION public.thread_create_object(p_actor jsonb, p jsonb)
 RETURNS objects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.objects; init text;
begin
  perform public._assert_actor(p_actor);
  select s.state into init from public.lifecycle_initial_states s join public.object_type_registry r on r.lifecycle_family = s.lifecycle_family where r.type = p->>'type';
  if init is null then raise exception 'UNKNOWN_TYPE: %', p->>'type'; end if;
  -- Section 3.4 NON-NEGOTIABLE: simulated provenance and the ledger's adapter_mode always agree
  if coalesce(p->'body'->'provenance'->>'simulated', 'false') = 'true' and coalesce(p->>'adapter_mode', '') <> 'simulated' then
    raise exception 'ADAPTER_MODE_MISMATCH: an object produced by a simulated adapter is ledgered as simulated';
  end if;
  o.id := public.uuid_v7();
  o.human_ref := public.next_human_ref(p->>'type');
  o.type := p->>'type';
  o.schema_version := coalesce(p->>'schema_version', '1.0.0');
  o.title := p->>'title'; o.statement := p->>'statement';
  o.body := coalesce(p->'body', '{}'); o.machine_description := p->>'machine_description';
  o.version := 1; o.supersedes := '{}'; o.superseded_by := '{}';
  o.derived_from := coalesce(array(select x::uuid from jsonb_array_elements_text(p->'derived_from') x), '{}');
  o.created_at := now(); o.created_by := p_actor; o.updated_at := now(); o.updated_by := p_actor;
  o.lifecycle_state := init; o.effective_from := now();
  o.review_date := (p->>'review_date')::date;
  o.expiration_condition := p->'expiration_condition';
  o.expires_at := (p->>'expires_at')::timestamptz;
  o.retirement_path := p->'retirement_path';
  o.owner_id := coalesce((p->>'owner_id')::uuid, (p_actor->>'id')::uuid);
  o.steward_id := (p->>'steward_id')::uuid;
  o.co_creator_id := (p->>'co_creator_id')::uuid; o.builder_id := (p->>'builder_id')::uuid;
  o.risk_tier := (p->>'risk_tier')::public.risk_tier;
  o.authority_level := 'observe';
  o.consequence_class := coalesce((p->>'consequence_class')::public.consequence_class, 'none');
  o.permission := p->'permission';
  o.data_classification := (p->>'data_classification')::public.data_classification;
  o.permitted_uses := coalesce(array(select jsonb_array_elements_text(p->'permitted_uses')), '{}');
  o.evidence_refs := coalesce(array(select x::uuid from jsonb_array_elements_text(p->'evidence_refs') x), '{}');
  o.citations := coalesce(p->'citations', '[]'); o.open_questions := '{}';
  o.is_tombstone := false;
  o.provenance_chain_id := public.uuid_v7();
  o.content_hash := public.object_content_hash(o);
  perform public._ledger_write(o.provenance_chain_id, p_actor, 'object.create', o, jsonb_strip_nulls(jsonb_build_object('rationale', p->>'rationale', 'adapter_mode', p->>'adapter_mode')));
  insert into public.objects (id, human_ref, type, schema_version, title, statement, body, machine_description, version, supersedes, superseded_by,
    derived_from, created_at, created_by, updated_at, updated_by, lifecycle_state, effective_from, review_date, expiration_condition, expires_at,
    retired_at, retirement_reason, retirement_path, owner_id, co_creator_id, builder_id, steward_id, risk_tier, authority_level, confidence_bundle,
    consequence_class, permission, data_classification, permitted_uses, evidence_refs, citations, open_questions, content_hash, provenance_chain_id, is_tombstone)
  values (o.id, o.human_ref, o.type, o.schema_version, o.title, o.statement, o.body, o.machine_description, o.version, o.supersedes, o.superseded_by,
    o.derived_from, o.created_at, o.created_by, o.updated_at, o.updated_by, o.lifecycle_state, o.effective_from, o.review_date, o.expiration_condition, o.expires_at,
    null, null, o.retirement_path, o.owner_id, o.co_creator_id, o.builder_id, o.steward_id, o.risk_tier, o.authority_level, null,
    o.consequence_class, o.permission, o.data_classification, o.permitted_uses, o.evidence_refs, o.citations, o.open_questions, o.content_hash, o.provenance_chain_id, false)
  returning * into o;
  return o;
end $function$;

-- Live prior-object surfacing (8A.7.4), run as the caller so permissions apply.
-- DESIGN DECISION: trigram + full-text similarity until the embedding route is warm (see AGENTS.md).
create or replace function public.framing_related_objects(p_text text, p_session uuid, p_types text[], p_limit integer default 8)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(r order by r.score desc), '[]') from (
    select o.id, o.human_ref as ref, o.type, o.title, o.statement, o.lifecycle_state as state, o.created_at, o.created_by, o.updated_at,
      o.body->>'origin_session_ref' as session_ref, o.body->'confirmation' as confirmation, o.body->>'status' as status,
      (select s.human_ref from public.objects s where s.id::text = o.body->>'origin_session_ref') as session_human_ref,
      greatest(similarity(o.title || ' ' || o.statement, p_text), word_similarity(p_text, o.title || ' ' || o.statement),
               case when o.search @@ websearch_to_tsquery('english', p_text) then 0.3 else 0 end)::numeric(5,3) as score
    from public.objects o
    where not o.is_tombstone and o.type = any(p_types)
      and coalesce(o.body->>'origin_session_ref', '') <> coalesce(p_session::text, '')
      and o.lifecycle_state not in ('rejected', 'superseded', 'retired')
    order by score desc
    limit p_limit
  ) r where r.score >= 0.18
$$;
grant execute on function public.framing_related_objects(text, uuid, text[], integer) to authenticated;


alter table public.renditions
  add column if not exists human_ref text,
  add column if not exists marker text not null default 'Generated from canon. Not canon.',
  add column if not exists sources_hash text,
  add column if not exists request jsonb not null default '{}',
  add column if not exists stale_at timestamptz,
  add column if not exists stale_reason text,
  add column if not exists delete_after timestamptz,
  add column if not exists deleted_at timestamptz;
alter table public.renditions add constraint renditions_marker_fixed check (marker = 'Generated from canon. Not canon.');
create index if not exists renditions_generated_from_gin on public.renditions using gin (generated_from jsonb_path_ops);
create index if not exists renditions_state_idx on public.renditions (state, delete_after);
create sequence if not exists public.rendition_ref_seq;

create table public.rendition_kinds (kind text primary key, label text not null, media text not null);
grant select on public.rendition_kinds to authenticated;
grant all on public.rendition_kinds to service_role;
alter table public.rendition_kinds enable row level security;
create policy "read rendition kinds" on public.rendition_kinds for select to authenticated using (true);
insert into public.rendition_kinds values
('audio_briefing_60s','60-second audio briefing','audio'),
('interactive_visual_explanation','Interactive visual explanation','interactive'),
('short_video','Short generated video','video'),
('conversational_walkthrough','Conversational walkthrough','text'),
('role_specific_scenario','Role-specific scenario','text'),
('decision_tree','Decision tree','text'),
('live_demonstration','Live demonstration','interactive'),
('technical_explanation','Technical explanation','text'),
('executive_narrative','Executive narrative','text'),
('capability_explanation','Capability explanation','text'),
('evidence_chain_rendering','Evidence chain rendering','text'),
('impact_narrative','Impact narrative','text'),
('morning_intelligence_brief','Morning intelligence brief','text'),
('burst_brief','Burst brief','text'),
('value_narrative','Value narrative','text'),
('council_briefing','Council briefing','text'),
('board_audit_report','Board / Audit Committee report','text');

create table public.rendition_regen_queue (id bigserial primary key, rendition_id uuid not null references public.renditions(id),
  reason text not null, enqueued_at timestamptz not null default now(), done_at timestamptz);
grant select on public.rendition_regen_queue to authenticated;
grant all on public.rendition_regen_queue to service_role;
alter table public.rendition_regen_queue enable row level security;
create policy "read own regen queue" on public.rendition_regen_queue for select to authenticated
  using (exists (select 1 from public.renditions r where r.id = rendition_id and (r.permission_context->>'actor') = auth.uid()::text));

-- Mirror of PROHIBITED_INFERENCE_RULES in src/domain/generation.ts
create or replace function public._prohibited_inference(t text) returns jsonb language sql immutable as $$
  select (select jsonb_build_object('key', k, 'reason', r) from (values
    ('activity_volume','(prompt|message|agent[ -]?call|keystroke|login|commit|meeting)s? (count|volume|total|frequency)','Infers performance from activity volume (14.3)', 1),
    ('hours_connected','(hours|time) (connected|online|logged|active)','Infers performance from hours connected (14.3)', 2),
    ('leaderboard','(leaderboard|league table)','Ranks individual humans (14.3)', 3),
    ('rank_people','(rank|rate|score|compare)( the| all| our| each)? (individual|employee|people|person|staff|builder|co-creator|member|colleague)s?','Ranks, rates or compares individual humans (14.3)', 4),
    ('individual_activity','(individual|per[- ](person|user|employee|builder)|each (person|employee|builder|user))(''s)? (activity|productivity|output|usage|performance)','Surfaces an individual''s activity-derived metric (14.3)', 5),
    ('activity_by_person','(activity|productivity|usage|output) (by|per|for each) (person|user|employee|builder|individual)','Surfaces an individual''s activity-derived metric (14.3)', 6),
    ('private_conversation','private (conversation|message|chat)s?','Scores people from private conversations (14.3)', 7),
    ('discipline','disciplin(e|ary)','Uses coaching data for discipline (14.3)', 8),
    ('progress_report','(progress against plan|task list|activity summary|status report)','Progress, task list or activity summary is not a rendition (10.4)', 9)
  ) as x(k, p, r, o) where coalesce(t,'') ~* p order by o limit 1)
$$;

create or replace function public._can_read_as(_uid uuid, _perm jsonb, _cls public.data_classification) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when _cls = 'prohibited' then false
    when _cls = 'restricted' then public.has_role(_uid, 'steward') or public.has_role(_uid, 'compliance')
    else true end
  and (coalesce(jsonb_array_length(_perm->'roles'), 0) = 0
       or exists (select 1 from public.user_roles ur where ur.user_id = _uid and ur.role::text in (select jsonb_array_elements_text(_perm->'roles'))))
$$;

create or replace function public._rendition_ledger(_actor jsonb, _action text, _mode text, _payload jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare s bigint;
begin
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (public.uuid_v7(), _actor, coalesce((_actor->>'authority_used')::public.authority_level, 'observe'), _action, null, null, '{}',
          case when _mode in ('live','simulated') then _mode else 'none' end, _payload, '', 'rn-' || public.uuid_v7())
  returning seq into s;
  return s;
end $$;

-- p: {for_user, kind, purpose, context, request_text, sources[], citations[], body, generator{model,route,template_version,adapter_mode}, ttl_hours}
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

  select coalesce(array_agg(distinct x::uuid), '{}') into srcs from jsonb_array_elements_text(coalesce(p->'sources','[]')) x;
  select coalesce(array_agg(distinct x::uuid), '{}') into cites from jsonb_array_elements_text(coalesce(p->'citations','[]')) x;
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

-- 10.2 Permission-scoped: never served to a different identity or purpose.
create or replace function public.thread_serve_rendition(p_actor jsonb, p_id uuid, p_purpose text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.renditions; o public.objects;
begin
  perform public._assert_actor(p_actor);
  select * into r from public.renditions where id = p_id;
  if r.id is null then raise exception 'RENDITION_NOT_FOUND'; end if;
  if (r.permission_context->>'actor') <> (p_actor->>'id') or (r.permission_context->>'purpose') <> coalesce(p_purpose, '') then
    raise exception 'RENDITION_CONTEXT_MISMATCH: this rendition was generated for a different identity or purpose';
  end if;
  if r.state = 'deleted' then raise exception 'RENDITION_DELETED: this rendition has been deleted'; end if;
  if r.state = 'stale' or r.expires_at < now() then raise exception 'RENDITION_STALE: a source changed or it expired; regenerate it'; end if;
  for o in select ob.* from public.objects ob where ob.id in (select (e->>'id')::uuid from jsonb_array_elements(r.generated_from) e) loop
    if not public._can_read_as((p_actor->>'id')::uuid, o.permission, o.data_classification) then
      raise exception 'RENDITION_CONTEXT_MISMATCH: a source is no longer within this identity''s permissions';
    end if;
  end loop;
  return to_jsonb(r);
end $$;

-- 10.2 Read-only; only the state may move forward; content is purged on deletion.
create or replace function public.renditions_guard() returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then raise exception 'RENDITION_DELETE_BY_SWEEP_ONLY: renditions are deleted by the scheduled sweep, keeping their stamp'; end if;
  if NEW.kind is distinct from OLD.kind or NEW.generated_from is distinct from OLD.generated_from or NEW.citations is distinct from OLD.citations
     or NEW.generator is distinct from OLD.generator or NEW.permission_context is distinct from OLD.permission_context
     or NEW.generated_at is distinct from OLD.generated_at or NEW.expires_at is distinct from OLD.expires_at
     or NEW.human_ref is distinct from OLD.human_ref or NEW.sources_hash is distinct from OLD.sources_hash or NEW.request is distinct from OLD.request then
    raise exception 'RENDITION_READ_ONLY: renditions cannot be edited; propose a canon change instead';
  end if;
  if NEW.state <> OLD.state and not ((OLD.state = 'live' and NEW.state in ('stale','deleted')) or (OLD.state = 'stale' and NEW.state = 'deleted')) then
    raise exception 'RENDITION_STATE: % -> % is not allowed', OLD.state, NEW.state;
  end if;
  if (NEW.body is distinct from OLD.body or NEW.storage_path is distinct from OLD.storage_path)
     and not (NEW.state = 'deleted' and NEW.body is null and NEW.storage_path is null) then
    raise exception 'RENDITION_READ_ONLY: renditions cannot be edited; propose a canon change instead';
  end if;
  return NEW;
end $$;
create trigger renditions_guard before update or delete on public.renditions for each row execute function public.renditions_guard();

-- 10.2 Expiring: a source content-hash change (or tombstone) marks every dependent rendition stale and queues it.
create or replace function public.renditions_stale_on_source_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.content_hash is distinct from OLD.content_hash or NEW.is_tombstone is distinct from OLD.is_tombstone then
    with s as (
      update public.renditions r set state = 'stale', stale_at = now(), stale_reason = 'source ' || NEW.human_ref || ' changed (v' || NEW.version || ')',
        delete_after = now() + interval '24 hours'
      where r.state = 'live' and r.generated_from @> jsonb_build_array(jsonb_build_object('id', NEW.id::text))
      returning r.id)
    insert into public.rendition_regen_queue (rendition_id, reason) select id, 'source ' || NEW.human_ref || ' changed' from s;
  end if;
  return NEW;
end $$;
create trigger renditions_stale_on_source_change after update on public.objects for each row execute function public.renditions_stale_on_source_change();

-- Scheduled deletion: expired -> stale; stale past delete_after -> deleted with content purged.
create or replace function public.thread_rendition_sweep(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_exp int; n_del int;
begin
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

-- 10.4 Morning intelligence brief: judgment only (decisions, anomalies, opportunities, stop recommendations).
create or replace function public.thread_generate_morning_brief(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare dec jsonb; ano jsonb; opp jsonb; stp jsonb; srcs jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('text', 'Decide: ' || title, 'cite', id::text, 'ref', human_ref)), '[]') into dec from (
    select o.id, o.title, o.human_ref from public.objects o where o.type = 'HumanDecisionRequest' and o.lifecycle_state = 'recorded'
      and not o.is_tombstone and o.owner_id = p_user and public._can_read_as(p_user, o.permission, o.data_classification)
      and not exists (select 1 from public.objects c where c.type = 'ConfirmedDecision' and c.body->>'request_ref' = o.id::text)
    order by o.created_at limit 10) x;
  select coalesce(jsonb_agg(jsonb_build_object('text', 'Anomaly (' || f.severity || ', ' || f.detector_key || ') on ' || o.human_ref || ': ' || o.title, 'cite', o.id::text, 'ref', o.human_ref)), '[]') into ano
    from (select * from public.detector_findings where state = 'open' and owner_id = p_user and object_id is not null order by created_at desc limit 10) f
    join public.objects o on o.id = f.object_id where not o.is_tombstone and public._can_read_as(p_user, o.permission, o.data_classification);
  select coalesce(jsonb_agg(jsonb_build_object('text', 'Reuse opportunity: ' || title || ' was published recently', 'cite', id::text, 'ref', human_ref)), '[]') into opp from (
    select o.id, o.title, o.human_ref from public.objects o where o.type = 'ComposableCapability' and o.lifecycle_state = 'published'
      and not o.is_tombstone and o.owner_id <> p_user and o.updated_at > now() - interval '7 days'
      and public._can_read_as(p_user, o.permission, o.data_classification) order by o.updated_at desc limit 5) x;
  select coalesce(jsonb_agg(jsonb_build_object('text', 'Consider stopping or renewing: ' || title || ' passed its review date (' || review_date || ')', 'cite', id::text, 'ref', human_ref)), '[]') into stp from (
    select o.id, o.title, o.human_ref, o.review_date from public.objects o where o.owner_id = p_user and not o.is_tombstone and o.retired_at is null
      and o.review_date < current_date order by o.review_date limit 10) x;
  select coalesce(jsonb_agg(distinct e->>'cite'), '[]') into srcs from jsonb_array_elements(dec || ano || opp || stp) e;
  if jsonb_array_length(srcs) = 0 then return jsonb_build_object('skipped', true, 'reason', 'Nothing requires your judgment'); end if;
  return public.thread_generate_rendition('{"kind":"system","id":"thread.morning_brief","authority_used":"act_bounded"}',
    jsonb_build_object('for_user', p_user, 'kind', 'morning_intelligence_brief', 'purpose', 'morning intelligence brief',
      'context', to_char(current_date, 'YYYY-MM-DD'), 'sources', srcs, 'citations', srcs, 'ttl_hours', 24,
      'generator', jsonb_build_object('agent', 'thread.morning_brief', 'model', 'rule-based', 'route', 'route.generate.brief', 'template_version', 'mb1', 'adapter_mode', 'none'),
      'body', jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('heading', 'Decisions requiring your input', 'items', dec),
        jsonb_build_object('heading', 'Anomalies', 'items', ano),
        jsonb_build_object('heading', 'Opportunities', 'items', opp),
        jsonb_build_object('heading', 'Stop recommendations', 'items', stp)))));
end $$;

create or replace function public.thread_generate_morning_briefs() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid; n int := 0; s int := 0; r jsonb;
begin
  for u in select distinct user_id from public.user_roles loop
    if exists (select 1 from public.renditions where kind = 'morning_intelligence_brief' and state = 'live'
               and permission_context->>'actor' = u::text and permission_context->>'context' = to_char(current_date, 'YYYY-MM-DD')) then continue; end if;
    r := public.thread_generate_morning_brief(u);
    if (r->>'skipped')::boolean then s := s + 1; else n := n + 1; end if;
  end loop;
  return jsonb_build_object('generated', n, 'skipped', s);
end $$;

revoke execute on function public.thread_generate_rendition(jsonb, jsonb), public.thread_serve_rendition(jsonb, uuid, text),
  public.thread_rendition_sweep(timestamptz), public.thread_generate_morning_brief(uuid), public.thread_generate_morning_briefs(),
  public._rendition_ledger(jsonb, text, text, jsonb), public._can_read_as(uuid, jsonb, public.data_classification) from public, anon, authenticated;
grant execute on function public.thread_generate_rendition(jsonb, jsonb), public.thread_serve_rendition(jsonb, uuid, text),
  public.thread_rendition_sweep(timestamptz), public.thread_generate_morning_brief(uuid), public.thread_generate_morning_briefs() to service_role;

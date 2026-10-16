create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto with schema extensions;

create type public.risk_tier as enum ('1','2','3','4');
create type public.authority_level as enum ('observe','recommend','act_with_confirmation','act_bounded','autonomous_with_exception');
create type public.consequence_class as enum ('none','reversible','costly_reversible','irreversible','rights_affecting','safety','lifeline');
create type public.data_classification as enum ('public','internal','confidential','restricted','prohibited');
create type public.actor_kind as enum ('human','agent','system');
create type public.app_role as enum ('steward','co_creator','builder','member','compliance');

create or replace function public.uuid_v7() returns uuid language plpgsql volatile set search_path = public, extensions as $$
declare ts bigint := floor(extract(epoch from clock_timestamp()) * 1000); b bytea := extensions.gen_random_bytes(16);
begin
  b := set_byte(b, 0, ((ts >> 40) & 255)::int); b := set_byte(b, 1, ((ts >> 32) & 255)::int);
  b := set_byte(b, 2, ((ts >> 24) & 255)::int); b := set_byte(b, 3, ((ts >> 16) & 255)::int);
  b := set_byte(b, 4, ((ts >> 8) & 255)::int);  b := set_byte(b, 5, (ts & 255)::int);
  b := set_byte(b, 6, (get_byte(b, 6) & 15) | 112);
  b := set_byte(b, 8, (get_byte(b, 8) & 63) | 128);
  return encode(b, 'hex')::uuid;
end $$;

create table public.user_roles (user_id uuid not null references auth.users(id) on delete cascade, role public.app_role not null, primary key (user_id, role));
create or replace function public.has_role(_uid uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _uid and role = _role) $$;

create table public.lifecycle_initial_states (lifecycle_family text primary key, state text not null);
create table public.lifecycle_transitions (
  lifecycle_family text not null, from_state text not null, to_state text not null,
  primary key (lifecycle_family, from_state, to_state),
  constraint no_approval_states check (
    to_state !~* '(approv|sign.?off|pending.?review|submitted.?for.?review|awaiting|qa.?phase|gate)'
    and from_state !~* '(approv|sign.?off|pending.?review|submitted.?for.?review|awaiting|qa.?phase|gate)')
);
create table public.object_type_registry (
  type text primary key,
  family text not null,
  ref_prefix text not null unique,
  lifecycle_family text not null references public.lifecycle_initial_states(lifecycle_family),
  body_schema jsonb not null,
  discovery_descriptor jsonb not null,
  schema_version text not null,
  constraint no_document_type check (type !~* '(document|wiki|backlog|sprint|epic|story|approval)' and type <> 'Requirement')
);

create table public.objects (
  id uuid primary key,
  human_ref text not null unique,
  type text not null references public.object_type_registry(type),
  schema_version text not null,
  title text not null,
  statement text not null,
  body jsonb not null default '{}',
  machine_description text not null,
  version int not null default 1,
  supersedes uuid[] not null default '{}',
  superseded_by uuid[] not null default '{}',
  derived_from uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by jsonb not null,
  lifecycle_state text not null,
  effective_from timestamptz not null default now(),
  review_date date not null,
  expiration_condition jsonb not null,
  expires_at timestamptz,
  retired_at timestamptz,
  retirement_reason text,
  retirement_path jsonb not null,
  owner_id uuid not null,
  co_creator_id uuid, builder_id uuid, steward_id uuid,
  risk_tier public.risk_tier not null,
  authority_level public.authority_level not null default 'observe',
  confidence_bundle jsonb,
  consequence_class public.consequence_class not null default 'none',
  permission jsonb not null,
  data_classification public.data_classification not null,
  permitted_uses text[] not null default '{}',
  evidence_refs uuid[] not null default '{}',
  citations jsonb not null default '[]',
  open_questions uuid[] not null default '{}',
  content_hash text not null,
  provenance_chain_id uuid not null,
  is_tombstone boolean not null default false,
  search tsvector generated always as (to_tsvector('english', coalesce(title,'')||' '||coalesce(statement,''))) stored
);
create index on public.objects using gin (search);
create index on public.objects (type, lifecycle_state);
create index on public.objects using gin (human_ref gin_trgm_ops);
create index on public.objects (provenance_chain_id);

create table public.object_versions (like public.objects including defaults);
alter table public.object_versions add primary key (id, version);

create table public.relationship_verbs (verb text primary key, from_types text[] not null, to_types text[] not null, directed boolean not null default true);
create table public.edges (
  id uuid primary key,
  verb text not null references public.relationship_verbs(verb),
  from_id uuid not null references public.objects(id),
  to_id uuid not null references public.objects(id),
  confidence numeric check (confidence between 0 and 1),
  source text not null,
  authority_used public.authority_level not null,
  evidence_refs uuid[] not null default '{}',
  created_by jsonb not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);
create index on public.edges (from_id, verb); create index on public.edges (to_id, verb);

create table public.ledger (
  seq bigserial primary key,
  provenance_chain_id uuid not null,
  occurred_at timestamptz not null default now(),
  actor jsonb not null, authority_used public.authority_level,
  action text not null, object_id uuid, object_version int,
  evidence_refs uuid[] not null default '{}',
  adapter_mode text not null default 'none' check (adapter_mode in ('none','simulated','live')),
  payload jsonb not null,
  txid bigint not null default txid_current(),
  prev_hash text not null, hash text not null unique
);
create index on public.ledger (provenance_chain_id, object_id, object_version);

create table public.confidence_rules (version text primary key, definition jsonb not null, published_at timestamptz not null);
create table public.authority_history (id bigserial primary key, object_id uuid not null references public.objects(id),
  from_level public.authority_level, to_level public.authority_level not null, cause text not null check (cause in ('promotion','demotion','grant','withdrawal')),
  trigger_ref uuid, evidence_refs uuid[] not null, at timestamptz not null default now());
create table public.confidence_history (id bigserial primary key, object_id uuid not null references public.objects(id),
  bundle jsonb not null, overall numeric not null, rule_version text not null references public.confidence_rules(version),
  computed_by text not null, at timestamptz not null default now());

create table public.reuse_checks (
  id uuid primary key, intent_shape jsonb not null, query_text text not null,
  results jsonb not null, decision text not null check (decision in ('reuse','compose','extend','create_new_no_match')),
  rationale text not null, checked_by jsonb not null, checked_at timestamptz not null default now());
create table public.creation_prompts (
  object_id uuid primary key references public.objects(id),
  reuse_check_id uuid not null references public.reuse_checks(id),
  source_behavior_ids uuid[] not null check (cardinality(source_behavior_ids) > 0),
  template_id uuid not null, template_version text not null,
  compiled_text text not null, compiled_hash text not null);
create table public.build_runs (
  object_id uuid primary key references public.objects(id),
  prompt_id uuid not null references public.creation_prompts(object_id),
  platform text not null check (platform in ('lovable','claude_code','codex','cursor','grok')),
  repro_key jsonb not null,
  external_run_id text, cost_ceiling numeric not null, cost_actual numeric,
  replay_mode text check (replay_mode in ('deterministic','best_effort')),
  adapter_mode text not null check (adapter_mode in ('simulated','live')));

create table public.renditions (
  id uuid primary key, kind text not null,
  generated_from jsonb not null check (jsonb_array_length(generated_from) > 0),
  citations jsonb not null check (jsonb_array_length(citations) > 0),
  generator jsonb not null, permission_context jsonb not null,
  generated_at timestamptz not null default now(), expires_at timestamptz not null,
  state text not null default 'live' check (state in ('live','stale','deleted')),
  storage_path text, body jsonb);

create table public.object_embeddings (object_id uuid primary key references public.objects(id), embedding vector(1536) not null, model text not null);
create table public.object_embeddings_restricted (object_id uuid primary key references public.objects(id), embedding vector(1536) not null, model text not null);

create table public.consent_records (id uuid primary key, session_id uuid not null, participant_id uuid not null,
  modalities text[] not null, granted_at timestamptz not null, withdrawn_at timestamptz);
create table public.session_events (id bigserial primary key, session_id uuid not null, t_offset_ms bigint not null,
  kind text not null, speaker_id uuid, ref uuid, payload jsonb not null);
create table public.extraction_spans (object_id uuid not null references public.objects(id), source_ref uuid not null,
  start_ms bigint, end_ms bigint, char_start int, char_end int, speaker_id uuid);

create table public.detectors (key text primary key, family text not null, owner_id uuid not null, schedule text, event_triggers text[], params jsonb not null, version text not null);
create table public.detector_findings (id uuid primary key, detector_key text not null references public.detectors(key), object_id uuid,
  severity text not null, owner_id uuid not null, state text not null check (state in ('open','resolved','accepted_risk')),
  accepted_by uuid, accepted_until timestamptz, evidence jsonb not null, created_at timestamptz not null default now());
create table public.agents (id uuid primary key, name text not null, token_hash text not null, authority_ceiling public.authority_level not null,
  quota jsonb not null, cost_cap numeric not null, a2a_card jsonb);
create table public.tool_contracts (name text primary key, contract jsonb not null, version text not null);
create table public.adapter_bindings (adapter text not null, environment text not null, mode text not null check (mode in ('simulated','live')), primary key(adapter, environment));
create table public.legacy_aliases (alias text not null, source_system text not null, object_id uuid not null references public.objects(id), primary key(alias, source_system));
create table public.canon_settings (key text primary key, value jsonb, status text not null check (status in ('set','open')), decided_by uuid, decision_id uuid);
create table public.guardrails (id uuid primary key, category text not null, evaluator text not null, params jsonb not null, version text not null, active boolean not null default true);
create table public.ref_sequences (prefix text not null, year int not null, next int not null, primary key(prefix, year));
create table public.notifications (id uuid primary key, recipient_id uuid not null, trigger_event_id bigint, decision_id uuid,
  body jsonb not null, created_at timestamptz not null default now(),
  constraint decision_or_event check (trigger_event_id is not null or decision_id is not null));
create table public.usage_sessions (id uuid primary key, actor_id uuid not null, started_at timestamptz not null, ended_at timestamptz,
  mutating_actions int not null default 0, reads int not null default 0);

create or replace function public.object_content_hash(o public.objects) returns text language sql stable set search_path = public, extensions as $$
  select encode(extensions.digest(jsonb_build_object(
    'type',o.type,'title',o.title,'statement',o.statement,'body',o.body,'machine_description',o.machine_description,
    'version',o.version,'lifecycle_state',o.lifecycle_state,'review_date',o.review_date,'expiration_condition',o.expiration_condition,
    'retirement_path',o.retirement_path,'risk_tier',o.risk_tier,'consequence_class',o.consequence_class,'permission',o.permission,
    'data_classification',o.data_classification,'permitted_uses',to_jsonb(o.permitted_uses),'evidence_refs',to_jsonb(o.evidence_refs),
    'citations',o.citations,'derived_from',to_jsonb(o.derived_from),'is_tombstone',o.is_tombstone,'retirement_reason',o.retirement_reason,
    'owner_id',o.owner_id,'steward_id',o.steward_id,'expires_at',o.expires_at)::text, 'sha256'), 'hex')
$$;

create or replace function public.ledger_row_hash(l public.ledger) returns text language sql stable set search_path = public, extensions as $$
  select encode(extensions.digest(l.prev_hash || '|' || jsonb_build_object(
    'seq',l.seq,'chain',l.provenance_chain_id,'at',extract(epoch from l.occurred_at)::text,'actor',l.actor,'authority',l.authority_used,
    'action',l.action,'object_id',l.object_id,'object_version',l.object_version,'evidence',to_jsonb(l.evidence_refs),
    'adapter_mode',l.adapter_mode,'payload',l.payload)::text, 'sha256'), 'hex')
$$;

create or replace function public.assert_transition(_type text, _from text, _to text) returns void language plpgsql stable set search_path = public as $$
declare fam text;
begin
  select lifecycle_family into fam from public.object_type_registry where type = _type;
  if not exists (select 1 from public.lifecycle_transitions where lifecycle_family = fam and from_state = _from and to_state = _to) then
    raise exception 'ILLEGAL_TRANSITION: % cannot move % -> % (family %)', _type, _from, _to, fam using errcode = 'P0001';
  end if;
end $$;

create or replace function public.next_human_ref(_type text) returns text language plpgsql volatile set search_path = public as $$
declare p text; y int := extract(year from now())::int; n int;
begin
  select ref_prefix into p from public.object_type_registry where type = _type;
  if p is null then raise exception 'UNKNOWN_TYPE: %', _type; end if;
  insert into public.ref_sequences values (p, y, 2) on conflict (prefix, year) do update set next = public.ref_sequences.next + 1
    returning next - 1 into n;
  return p || '-' || y || '-' || lpad(n::text, 4, '0');
end $$;

create or replace function public.ledger_hash() returns trigger language plpgsql set search_path = public as $$
declare prev text;
begin
  perform pg_advisory_xact_lock(hashtext('thread_ledger_chain'));
  NEW.seq := nextval(pg_get_serial_sequence('public.ledger', 'seq'));
  NEW.occurred_at := clock_timestamp();
  NEW.txid := txid_current();
  select hash into prev from public.ledger order by seq desc limit 1;
  NEW.prev_hash := coalesce(prev, 'GENESIS');
  NEW.hash := public.ledger_row_hash(NEW);
  return NEW;
end $$;
create trigger ledger_hash before insert on public.ledger for each row execute function public.ledger_hash();

create or replace function public.reject_mutation() returns trigger language plpgsql as $$
begin raise exception 'APPEND_ONLY: % on % is prohibited', TG_OP, TG_TABLE_NAME; end $$;
create trigger ledger_append_only before update or delete on public.ledger for each row execute function public.reject_mutation();
create trigger ledger_no_truncate before truncate on public.ledger for each statement execute function public.reject_mutation();
create trigger object_versions_immutable before update or delete on public.object_versions for each row execute function public.reject_mutation();

create or replace function public.objects_guard() returns trigger language plpgsql set search_path = public as $$
declare init text;
begin
  if NEW.data_classification = 'prohibited' then
    raise exception 'BLOCKED_PROHIBITED: prohibited-class content may not be stored';
  end if;
  if exists (select 1 from public.renditions r where r.id = any(NEW.derived_from)) then
    raise exception 'CANON_SUPREMACY: objects may not be derived from a rendition (P1)';
  end if;
  if TG_OP = 'INSERT' then
    if NEW.version <> 1 then raise exception 'VERSION_INVALID: first version must be 1'; end if;
    select s.state into init from public.lifecycle_initial_states s join public.object_type_registry r on r.lifecycle_family = s.lifecycle_family where r.type = NEW.type;
    if NEW.lifecycle_state <> init then raise exception 'ILLEGAL_INITIAL_STATE: % must start in %', NEW.type, init; end if;
    if NEW.is_tombstone then raise exception 'TOMBSTONE_ON_CREATE'; end if;
  else
    if OLD.is_tombstone then raise exception 'TOMBSTONED: % is a tombstone and cannot change', OLD.human_ref; end if;
    if NEW.id <> OLD.id or NEW.human_ref <> OLD.human_ref or NEW.type <> OLD.type or NEW.created_at <> OLD.created_at
       or NEW.created_by <> OLD.created_by or NEW.provenance_chain_id <> OLD.provenance_chain_id then
      raise exception 'IMMUTABLE_IDENTITY: id, human_ref, type, created_* and provenance_chain_id never change';
    end if;
    if NEW.version <> OLD.version + 1 then raise exception 'VERSION_INVALID: every change is a new version (expected %)', OLD.version + 1; end if;
    if NEW.risk_tier < OLD.risk_tier then raise exception 'RISK_TIER_DOWNWARD_OVERRIDE_PROHIBITED (Part 6.1)'; end if;
    if NEW.lifecycle_state <> OLD.lifecycle_state then perform public.assert_transition(NEW.type, OLD.lifecycle_state, NEW.lifecycle_state); end if;
    NEW.updated_at := now();
  end if;
  NEW.content_hash := public.object_content_hash(NEW);
  return NEW;
end $$;
create trigger a_objects_guard before insert or update on public.objects for each row execute function public.objects_guard();

create or replace function public.enforce_provenance() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.ledger l
     where l.provenance_chain_id = NEW.provenance_chain_id and l.object_id = NEW.id and l.object_version = NEW.version
       and l.txid = txid_current() and l.payload->>'content_hash' = NEW.content_hash) then
    raise exception 'PROVENANCE_REQUIRED: no ledger entry for % v% in this transaction', NEW.human_ref, NEW.version;
  end if;
  return NEW;
end $$;
create trigger b_enforce_provenance before insert or update on public.objects for each row execute function public.enforce_provenance();

create or replace function public.snapshot_version() returns trigger language plpgsql set search_path = public as $$
begin insert into public.object_versions select (NEW).*; return NEW; end $$;
create trigger c_snapshot_version after insert or update on public.objects for each row execute function public.snapshot_version();

create or replace function public.objects_no_delete() returns trigger language plpgsql as $$
begin raise exception 'TOMBSTONES_NOT_DELETIONS: objects are tombstoned, never deleted (Part 4.5 rule 7)'; end $$;
create trigger objects_no_delete before delete on public.objects for each row execute function public.objects_no_delete();

create or replace function public._ledger_write(_chain uuid, _actor jsonb, _action text, _o public.objects, _extra jsonb) returns void
language plpgsql set search_path = public as $$
begin
  insert into public.ledger (provenance_chain_id, actor, authority_used, action, object_id, object_version, evidence_refs, adapter_mode, payload, prev_hash, hash)
  values (_chain, _actor, coalesce((_actor->>'authority_used')::public.authority_level, 'observe'), _action, _o.id, _o.version, _o.evidence_refs,
          coalesce(_extra->>'adapter_mode', 'none'),
          jsonb_build_object('content_hash', _o.content_hash, 'human_ref', _o.human_ref, 'type', _o.type, 'lifecycle_state', _o.lifecycle_state) || coalesce(_extra - 'adapter_mode', '{}'),
          '', 'pending-' || public.uuid_v7()::text);
end $$;

create or replace function public._assert_actor(_actor jsonb) returns void language plpgsql immutable as $$
begin
  if _actor is null or (_actor->>'kind') not in ('human','agent','system') or coalesce(_actor->>'id','') = '' then
    raise exception 'ACTOR_REQUIRED: actor {kind,id,authority_used} is required';
  end if;
end $$;

create or replace function public._assert_can_write(_actor jsonb, _o public.objects) returns void language plpgsql stable set search_path = public as $$
declare uid uuid;
begin
  if _actor->>'kind' = 'system' then return; end if;
  begin uid := (_actor->>'id')::uuid; exception when others then uid := null; end;
  if uid is not null and (uid = _o.owner_id or uid = _o.steward_id or public.has_role(uid, 'steward')) then return; end if;
  raise exception 'AUTHORITY_INSUFFICIENT: only the owner or a steward may change %', _o.human_ref;
end $$;

create or replace function public.thread_create_object(p_actor jsonb, p jsonb) returns public.objects
language plpgsql security definer set search_path = public as $$
declare o public.objects; init text;
begin
  perform public._assert_actor(p_actor);
  select s.state into init from public.lifecycle_initial_states s join public.object_type_registry r on r.lifecycle_family = s.lifecycle_family where r.type = p->>'type';
  if init is null then raise exception 'UNKNOWN_TYPE: %', p->>'type'; end if;
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
  perform public._ledger_write(o.provenance_chain_id, p_actor, 'object.create', o, jsonb_build_object('rationale', p->>'rationale'));
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
end $$;

create or replace function public._thread_apply(p_actor jsonb, n public.objects, _action text, _extra jsonb) returns public.objects
language plpgsql set search_path = public as $$
begin
  n.updated_by := p_actor;
  n.content_hash := public.object_content_hash(n);
  perform public._ledger_write(n.provenance_chain_id, p_actor, _action, n, _extra);
  update public.objects set title = n.title, statement = n.statement, body = n.body, machine_description = n.machine_description,
    version = n.version, updated_by = n.updated_by, lifecycle_state = n.lifecycle_state, review_date = n.review_date,
    expiration_condition = n.expiration_condition, expires_at = n.expires_at, retired_at = n.retired_at, retirement_reason = n.retirement_reason,
    retirement_path = n.retirement_path, steward_id = n.steward_id, risk_tier = n.risk_tier, consequence_class = n.consequence_class,
    permission = n.permission, data_classification = n.data_classification, permitted_uses = n.permitted_uses, evidence_refs = n.evidence_refs,
    citations = n.citations, is_tombstone = n.is_tombstone
  where id = n.id returning * into n;
  return n;
end $$;

create or replace function public._load_for_write(p_actor jsonb, p_id uuid, p_expected_version int) returns public.objects
language plpgsql set search_path = public as $$
declare o public.objects;
begin
  perform public._assert_actor(p_actor);
  select * into o from public.objects where id = p_id for update;
  if o.id is null then raise exception 'NOT_FOUND: %', p_id; end if;
  if o.version <> p_expected_version then raise exception 'VERSION_CONFLICT: expected v%, current v%', p_expected_version, o.version; end if;
  perform public._assert_can_write(p_actor, o);
  return o;
end $$;

create or replace function public.thread_revise_object(p_actor jsonb, p_id uuid, p_expected_version int, p_patch jsonb, p_rationale text) returns public.objects
language plpgsql security definer set search_path = public as $$
declare o public.objects;
begin
  if coalesce(p_rationale, '') = '' then raise exception 'RATIONALE_REQUIRED: every canon change carries a rationale (P15)'; end if;
  o := public._load_for_write(p_actor, p_id, p_expected_version);
  if p_patch ? 'title' then o.title := p_patch->>'title'; end if;
  if p_patch ? 'statement' then o.statement := p_patch->>'statement'; end if;
  if p_patch ? 'body' then o.body := p_patch->'body'; end if;
  if p_patch ? 'machine_description' then o.machine_description := p_patch->>'machine_description'; end if;
  if p_patch ? 'review_date' then o.review_date := (p_patch->>'review_date')::date; end if;
  if p_patch ? 'expiration_condition' then o.expiration_condition := p_patch->'expiration_condition'; end if;
  if p_patch ? 'retirement_path' then o.retirement_path := p_patch->'retirement_path'; end if;
  if p_patch ? 'risk_tier' then o.risk_tier := (p_patch->>'risk_tier')::public.risk_tier; end if;
  if p_patch ? 'consequence_class' then o.consequence_class := (p_patch->>'consequence_class')::public.consequence_class; end if;
  if p_patch ? 'permission' then o.permission := p_patch->'permission'; end if;
  if p_patch ? 'data_classification' then o.data_classification := (p_patch->>'data_classification')::public.data_classification; end if;
  if p_patch ? 'steward_id' then o.steward_id := (p_patch->>'steward_id')::uuid; end if;
  if p_patch ? 'evidence_refs' then o.evidence_refs := array(select x::uuid from jsonb_array_elements_text(p_patch->'evidence_refs') x); end if;
  if p_patch ? 'citations' then o.citations := p_patch->'citations'; end if;
  o.version := o.version + 1;
  return public._thread_apply(p_actor, o, 'object.revise', jsonb_build_object('rationale', p_rationale, 'fields', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
end $$;

create or replace function public.thread_transition_object(p_actor jsonb, p_id uuid, p_expected_version int, p_to_state text, p_rationale text) returns public.objects
language plpgsql security definer set search_path = public as $$
declare o public.objects; from_state text;
begin
  if coalesce(p_rationale, '') = '' then raise exception 'RATIONALE_REQUIRED'; end if;
  o := public._load_for_write(p_actor, p_id, p_expected_version);
  from_state := o.lifecycle_state;
  perform public.assert_transition(o.type, from_state, p_to_state);
  o.lifecycle_state := p_to_state; o.version := o.version + 1;
  return public._thread_apply(p_actor, o, 'object.transition', jsonb_build_object('from', from_state, 'to', p_to_state, 'rationale', p_rationale));
end $$;

create or replace function public.thread_tombstone_object(p_actor jsonb, p_id uuid, p_expected_version int, p_reason text) returns public.objects
language plpgsql security definer set search_path = public as $$
declare o public.objects;
begin
  if coalesce(p_reason, '') = '' then raise exception 'REASON_REQUIRED: tombstones carry a reason (Part 4.5 rule 7)'; end if;
  o := public._load_for_write(p_actor, p_id, p_expected_version);
  o.is_tombstone := true; o.retired_at := now(); o.retirement_reason := p_reason; o.version := o.version + 1;
  return public._thread_apply(p_actor, o, 'object.tombstone', jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.thread_verify_ledger() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.ledger; prev text := 'GENESIS'; n bigint := 0; bad bigint := null;
begin
  for r in select * from public.ledger order by seq loop
    n := n + 1;
    if r.prev_hash <> prev or r.hash <> public.ledger_row_hash(r) then bad := r.seq; exit; end if;
    prev := r.hash;
  end loop;
  return jsonb_build_object('ok', bad is null, 'entries_checked', n, 'first_bad_seq', bad, 'head_hash', prev, 'verified_at', now());
end $$;

create or replace function public.thread_restore_rehearsal() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total int; mismatched int; missing int;
begin
  select count(*) into total from public.objects;
  select count(*) into mismatched from public.objects o join public.object_versions v on v.id = o.id and v.version = o.version
    where public.object_content_hash(row(v.*)::public.objects) <> o.content_hash or v.content_hash <> o.content_hash;
  select count(*) into missing from public.objects o where (select count(*) from public.object_versions v where v.id = o.id) <> o.version;
  return jsonb_build_object('ok', mismatched = 0 and missing = 0, 'objects', total, 'hash_mismatches', mismatched, 'version_gaps', missing,
    'mode', 'simulated', 'note', 'Snapshot replay rehearsal. Platform backup restore is pending_live_adapter.');
end $$;

create or replace function public.handle_new_user_roles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (NEW.id, 'member') on conflict do nothing;
  if not exists (select 1 from public.user_roles where role = 'steward') then
    insert into public.user_roles (user_id, role) values (NEW.id, 'steward') on conflict do nothing;
  end if;
  return NEW;
end $$;
create trigger on_auth_user_created_roles after insert on auth.users for each row execute function public.handle_new_user_roles();

create or replace function public.can_read_object(_perm jsonb, _cls public.data_classification) returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _cls = 'prohibited' then false
    when _cls = 'restricted' then public.has_role(auth.uid(), 'steward') or public.has_role(auth.uid(), 'compliance')
    else true end
  and (coalesce(jsonb_array_length(_perm->'roles'), 0) = 0
       or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in (select jsonb_array_elements_text(_perm->'roles'))))
$$;

do $$
declare t text;
begin
  foreach t in array array['object_type_registry','lifecycle_initial_states','lifecycle_transitions','relationship_verbs','objects','object_versions',
    'edges','confidence_rules','authority_history','confidence_history','reuse_checks','creation_prompts','build_runs','renditions',
    'object_embeddings','object_embeddings_restricted','consent_records','session_events','extraction_spans','detectors','detector_findings',
    'agents','tool_contracts','adapter_bindings','legacy_aliases','canon_settings','guardrails','ref_sequences','notifications','usage_sessions','user_roles'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
grant select on public.ledger to authenticated;
grant select, insert on public.ledger to service_role;
revoke update, delete, truncate on public.ledger from public, anon, authenticated, service_role;
revoke update, delete, truncate on public.object_versions from public, anon, authenticated, service_role;
revoke delete on public.objects from public, anon, authenticated, service_role;
grant usage on sequence public.ledger_seq_seq to service_role;
alter table public.ledger enable row level security;

create policy "read registry" on public.object_type_registry for select to authenticated using (true);
create policy "read initial states" on public.lifecycle_initial_states for select to authenticated using (true);
create policy "read transitions" on public.lifecycle_transitions for select to authenticated using (true);
create policy "read verbs" on public.relationship_verbs for select to authenticated using (true);
create policy "read objects by permission" on public.objects for select to authenticated using (public.can_read_object(permission, data_classification));
create policy "read versions by permission" on public.object_versions for select to authenticated using (public.can_read_object(permission, data_classification));
create policy "read ledger" on public.ledger for select to authenticated using (true);
create policy "read edges" on public.edges for select to authenticated using (exists (select 1 from public.objects o where o.id = from_id) and exists (select 1 from public.objects o where o.id = to_id));
create policy "read confidence rules" on public.confidence_rules for select to authenticated using (true);
create policy "read authority history" on public.authority_history for select to authenticated using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read confidence history" on public.confidence_history for select to authenticated using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read reuse checks" on public.reuse_checks for select to authenticated using (true);
create policy "read creation prompts" on public.creation_prompts for select to authenticated using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read build runs" on public.build_runs for select to authenticated using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read renditions for own context" on public.renditions for select to authenticated using ((permission_context->>'actor') = auth.uid()::text);
create policy "read embeddings" on public.object_embeddings for select to authenticated using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read restricted embeddings" on public.object_embeddings_restricted for select to authenticated using (public.has_role(auth.uid(),'steward') or public.has_role(auth.uid(),'compliance'));
create policy "read consent" on public.consent_records for select to authenticated using (participant_id = auth.uid() or public.has_role(auth.uid(),'steward') or public.has_role(auth.uid(),'compliance'));
create policy "read session events" on public.session_events for select to authenticated using (public.has_role(auth.uid(),'steward') or public.has_role(auth.uid(),'co_creator') or public.has_role(auth.uid(),'builder'));
create policy "read spans" on public.extraction_spans for select to authenticated using (exists (select 1 from public.objects o where o.id = object_id));
create policy "read detectors" on public.detectors for select to authenticated using (true);
create policy "read findings" on public.detector_findings for select to authenticated using (true);
create policy "stewards read agents" on public.agents for select to authenticated using (public.has_role(auth.uid(),'steward'));
create policy "read tool contracts" on public.tool_contracts for select to authenticated using (true);
create policy "read adapter bindings" on public.adapter_bindings for select to authenticated using (true);
create policy "read aliases" on public.legacy_aliases for select to authenticated using (true);
create policy "read canon settings" on public.canon_settings for select to authenticated using (true);
create policy "read guardrails" on public.guardrails for select to authenticated using (true);
create policy "read ref sequences" on public.ref_sequences for select to authenticated using (true);
create policy "own notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "own usage sessions" on public.usage_sessions for select to authenticated using (actor_id = auth.uid());
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

revoke execute on function public.thread_create_object(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.thread_revise_object(jsonb, uuid, int, jsonb, text) from public, anon, authenticated;
revoke execute on function public.thread_transition_object(jsonb, uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.thread_tombstone_object(jsonb, uuid, int, text) from public, anon, authenticated;
revoke execute on function public.thread_verify_ledger() from public, anon;
revoke execute on function public.thread_restore_rehearsal() from public, anon;
grant execute on function public.thread_create_object(jsonb, jsonb) to service_role;
grant execute on function public.thread_revise_object(jsonb, uuid, int, jsonb, text) to service_role;
grant execute on function public.thread_transition_object(jsonb, uuid, int, text, text) to service_role;
grant execute on function public.thread_tombstone_object(jsonb, uuid, int, text) to service_role;
grant execute on function public.thread_verify_ledger() to authenticated, service_role;
grant execute on function public.thread_restore_rehearsal() to authenticated, service_role;

insert into public.canon_settings (key, value, status) values ('anti_wiki.action_ratio', null, 'open');
insert into public.adapter_bindings values
 ('ModelGateway','preview','simulated'),('Transcription','preview','simulated'),('BuildPlatform','preview','simulated'),('CICD','preview','simulated'),
 ('Telemetry','preview','simulated'),('FeatureFlags','preview','simulated'),('IdentityProvider','preview','simulated'),('ContentClassifier','preview','simulated');

-- ============ Phase 2B: framing session capture and extraction (Part 8A) ============

-- Side tables (not canon; evidence of the pipeline's behaviour)
create table public.framing_live_findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.objects(id),
  kind text not null check (kind in ('contradiction','prior_need','prior_decision','prior_behavior','capability_reuse','disproven_assumption','authority_mismatch','materiality_question','dependency_proposed')),
  statement_id uuid references public.objects(id),
  related_object_id uuid references public.objects(id),
  message text not null,
  payload jsonb not null default '{}',
  latency_ms integer,
  state text not null default 'open' check (state in ('open','linked','superseded_link','dismissed','resolved','deferred','accepted_ambiguity','answered')),
  resolution jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint deferral_has_owner_and_date check (state <> 'deferred' or (resolution ? 'owner' and resolution ? 'due'))
);
create index framing_live_findings_session on public.framing_live_findings(session_id, created_at);

create table public.extraction_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.objects(id),
  revision integer not null,
  extractor_version text not null,
  model_route text not null,
  model text,
  adapter_mode text not null check (adapter_mode in ('simulated','live','none')),
  statements integer not null default 0,
  preserved_confirmations integer not null default 0,
  superseded_drafts integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (session_id, revision)
);

create table public.classification_corrections (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.objects(id),
  session_id uuid not null references public.objects(id),
  from_class text not null,
  to_class text not null,
  by_actor uuid not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.extraction_timings (
  id bigserial primary key,
  session_id uuid not null references public.objects(id),
  statement_id uuid references public.objects(id),
  stage text not null check (stage in ('extraction','contradiction','prior_surfacing','capability_reuse','close_to_graph')),
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now()
);
create index extraction_timings_stage on public.extraction_timings(stage, created_at);

create table public.extraction_eval_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  speaker_has_decision_authority boolean not null,
  expected_classification text not null check (expected_classification in ('question','suggestion','assumption','decision','confirmed_behavior','context')),
  expected_object_type text,
  label_source text not null,
  created_at timestamptz not null default now()
);

-- Grants (explicit, Data API needs them)
grant select on public.framing_live_findings to authenticated;
grant all on public.framing_live_findings to service_role;
grant select on public.extraction_revisions to authenticated;
grant all on public.extraction_revisions to service_role;
grant select on public.classification_corrections to authenticated;
grant all on public.classification_corrections to service_role;
grant select on public.extraction_timings to authenticated;
grant all on public.extraction_timings to service_role;
grant usage, select on sequence public.extraction_timings_id_seq to service_role;
grant select on public.extraction_eval_items to authenticated;
grant all on public.extraction_eval_items to service_role;

-- Who may read a session's live material: its owner/co-creator/builder, consented participants, stewards, compliance
create or replace function public.can_read_session(_s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'steward') or public.has_role(auth.uid(), 'compliance')
    or exists (select 1 from public.objects o where o.id = _s and (o.owner_id = auth.uid() or o.co_creator_id = auth.uid() or o.builder_id = auth.uid()))
    or exists (select 1 from public.consent_records c where c.session_id = _s and c.participant_id = auth.uid())
$$;

alter table public.framing_live_findings enable row level security;
alter table public.extraction_revisions enable row level security;
alter table public.classification_corrections enable row level security;
alter table public.extraction_timings enable row level security;
alter table public.extraction_eval_items enable row level security;
create policy "read findings of readable sessions" on public.framing_live_findings for select to authenticated using (public.can_read_session(session_id));
create policy "read revisions of readable sessions" on public.extraction_revisions for select to authenticated using (public.can_read_session(session_id));
create policy "read corrections of readable sessions" on public.classification_corrections for select to authenticated using (public.can_read_session(session_id));
create policy "read timings of readable sessions" on public.extraction_timings for select to authenticated using (public.can_read_session(session_id));
create policy "read eval items" on public.extraction_eval_items for select to authenticated using (true);
create policy "participants read their session events" on public.session_events for select to authenticated using (public.can_read_session(session_id));

-- Live surfacing is pushed to the session (8A.7.4)
alter publication supabase_realtime add table public.framing_live_findings;
alter publication supabase_realtime add table public.session_events;

-- Modality of each artifact kind (8A.2) for the consent gate
create or replace function public.artifact_modality(_kind text) returns text
language sql immutable as $$
  select case
    when _kind in ('audio','transcript','recording','third_party_recording') then 'audio'
    when _kind in ('whiteboard','diagram','screen_capture','prototype_interaction') then 'visual'
    when _kind in ('chat','typed_notes') then 'text'
    when _kind = 'brought_in_document' then 'document'
    else 'unknown' end
$$;

-- Does this user hold decision authority in this session?
create or replace function public._framing_confirmer_ok(_session uuid, _actor text) returns boolean
language sql stable set search_path = public as $$
  select exists (
    select 1 from public.objects s, jsonb_array_elements(coalesce(s.body->'participants','[]')) p(v)
    where s.id = _session and p.v->>'user_id' = _actor and coalesce((p.v->>'decision_authority')::boolean, false))
$$;

-- P8A.4 NON-NEGOTIABLE: an extracted object with no provenance span never reaches the graph
alter table public.objects add constraint objects_extracted_provenance_spans check (
  is_tombstone
  or not (type in ('ExtractedStatement','NeedStatement','DependencyProposal','EvidenceRequirement','Persona','Situation') or body ? 'origin_session_ref')
  or case when jsonb_typeof(body->'provenance_spans') = 'array' then jsonb_array_length(body->'provenance_spans') > 0 else false end
);

create or replace function public.framing_guard() returns trigger
language plpgsql set search_path = public as $$
declare sess public.objects; missing int; n int; cls_old text; cls_new text; conf jsonb; modality text;
begin
  if NEW.is_tombstone then return NEW; end if;

  -- Consent before capture (8A.13, P13)
  if NEW.type = 'FramingSession' and NEW.lifecycle_state = 'capturing' and (TG_OP = 'INSERT' or OLD.lifecycle_state <> 'capturing') then
    if coalesce(NEW.body->>'co_creator', '') = '' or coalesce(NEW.body->>'builder', '') = '' then
      raise exception 'CO_CREATOR_AND_BUILDER_REQUIRED: a framing session names its Business Co-Creator and its Builder (8A.6)';
    end if;
    if jsonb_array_length(coalesce(NEW.body->'participants', '[]')) = 0 or jsonb_array_length(coalesce(NEW.body->'modalities', '[]')) = 0 then
      raise exception 'PARTICIPANTS_AND_MODALITIES_REQUIRED: consent is per participant and per modality';
    end if;
    select count(*) into missing
    from jsonb_array_elements(NEW.body->'participants') p(v), jsonb_array_elements_text(NEW.body->'modalities') m(m)
    where not exists (select 1 from public.consent_records c where c.session_id = NEW.id and c.participant_id = (p.v->>'id')::uuid
                      and m.m = any(c.modalities) and c.withdrawn_at is null);
    if missing > 0 then
      raise exception 'CONSENT_REQUIRED: % participant-modality pair(s) have no active ConsentRecord; capture cannot open (8A.13, P13)', missing;
    end if;
  end if;

  -- Close: never with unrecorded unresolved items (8A.10)
  if NEW.type = 'FramingSession' and TG_OP = 'UPDATE' and NEW.lifecycle_state = 'closed' and OLD.lifecycle_state <> 'closed' then
    if not (NEW.body ? 'entry_test_result') then
      raise exception 'ENTRY_TEST_REQUIRED: the entry test is completed or the session yields an OpenQuestion (8A.1)';
    end if;
    select count(*) into n from public.objects x where x.type = 'ExtractedStatement' and x.body->>'origin_session_ref' = NEW.id::text
      and not x.is_tombstone and x.lifecycle_state = 'draft' and coalesce((x.body->>'material')::boolean, false) and not (x.body ? 'deferral');
    if n > 0 then
      raise exception 'UNRECORDED_MATERIAL_ITEMS: % material item(s) are neither confirmed, rejected nor explicitly deferred (8A.10)', n;
    end if;
    select count(*) into n from public.framing_live_findings f where f.session_id = NEW.id and f.kind in ('contradiction','materiality_question') and f.state = 'open';
    if n > 0 then
      raise exception 'UNRECORDED_OPEN_ITEMS: % contradiction or materiality question(s) are still open; resolve, defer with owner and date, or accept the ambiguity', n;
    end if;
  end if;

  -- Artifacts: the session must be capturing and every participant must consent to the artifact's modality
  if NEW.type = 'CoCreationArtifact' and TG_OP = 'INSERT' then
    select * into sess from public.objects where id = (NEW.body->>'session_ref')::uuid;
    if sess.id is null or sess.type <> 'FramingSession' then raise exception 'SESSION_REQUIRED: an artifact belongs to a framing session'; end if;
    if sess.lifecycle_state <> 'capturing' then raise exception 'CAPTURE_NOT_OPEN: % is %, not capturing', sess.human_ref, sess.lifecycle_state; end if;
    modality := public.artifact_modality(NEW.body->>'kind');
    select count(*) into missing from jsonb_array_elements(sess.body->'participants') p(v)
    where not exists (select 1 from public.consent_records c where c.session_id = sess.id and c.participant_id = (p.v->>'id')::uuid
                      and modality = any(c.modalities) and c.withdrawn_at is null);
    if missing > 0 then
      raise exception 'CONSENT_REQUIRED: % participant(s) have not consented to % capture (8A.13)', missing, modality;
    end if;
  end if;

  -- Six-way classification with authority awareness (8A.5)
  if NEW.type = 'ExtractedStatement' then
    cls_new := NEW.body->>'classification';
    if cls_new is null or cls_new not in ('question','suggestion','assumption','decision','confirmed_behavior','context') then
      raise exception 'CLASSIFICATION_INVALID: % is not one of the six classes (8A.5)', cls_new;
    end if;
    if cls_new = 'decision' and not coalesce((NEW.body->'speaker_authority'->>'decision')::boolean, false) then
      raise exception 'DECISION_WITHOUT_AUTHORITY: the speaker holds no decision authority, so this is a suggestion (8A.5)';
    end if;
    if TG_OP = 'UPDATE' then
      cls_old := OLD.body->>'classification';
      if cls_old in ('context','question') and cls_new <> cls_old and cls_new in ('suggestion','assumption','decision','confirmed_behavior')
         and not (coalesce(NEW.body->'classification_change'->>'by_kind', '') = 'human' and (NEW.body->'classification_change'->>'version')::int = NEW.version) then
        raise exception 'RAW_SPEECH_PROMOTION_REQUIRES_HUMAN: a % unit becomes % only by explicit human re-classification (8A.5)', cls_old, cls_new;
      end if;
    end if;
  end if;

  -- Re-extraction safety: a confirmation is never overwritten (8A.3, 8A.13)
  if TG_OP = 'UPDATE' and OLD.lifecycle_state = 'confirmed' and (OLD.body ? 'origin_session_ref')
     and (NEW.title, NEW.statement, NEW.body) is distinct from (OLD.title, OLD.statement, OLD.body) then
    raise exception 'CONFIRMATION_PRESERVED: % is confirmed; a new extraction proposes a successor instead of overwriting it', OLD.human_ref;
  end if;

  -- Confirmation is recorded on the object, by the actor with authority for material items (8A.10)
  if (NEW.body ? 'origin_session_ref') and (
       (TG_OP = 'UPDATE' and NEW.lifecycle_state in ('confirmed','active') and OLD.lifecycle_state in ('draft','proposed'))
    or (TG_OP = 'INSERT' and NEW.type = 'ConfirmedDecision')) then
    conf := NEW.body->'confirmation';
    if conf is null or coalesce(conf->>'actor_id', '') = '' or coalesce(conf->>'at', '') = '' then
      raise exception 'CONFIRMATION_REQUIRED: confirmation records the actor, the authority used and the time (8A.10)';
    end if;
    if (coalesce((NEW.body->>'material')::boolean, false) or NEW.type = 'ConfirmedDecision')
       and not public._framing_confirmer_ok((NEW.body->>'origin_session_ref')::uuid, conf->>'actor_id') then
      raise exception 'AUTHORITY_REQUIRED_TO_CONFIRM: material items are confirmed only by a participant holding decision authority (8A.10)';
    end if;
  end if;
  return NEW;
end $$;

create trigger a2_framing_guard before insert or update on public.objects for each row execute function public.framing_guard();

-- Draft objects can never reach creation (8A.6, F3)
create or replace function public.creation_source_guard() returns trigger
language plpgsql set search_path = public as $$
declare bad text;
begin
  select string_agg(o.human_ref || ' (' || o.lifecycle_state || ')', ', ') into bad from public.objects o
  where o.id = any(NEW.source_behavior_ids) and (o.lifecycle_state in ('draft','proposed','rejected') or o.is_tombstone);
  if bad is not null then
    raise exception 'DRAFT_CANNOT_REACH_CREATION: % — drafts are visible and traceable but never a basis for creation (8A.6)', bad;
  end if;
  if (select count(*) from public.objects o where o.id = any(NEW.source_behavior_ids)) <> cardinality(NEW.source_behavior_ids) then
    raise exception 'SOURCE_NOT_FOUND: every creation source must be an existing object';
  end if;
  return NEW;
end $$;
create trigger a_creation_source_guard before insert or update on public.creation_prompts for each row execute function public.creation_source_guard();

-- The session timeline accepts capture events only while capturing
create or replace function public.session_events_guard() returns trigger
language plpgsql set search_path = public as $$
declare st text;
begin
  select lifecycle_state into st from public.objects where id = NEW.session_id and type = 'FramingSession';
  if st is null then raise exception 'SESSION_REQUIRED: timeline events belong to a framing session'; end if;
  if NEW.kind not like 'session.%' and NEW.kind not like 'consent.%' and st <> 'capturing' then
    raise exception 'CAPTURE_NOT_OPEN: the session is %, so nothing is captured', st;
  end if;
  return NEW;
end $$;
create trigger session_events_guard before insert on public.session_events for each row execute function public.session_events_guard();

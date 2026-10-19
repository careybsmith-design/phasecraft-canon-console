/**
 * Framing sessions and the co-creation extraction pipeline (Layer B Part 8A).
 * Server functions behind the 8A.11 tool contracts. All object writes go through the thread_* functions
 * (ledger-first). Human actions use the verified session user; extraction writes use the system extractor
 * actor on the user's behalf.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CLASSES,
  MODALITIES,
  ARTIFACT_KINDS,
  FRAMING_VIEWS,
  LATENCY_BUDGETS,
  applyPostRules,
  artifactModality,
  confirmedState,
  entryTestComplete,
  entryTestSentence,
  evidenceWeight,
  mergeEntryTest,
  p95,
  precisionRecall,
  segment,
  statedDependency,
  overlap,
  EMPTY_ENTRY_TEST,
  type ArtifactKind,
  type EntryTest,
  type Participant,
  type StatementClass,
  type PostRuled,
  type FramingView,
} from "@/domain/framing";
import { classifyContent, type ContentTier } from "@/domain/content-tier";
import { LIFECYCLE_FAMILIES } from "@/domain/lifecycle";
import { REGISTRY } from "@/domain/registry";
import { validExtractionSpan } from "@/domain/extraction-span";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type Db = Awaited<ReturnType<typeof admin>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function human(uid: string, authority = "observe") {
  return { kind: "human", id: uid, authority_used: authority };
}
function extractor(uid: string) {
  return {
    kind: "system",
    id: "thread.intent_extractor",
    authority_used: "observe",
    on_behalf_of: uid,
  };
}
function threadError(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
const uuid = z.string().uuid();
const today = (d = 30) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const familyOf = (type: string) =>
  REGISTRY.find((r) => r.type === type)?.lifecycle_family ?? "canon";

function payload(
  type: string,
  title: string,
  statement: string,
  body: Json,
  o: {
    owner: string;
    tier?: ContentTier | undefined;
    adapter_mode?: string | undefined;
    rationale?: string | undefined;
    risk?: string | undefined;
  },
) {
  return {
    type,
    title: title.slice(0, 200) || type,
    statement: statement.slice(0, 4000) || title,
    machine_description:
      `${type} captured in a framing session (Part 8A). Draft until confirmed.`.slice(0, 2000),
    body,
    review_date: today(30),
    expiration_condition: { kind: "review_date_passes" },
    retirement_path: { mode: "supersede" },
    risk_tier: o.risk ?? "2",
    owner_id: o.owner,
    permission: { roles: [], purpose: "framing session" },
    data_classification: o.tier === "B" ? "confidential" : "internal",
    rationale: o.rationale ?? "Extracted in a framing session",
    adapter_mode: o.adapter_mode,
  };
}
async function create(db: Db, actor: Json, p: Json): Promise<Row> {
  const { data, error } = await db.rpc("thread_create_object", {
    p_actor: actor as never,
    p: p as never,
  });
  if (error) throw threadError(error.message);
  return data;
}
async function load(db: Db, id: string): Promise<Row> {
  const { data, error } = await db.from("objects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw threadError("NOT_FOUND: " + id);
  return data;
}
async function reviseBody(
  db: Db,
  actor: Json,
  id: string,
  mut: (b: Row, o: Row) => Json,
  rationale: string,
  extra: Json = {},
): Promise<Row> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const o = await load(db, id);
    const { data, error } = await db.rpc("thread_revise_object", {
      p_actor: actor as never,
      p_id: id,
      p_expected_version: o.version,
      p_patch: { body: mut({ ...(o.body ?? {}) }, o), ...extra } as never,
      p_rationale: rationale,
    });
    if (!error) return data;
    if (!error.message.startsWith("VERSION_CONFLICT")) throw threadError(error.message);
  }
  throw threadError("VERSION_CONFLICT: retried three times");
}
async function transition(
  db: Db,
  actor: Json,
  id: string,
  to: string,
  rationale: string,
): Promise<Row> {
  const o = await load(db, id);
  const { data, error } = await db.rpc("thread_transition_object", {
    p_actor: actor as never,
    p_id: id,
    p_expected_version: o.version,
    p_to_state: to,
    p_rationale: rationale,
  });
  if (error) throw threadError(error.message);
  return data;
}
async function tombstone(db: Db, actor: Json, id: string, reason: string) {
  const o = await load(db, id);
  if (o.is_tombstone) return;
  const { error } = await db.rpc("thread_tombstone_object", {
    p_actor: actor as never,
    p_id: id,
    p_expected_version: o.version,
    p_reason: reason,
  });
  if (error) throw threadError(error.message);
}
async function edge(
  db: Db,
  actor: Json,
  e: {
    verb: string;
    from_id: string;
    to_id: string;
    source: string;
    rationale: string;
    kind?: string | null;
    confidence?: number | null;
  },
) {
  const { data, error } = await db.rpc("thread_create_edge", {
    p_actor: actor as never,
    p: e as never,
  });
  if (error) return { error: error.message };
  return { edge: data as Row };
}
async function timing(
  db: Db,
  session_id: string,
  statement_id: string | null,
  stage: string,
  ms: number,
) {
  await db
    .from("extraction_timings")
    .insert({ session_id, statement_id, stage, latency_ms: Math.max(0, Math.round(ms)) });
}
async function finding(
  db: Db,
  f: {
    session_id: string;
    kind: string;
    message: string;
    statement_id?: string | null;
    related_object_id?: string | null;
    payload?: Json;
    latency_ms?: number | null;
    state?: string;
  },
) {
  const { data } = await db
    .from("framing_live_findings")
    .insert({ ...f, payload: (f.payload ?? {}) as never })
    .select("id")
    .single();
  return data?.id as string | undefined;
}
async function modelMode(db: Db): Promise<string> {
  const { data } = await db
    .from("adapter_bindings")
    .select("mode")
    .eq("adapter", "ModelGateway")
    .eq("environment", "preview")
    .maybeSingle();
  return data?.mode ?? "simulated";
}
async function sweep(db: Db, uid: string) {
  try {
    await db.rpc("thread_framing_sweep", { p_actor: human(uid) as never });
  } catch {
    /* best effort */
  }
  try {
    await db.rpc("thread_refresh_graph_layout");
    await db.rpc("thread_graph_sweep", { p_actor: human(uid) as never });
  } catch {
    /* best effort */
  }
}

function participants(s: Row): Participant[] {
  return (s.body?.participants ?? []) as Participant[];
}
async function isSteward(db: Db, uid: string) {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", "steward")
    .maybeSingle();
  return !!data;
}
/** The caller must be the session's owner, a linked participant or a steward. */
async function loadSessionFor(db: Db, uid: string, id: string): Promise<Row> {
  const s = await load(db, id);
  if (s.type !== "FramingSession") throw threadError("NOT_FOUND: not a framing session");
  if (
    s.owner_id === uid ||
    participants(s).some((p) => p.user_id === uid) ||
    (await isSteward(db, uid))
  )
    return s;
  throw threadError(
    "AUTHORITY_INSUFFICIENT: only the session's participants and stewards act in it",
  );
}
function authorityParticipant(s: Row, uid: string) {
  return participants(s).find((p) => p.user_id === uid && p.decision_authority);
}

// ---------------------------------------------------------------- sessions

const ParticipantIn = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["co_creator", "builder", "participant", "third_party"]),
  decision_authority: z.boolean(),
  authority_domain: z.string().trim().max(120).optional().nullable(),
  link: z.enum(["me", "email", "none"]).default("none"),
  email: z.string().trim().email().max(255).optional().nullable(),
});

export const startFramingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        purpose: z.string().trim().min(3).max(500),
        mission_ref: z.string().trim().max(60).optional().nullable(),
        modalities: z.array(z.enum(MODALITIES)).min(1),
        participants: z.array(ParticipantIn).min(2).max(12),
        scheduled_duration_min: z.number().int().min(1).max(600).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const ps: Participant[] = [];
    for (const p of data.participants) {
      let user_id: string | null = null;
      if (p.link === "me") user_id = context.userId;
      if (p.link === "email" && p.email) {
        const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        user_id =
          list?.users.find((u) => u.email?.toLowerCase() === p.email!.toLowerCase())?.id ?? null;
        if (!user_id)
          throw threadError(
            `USER_NOT_FOUND: no THREAD account for ${p.email}; they need to sign up first`,
          );
      }
      ps.push({
        id: crypto.randomUUID(),
        name: p.name,
        role: p.role,
        decision_authority: p.decision_authority,
        authority_domain: p.authority_domain ?? null,
        user_id,
      });
    }
    const co = ps.find((p) => p.role === "co_creator");
    const bu = ps.find((p) => p.role === "builder");
    if (!co || !bu)
      throw threadError(
        "CO_CREATOR_AND_BUILDER_REQUIRED: name one Business Co-Creator and one Builder (8A.6)",
      );
    const body: Json = {
      mission_ref: data.mission_ref || null,
      co_creator: co.id,
      builder: bu.id,
      participants: ps,
      purpose: data.purpose,
      modalities: data.modalities,
      opened_at: null,
      closed_at: null,
      consent_ref: [],
      content_tier: "A",
      extraction_revision: 1,
      extractor_version: "xv1",
      entry_test: EMPTY_ENTRY_TEST,
      objects_proposed: 0,
      objects_confirmed: 0,
      material_items_awaiting_confirmation: 0,
      ...(data.scheduled_duration_min
        ? { scheduled_duration_min: data.scheduled_duration_min }
        : {}),
    };
    const s = await create(db, human(context.userId), {
      ...payload("FramingSession", data.purpose.slice(0, 120), data.purpose, body, {
        owner: context.userId,
        rationale: "Framing session started",
      }),
      co_creator_id: co.user_id ?? undefined,
      builder_id: bu.user_id ?? undefined,
    });
    await db.from("extraction_revisions").insert({
      session_id: s.id,
      revision: 1,
      extractor_version: "xv1",
      model_route: "intent.classify.xv1",
      adapter_mode: "none",
    });
    return { id: s.id as string, human_ref: s.human_ref as string };
  });

export const listFramingSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("objects")
      .select("id,human_ref,title,lifecycle_state,created_at,updated_at,body")
      .eq("type", "FramingSession")
      .eq("is_tombstone", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: Row) => ({
      id: s.id,
      ref: s.human_ref,
      title: s.title,
      state: s.lifecycle_state,
      created_at: s.created_at,
      entry_complete: entryTestComplete({ ...EMPTY_ENTRY_TEST, ...(s.body?.entry_test ?? {}) }),
      participants: (s.body?.participants ?? []).length,
    }));
  });

export const getFramingSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: s0, error } = await sb
      .from("objects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const s = s0 as Row;
    if (!s || s.type !== "FramingSession") return null;
    const [events, consents, objs, findings, revisions, timings, corrections] = await Promise.all([
      sb
        .from("session_events")
        .select("*")
        .eq("session_id", data.id)
        .order("t_offset_ms")
        .order("id")
        .limit(2000),
      sb.from("consent_records").select("*").eq("session_id", data.id),
      sb
        .from("objects")
        .select(
          "id,human_ref,type,title,statement,lifecycle_state,version,body,created_at,is_tombstone,data_classification",
        )
        .eq("body->>origin_session_ref", data.id)
        .order("created_at"),
      sb
        .from("framing_live_findings")
        .select("*")
        .eq("session_id", data.id)
        .order("created_at", { ascending: false }),
      sb.from("extraction_revisions").select("*").eq("session_id", data.id).order("revision"),
      sb.from("extraction_timings").select("stage,latency_ms").eq("session_id", data.id),
      sb
        .from("classification_corrections")
        .select("*")
        .eq("session_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    const artifacts = await sb
      .from("objects")
      .select("id,human_ref,title,lifecycle_state,body,created_at,is_tombstone")
      .eq("type", "CoCreationArtifact")
      .eq("body->>session_ref", data.id)
      .order("created_at");
    const lat: Record<string, { p95: number | null; n: number; budget: number }> = {};
    for (const st of Object.keys(LATENCY_BUDGETS) as Array<keyof typeof LATENCY_BUDGETS>) {
      const xs = (timings.data ?? []).filter((t) => t.stage === st).map((t) => t.latency_ms);
      lat[st] = { p95: p95(xs), n: xs.length, budget: LATENCY_BUDGETS[st] };
    }
    const entry: EntryTest = { ...EMPTY_ENTRY_TEST, ...(s.body?.entry_test ?? {}) };
    return {
      session: s,
      events: events.data ?? [],
      consents: consents.data ?? [],
      objects: objs.data ?? [],
      artifacts: artifacts.data ?? [],
      findings: findings.data ?? [],
      revisions: revisions.data ?? [],
      corrections: corrections.data ?? [],
      latency: lat,
      entry_test: {
        ...entry,
        complete: entryTestComplete(entry),
        sentence: entryTestSentence(entry),
      },
      me: context.userId,
    };
  });

export const recordConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        participant_id: uuid,
        modalities: z.array(z.enum(MODALITIES)).min(1),
        attestation: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const s = await loadSessionFor(db, context.userId, data.session_id);
    const p = participants(s).find((x) => x.id === data.participant_id);
    if (!p) throw threadError("NOT_FOUND: participant");
    // A linked participant consents for themselves; an unlinked one is attested by the session's Builder or owner.
    if (p.user_id && p.user_id !== context.userId)
      throw threadError(
        "CONSENT_SELF_ONLY: this participant has an account and records their own consent",
      );
    if (!p.user_id && !data.attestation)
      throw threadError("ATTESTATION_REQUIRED: say how this participant gave consent");
    const id = crypto.randomUUID();
    const { error } = await db.from("consent_records").insert({
      id,
      session_id: s.id,
      participant_id: p.id,
      modalities: data.modalities,
      granted_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await db.from("session_events").insert({
      session_id: s.id,
      t_offset_ms: 0,
      kind: "consent.recorded",
      speaker_id: null,
      ref: null,
      payload: {
        consent_id: id,
        participant: p.name,
        modalities: data.modalities,
        attested_by: p.user_id ? null : context.userId,
        attestation: data.attestation ?? null,
      },
    });
    await reviseBody(
      db,
      human(context.userId),
      s.id,
      (b) => ({ ...b, consent_ref: [...((b.consent_ref as string[]) ?? []), id] }),
      `Consent recorded for ${p.name}`,
    );
    return { id };
  });

export const withdrawConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid, consent_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    await loadSessionFor(db, context.userId, data.session_id);
    const { error } = await db
      .from("consent_records")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("id", data.consent_id)
      .eq("session_id", data.session_id);
    if (error) throw new Error(error.message);
    await db.from("session_events").insert({
      session_id: data.session_id,
      t_offset_ms: 0,
      kind: "consent.withdrawn",
      payload: { consent_id: data.consent_id },
    });
    return { ok: true };
  });

export const openCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const s = await loadSessionFor(db, context.userId, data.session_id);
    await reviseBody(
      db,
      human(context.userId),
      s.id,
      (b) => ({ ...b, opened_at: new Date().toISOString() }),
      "Capture opening",
    );
    await transition(
      db,
      human(context.userId),
      s.id,
      "capturing",
      "Consent recorded for every participant and modality",
    );
    await db
      .from("session_events")
      .insert({ session_id: s.id, t_offset_ms: 0, kind: "session.opened", payload: {} });
    return { ok: true };
  });

// ---------------------------------------------------------------- capture and extraction

interface ExtractCtx {
  db: Db;
  uid: string;
  session: Row;
  artifact: Row;
  tier: ContentTier;
  simulated: boolean;
  revision: number;
  version: "xv1" | "xv2";
  mode: string;
}
interface UnitIn {
  text: string;
  span: Json;
  speaker: Participant;
  segment_event_id?: number | null;
}

/** Classify units, create drafts, connect stated dependencies and surface prior objects and contradictions live. */
async function extractUnits(
  c: ExtractCtx,
  units: UnitIn[],
  t0: number,
  opts: { reextract_of?: Map<string, Row> } = {},
) {
  const discarded = units.filter((u) => !validExtractionSpan(u.span));
  for (const unit of discarded) {
    const { error } = await c.db.from("session_events").insert({
      session_id: c.session.id,
      t_offset_ms: 0,
      kind: "extraction_discarded",
      ref: c.artifact.id,
      payload: { reason: "PROVENANCE_SPAN_MISSING", extractor_version: c.version },
    });
    if (error) throw threadError(error.message);
  }
  units = units.filter((u) => validExtractionSpan(u.span));
  const { classifyUnits, findContradictions } = await import("@/server/framing/extractor");
  const { db, session } = c;
  const ps = participants(session);
  const actor = extractor(c.uid);
  const cls = await classifyUnits(
    units.map((u) => u.text),
    c.tier,
    c.version,
    c.mode,
    units.map(
      (u) => `${u.speaker.role}${u.speaker.decision_authority ? ", holds decision authority" : ""}`,
    ),
  );
  const created: Row[] = [];
  let entry: Partial<EntryTest> = {};
  const adapter_mode = c.simulated ? "simulated" : undefined;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const m = cls.units[i];
    if (!u || !m) continue;
    const r: PostRuled = applyPostRules(m, u.speaker, ps);
    entry = mergeEntryTest({ ...EMPTY_ENTRY_TEST, ...entry } as EntryTest, m.entry_test);
    const spans = [
      {
        ...u.span,
        artifact_id: c.artifact.id,
        segment_id: u.segment_event_id ?? null,
        speaker_id: u.speaker.id,
      },
    ];
    const prior = opts.reextract_of?.get(JSON.stringify([u.span["start"], u.span["end"]]));
    const xsBody: Json = {
      origin_session_ref: session.id,
      provenance_spans: spans,
      classification: r.classification,
      initial_classification: r.initial_classification,
      raw_text: u.text,
      speaker_actor: u.speaker.id,
      speaker_name: u.speaker.name,
      speaker_authority: {
        decision: u.speaker.decision_authority,
        domain: u.speaker.authority_domain ?? null,
        holder: ps.find((p) => p.decision_authority)?.name ?? null,
      },
      extractor: c.version,
      model_route: cls.route,
      model: cls.model,
      model_version: cls.model_version,
      confidence: r.confidence,
      material: r.material,
      proposed_object_type: r.object_type,
      kind: r.kind,
      extraction_revision: c.revision,
      resolved_object_ref: null,
      authority_mismatch: r.authority_mismatch,
      provenance: {
        simulated: c.simulated,
        adapter: c.simulated ? "Transcription.simulated" : null,
        classifier: cls.adapter_mode,
      },
      ...(prior ? { supersedes_candidate: prior.id } : {}),
    };
    const xs = await create(
      db,
      actor,
      payload("ExtractedStatement", r.title || u.text.slice(0, 80), u.text, xsBody, {
        owner: session.owner_id,
        tier: c.tier,
        adapter_mode,
      }),
    );
    await timing(db, session.id, xs.id, "extraction", Date.now() - t0);
    const edges: Promise<unknown>[] = [
      edge(db, actor, {
        verb: "extracted_from",
        from_id: xs.id,
        to_id: c.artifact.id,
        source: "stated",
        rationale: "Statement unit extracted from this artifact",
      }),
    ];
    if (prior)
      edges.push(
        edge(db, actor, {
          verb: "supersedes_statement",
          from_id: xs.id,
          to_id: prior.id,
          source: "resolved",
          rationale: `Re-extraction revision ${c.revision} proposes a successor; the prior confirmation stands`,
          confidence: 0.5,
        }),
      );
    let typed: Row | null = null;
    if (r.object_type && r.object_type !== "ConfirmedDecision") {
      typed = await create(
        db,
        actor,
        payload(
          r.object_type,
          r.title || u.text.slice(0, 80),
          u.text,
          typedBody(r, m, xs, session, spans, c, ps),
          { owner: session.owner_id, tier: c.tier, adapter_mode },
        ),
      );
      edges.push(
        edge(db, actor, {
          verb: "extracted_from",
          from_id: typed.id,
          to_id: c.artifact.id,
          source: "stated",
          rationale: "Extracted with provenance span",
        }),
      );
      edges.push(
        edge(db, actor, {
          verb: "clarifies",
          from_id: xs.id,
          to_id: typed.id,
          source: "decomposed",
          rationale: "The statement unit this draft came from",
        }),
      );
      if (r.object_type === "NeedStatement")
        edges.push(
          edge(db, actor, {
            verb: "articulated_in",
            from_id: typed.id,
            to_id: session.id,
            source: "stated",
            rationale: "Articulated in this session",
          }),
        );
      await reviseBody(
        db,
        actor,
        xs.id,
        (b) => ({ ...b, resolved_object_ref: typed!.id }),
        "Linked to its draft object",
      );
    }
    await Promise.all(edges);
    if (r.authority_mismatch)
      await finding(db, {
        session_id: session.id,
        kind: "authority_mismatch",
        statement_id: xs.id,
        message: r.authority_mismatch,
        payload: { speaker: u.speaker.name, model_class: r.initial_classification },
        latency_ms: Date.now() - t0,
        state: "resolved",
      });
    if (r.materiality_question)
      await finding(db, {
        session_id: session.id,
        kind: "materiality_question",
        statement_id: xs.id,
        message: r.materiality_question,
        payload: { quote: u.text },
        latency_ms: Date.now() - t0,
      });
    // Stated dependency: explicit statement auto-links with provenance, marked as stated (8A.7.1)
    const dep = statedDependency(u.text);
    if (dep && typed && ["NeedStatement", "BehaviorStatement"].includes(typed.type)) {
      const { data: cands } = await db
        .from("objects")
        .select("id,human_ref,type,title,statement")
        .eq("body->>origin_session_ref", session.id)
        .in("type", ["NeedStatement", "BehaviorStatement"])
        .eq("is_tombstone", false)
        .neq("id", typed.id);
      const best = (cands ?? [])
        .map((o: Row) => ({ o, s: overlap(u.text, `${o.title} ${o.statement}`) }))
        .filter((x) => x.s > 0.2)
        .sort((a, b) => b.s - a.s)[0];
      if (best) {
        const e = await edge(db, actor, {
          verb: "depends_on",
          from_id: typed.id,
          to_id: best.o.id,
          source: "stated",
          kind: dep.kind,
          confidence: 0.9,
          rationale: `Stated in the session: "${u.text.slice(0, 200)}"`,
        });
        await finding(db, {
          session_id: session.id,
          kind: "dependency_proposed",
          statement_id: xs.id,
          related_object_id: best.o.id,
          message: `Stated dependency recorded: ${typed.human_ref} depends on ${best.o.human_ref} (${dep.kind}).`,
          payload: {
            origin: "stated",
            edge_id: (e as Row).edge?.id ?? null,
            error: (e as Row).error ?? null,
            quote: u.text,
          },
          latency_ms: Date.now() - t0,
          state: (e as Row).edge ? "resolved" : "open",
        });
      }
    } else if (typed && ["NeedStatement", "BehaviorStatement"].includes(typed.type)) {
      // Co-occurrence / decomposition proposals: never auto-confirmed
      const { data: cands } = await db
        .from("objects")
        .select("id,human_ref,type,title,statement")
        .eq("body->>origin_session_ref", session.id)
        .in("type", ["NeedStatement", "BehaviorStatement"])
        .eq("is_tombstone", false)
        .neq("id", typed.id)
        .limit(200);
      const best = (cands ?? [])
        .map((o: Row) => ({ o, s: overlap(u.text, `${o.title} ${o.statement}`) }))
        .filter((x) => x.s >= 0.34)
        .sort((a, b) => b.s - a.s)[0];
      if (best) {
        const isDecomp = best.o.type === "NeedStatement" && typed.type === "BehaviorStatement";
        await finding(db, {
          session_id: session.id,
          kind: "dependency_proposed",
          statement_id: xs.id,
          related_object_id: best.o.id,
          message: isDecomp
            ? `Proposed: ${best.o.human_ref} is expressed as ${typed.human_ref} (decomposition).`
            : `Proposed: ${typed.human_ref} relates to ${best.o.human_ref} (co-occurrence).`,
          payload: {
            origin: isDecomp ? "decomposed" : "co_occurrence",
            verb: isDecomp ? "expressed_as" : "relates_to",
            from_id: isDecomp ? best.o.id : typed.id,
            to_id: isDecomp ? typed.id : best.o.id,
            confidence: isDecomp ? 0.7 : 0.5,
            quote: u.text,
          },
        });
      }
    }
    if (r.object_type && r.classification !== "context")
      await surface(c, xs, typed, u.text, r, t0, findContradictions);
    created.push({ xs, typed, post: r });
  }
  return { created, cls, entry };
}

function typedBody(
  r: PostRuled,
  m: Row,
  xs: Row,
  session: Row,
  spans: Json[],
  c: ExtractCtx,
  ps: Participant[],
): Json {
  const base: Json = {
    origin_session_ref: session.id,
    provenance_spans: spans,
    source_statement_id: xs.id,
    extractor: c.version,
    model_version: xs.body.model_version,
    confidence: r.confidence,
    material: r.material,
    classification: r.classification,
    provenance: { simulated: c.simulated },
  };
  const holder = ps.find((p) => p.decision_authority);
  switch (r.object_type) {
    case "NeedStatement":
      return {
        ...base,
        statement: xs.statement,
        observed_condition: m.observed_condition,
        requested_solution_candidates: m.requested_solution ? [m.requested_solution] : [],
        affected_population: [],
        affected_situations: [],
        measurable_character: m.measurable_character,
        baseline: null,
        target: null,
        value_hypothesis: null,
        authority_holder: holder?.id ?? null,
        origin_session: session.id,
        status: "articulated",
        behavior_statements: [],
        capability_refs: [],
        dependencies: [],
      };
    case "BehaviorStatement":
      return {
        ...base,
        kind: r.kind,
        condition: m.observed_condition,
        observable_result: null,
        operating_constraints: [],
        confirmation: null,
        verification_status: "unverified",
      };
    case "Assumption":
      return {
        ...base,
        statement: xs.statement,
        basis: "stated in session",
        verification_method: "proposed: verify against production data before relying on it",
        status: "unverified",
        verification_attempts: [],
      };
    case "OpenQuestion":
      return {
        ...base,
        question: xs.statement,
        why_it_matters: null,
        blocking: false,
        owner: holder?.id ?? null,
        needed_by: null,
      };
    default:
      return base;
  }
}

/** Live surfacing (8A.7.4): prior needs, decisions, behaviours, capabilities, disproven assumptions and contradictions. */
async function surface(
  c: ExtractCtx,
  xs: Row,
  typed: Row | null,
  text: string,
  r: PostRuled,
  t0: number,
  findContradictions: (
    t: string,
    p: Array<{ text: string }>,
    tier: ContentTier,
    mode: string,
  ) => Promise<Array<{ index: number; explanation: string; method: string }>>,
) {
  const { db, session } = c;
  const types = [
    "NeedStatement",
    "ConfirmedDecision",
    "BehaviorStatement",
    "Assumption",
    "Constraint",
    "NonNegotiableConsequence",
  ];
  const [rel, caps] = await Promise.all([
    db.rpc("framing_related_objects", {
      p_text: text,
      p_session: session.id,
      p_types: types,
      p_limit: 8,
    }),
    (async () => {
      const t = Date.now();
      const q = await db.rpc("framing_related_objects", {
        p_text: text,
        p_session: session.id,
        p_types: ["ComposableCapability"],
        p_limit: 3,
      });
      return { q, ms: Date.now() - t };
    })(),
  ]);
  const related = ((rel.data ?? []) as Row[]).filter((o) => o.id !== typed?.id);
  await timing(db, session.id, xs.id, "prior_surfacing", Date.now() - t0);
  await timing(db, session.id, xs.id, "capability_reuse", caps.ms);
  for (const cap of (caps.q.data ?? []) as Row[]) {
    await finding(db, {
      session_id: session.id,
      kind: "capability_reuse",
      statement_id: xs.id,
      related_object_id: cap.id,
      latency_ms: caps.ms,
      message: `A capability that performs most of this exists — ${cap.ref} "${cap.title}". Would you like to experience it before creating anything?`,
      payload: { ref: cap.ref, score: cap.score },
    });
  }
  const kindFor = (o: Row) =>
    o.type === "NeedStatement"
      ? "prior_need"
      : o.type === "ConfirmedDecision"
        ? "prior_decision"
        : o.type === "Assumption" && o.status === "disproven"
          ? "disproven_assumption"
          : o.type === "BehaviorStatement"
            ? "prior_behavior"
            : null;
  for (const o of related.slice(0, 3)) {
    const k = kindFor(o);
    if (!k) continue;
    const { data: seen } = await db
      .from("framing_live_findings")
      .select("id")
      .eq("session_id", session.id)
      .eq("related_object_id", o.id)
      .eq("kind", k)
      .limit(1);
    if (seen?.length) continue;
    const when = new Date(o.created_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const msg =
      k === "prior_need"
        ? `You articulated a closely related need${o.session_human_ref ? ` in ${o.session_human_ref}` : ""} on ${when}: ${o.ref} "${o.title}".`
        : k === "prior_decision"
          ? `This was decided on ${when}: ${o.ref} "${o.statement}"${o.confirmation?.actor_name ? `, by ${o.confirmation.actor_name}` : ""}${o.confirmation?.authority_used ? ` under ${o.confirmation.authority_used}` : ""}.`
          : k === "prior_behavior"
            ? `This behaviour was ${o.state === "proposed" ? "proposed" : "confirmed"} in an earlier session: ${o.ref} "${o.title}" (${o.state}).`
            : `An assumption underlying this was disproven: ${o.ref} "${o.title}".`;
    await finding(db, {
      session_id: session.id,
      kind: k,
      statement_id: xs.id,
      related_object_id: o.id,
      message: msg,
      latency_ms: Date.now() - t0,
      payload: { ref: o.ref, score: o.score, prior_session_ref: o.session_ref },
    });
  }
  // Contradictions: only against confirmed material from earlier sessions and this one
  if (["decision", "confirmed_behavior", "suggestion", "assumption"].includes(r.classification)) {
    const { data: sameSession } = await db
      .from("objects")
      .select("id,human_ref,type,title,statement,lifecycle_state,created_at,body")
      .eq("body->>origin_session_ref", session.id)
      .in("lifecycle_state", ["confirmed", "active", "recorded"])
      .eq("is_tombstone", false)
      .neq("type", "ExtractedStatement")
      .limit(30);
    const priors = [
      ...related
        .filter(
          (o) =>
            ["active", "recorded", "confirmed"].includes(o.state) || o.type === "ConfirmedDecision",
        )
        .map((o) => ({
          id: o.id,
          ref: o.ref,
          text: o.statement,
          session_ref: o.session_ref,
          session_human_ref: o.session_human_ref,
          created_at: o.created_at,
          by: o.confirmation?.actor_name ?? null,
        })),
      ...((sameSession ?? []) as Row[])
        .filter((o) => o.id !== typed?.id)
        .map((o) => ({
          id: o.id,
          ref: o.human_ref,
          text: o.statement,
          session_ref: session.id,
          session_human_ref: session.human_ref,
          created_at: o.created_at,
          by: o.body?.confirmation?.actor_name ?? null,
        })),
    ].slice(0, 10);
    const hits = await findContradictions(text, priors, c.tier, c.mode);
    const ms = Date.now() - t0;
    await timing(db, session.id, xs.id, "contradiction", ms);
    for (const h of hits) {
      const p = priors[h.index]!;
      const when = new Date(p.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await finding(db, {
        session_id: session.id,
        kind: "contradiction",
        statement_id: xs.id,
        related_object_id: p.id,
        latency_ms: ms,
        message: `This conflicts with ${p.ref} recorded on ${when}${p.session_human_ref && p.session_ref !== session.id ? ` in ${p.session_human_ref}` : ""}: "${p.text}". Which stands?`,
        payload: {
          new_quote: text,
          prior_quote: p.text,
          prior_ref: p.ref,
          prior_session_ref: p.session_ref,
          explanation: h.explanation,
          method: h.method,
          by: p.by,
        },
      });
    }
  }
}

const utteranceInput = z.object({
  session_id: uuid,
  speaker_id: uuid,
  text: z.string().trim().min(1).max(4000),
  mode: z.enum([
    "speech",
    "typed_notes",
    "chat",
    "prototype_interaction",
    "brought_in_document",
    "third_party_recording",
  ]),
  t_offset_ms: z.number().int().min(0),
  client_id: z.string().max(80).optional(),
});
type UtteranceInput = z.infer<typeof utteranceInput>;

/**
 * Shared capture pipeline (8A.3): consent/tier gate -> artifact -> segment -> extract.
 * `transcription` marks speech as coming from the simulated fixture adapter or the
 * live Whisper-class adapter; text modalities are always direct input.
 */
async function captureUtteranceImpl(
  uid: string,
  data: UtteranceInput,
  transcription: "simulated" | "live",
) {
  const t0 = Date.now();
  const db = await admin();
  const session = await loadSessionFor(db, uid, data.session_id);
  if (session.lifecycle_state !== "capturing")
    throw threadError(`CAPTURE_NOT_OPEN: ${session.human_ref} is ${session.lifecycle_state}`);
  const speaker = participants(session).find((p) => p.id === data.speaker_id);
  if (!speaker) throw threadError("NOT_FOUND: speaker is not a participant");
  if (data.client_id) {
    const { data: dup } = await db
      .from("session_events")
      .select("id")
      .eq("session_id", session.id)
      .eq("payload->>client_id", data.client_id)
      .limit(1);
    if (dup?.length) return { duplicate: true, blocked: false, statements: 0 };
  }
  // Consent and tier gate BEFORE any model call (8A.3)
  const tier = classifyContent(data.text);
  if (tier.tier === "C") {
    await db.from("session_events").insert({
      session_id: session.id,
      t_offset_ms: data.t_offset_ms,
      kind: "capture.blocked",
      speaker_id: null,
      payload: {
        tier: "C",
        reasons: tier.reasons,
        client_id: data.client_id ?? null,
        speaker: speaker.name,
      },
    });
    return { duplicate: false, blocked: true, reasons: tier.reasons, statements: 0 };
  }
  const kind: ArtifactKind = data.mode === "speech" ? "transcript" : data.mode;
  const simulated = data.mode === "speech" && transcription === "simulated";
  const { data: consents } = await db
    .from("consent_records")
    .select("id")
    .eq("session_id", session.id)
    .is("withdrawn_at", null);
  const consentIds = (consents ?? []).map((x) => x.id);
  const artifact = await create(
    db,
    extractor(uid),
    payload(
      "CoCreationArtifact",
      `${kind.replace(/_/g, " ")} · ${speaker.name}`,
      data.text.slice(0, 200),
      {
        session_ref: session.id,
        kind,
        media_ref: null,
        content: data.text,
        duration_or_size: data.text.length,
        captured_at: new Date().toISOString(),
        captured_by: uid,
        speaker_id: speaker.id,
        content_tier: tier.tier,
        consent_basis: consentIds,
        extraction_state: "pending",
        evidence_weight: evidenceWeight(kind),
        provenance: {
          simulated,
          adapter: simulated
            ? "Transcription.simulated"
            : transcription === "live"
              ? "Transcription.live"
              : null,
        },
      },
      {
        owner: session.owner_id,
        tier: tier.tier,
        adapter_mode: simulated ? "simulated" : transcription === "live" ? "live" : undefined,
        rationale: "Captured on the session timeline",
      },
    ),
  );
  // Normalise + segment: speech through the Transcription adapter; text by statement units
  const units: UnitIn[] = [];
  if (simulated) {
    const { simulatedTranscription } = await import("@/server/adapters/transcription/simulated");
    const tr = simulatedTranscription();
    const sid = tr.startStream(session.id, consentIds);
    tr.pushAudio(sid, { speaker_id: speaker.id, text: data.text, t_offset_ms: data.t_offset_ms });
    for (const sg of tr.finalize(sid)) {
      const { data: ev } = await db
        .from("session_events")
        .insert({
          session_id: session.id,
          t_offset_ms: sg.t_start,
          kind: "segment",
          speaker_id: null,
          ref: artifact.id,
          payload: {
            text: sg.text,
            t_end: sg.t_end,
            speaker: speaker.id,
            speaker_name: speaker.name,
            tier: tier.tier,
            simulated: true,
            client_id: data.client_id ?? null,
          },
        })
        .select("id")
        .single();
      units.push({
        text: sg.text,
        span: { kind: "time_range", start: sg.t_start, end: sg.t_end },
        speaker,
        segment_event_id: ev?.id ?? null,
      });
    }
  } else {
    for (const u of segment(data.text)) {
      const { data: ev } = await db
        .from("session_events")
        .insert({
          session_id: session.id,
          t_offset_ms: data.t_offset_ms,
          kind: "segment",
          speaker_id: null,
          ref: artifact.id,
          payload: {
            text: u.text,
            char_start: u.start,
            char_end: u.end,
            speaker: speaker.id,
            speaker_name: speaker.name,
            tier: tier.tier,
            mode: data.mode,
            client_id: data.client_id ?? null,
          },
        })
        .select("id")
        .single();
      units.push({
        text: u.text,
        span: {
          kind: data.mode === "prototype_interaction" ? "log_offset" : "char_range",
          start: u.start,
          end: u.end,
        },
        speaker,
        segment_event_id: ev?.id ?? null,
      });
    }
  }
  const mode = await modelMode(db);
  const revision = (session.body?.extraction_revision as number) ?? 1;
  const version = (session.body?.extractor_version as "xv1" | "xv2") ?? "xv1";
  const out = await extractUnits(
    {
      db,
      uid: uid,
      session,
      artifact,
      tier: tier.tier,
      simulated,
      revision,
      version,
      mode,
    },
    units,
    t0,
  );
  await reviseBody(
    db,
    extractor(uid),
    artifact.id,
    (b) => ({ ...b, extraction_state: "extracted", extraction_revision: revision }),
    "Extracted",
  );
  await reviseBody(
    db,
    extractor(uid),
    session.id,
    (b) => {
      const e = mergeEntryTest(
        { ...EMPTY_ENTRY_TEST, ...((b.entry_test as EntryTest) ?? {}) },
        out.entry,
      );
      return {
        ...b,
        entry_test: e,
        content_tier: maxTier(b.content_tier as ContentTier, tier.tier),
        objects_proposed: ((b.objects_proposed as number) ?? 0) + out.created.length,
      };
    },
    "Live extraction update",
  );
  await db
    .from("extraction_revisions")
    .update({
      model_route: out.cls.route,
      model: out.cls.model,
      adapter_mode: out.cls.adapter_mode === "none" ? "none" : out.cls.adapter_mode,
    })
    .eq("session_id", session.id)
    .eq("revision", revision);
  return {
    duplicate: false,
    blocked: false,
    statements: out.created.length,
    tier: tier.tier,
    model: out.cls.model,
    route: out.cls.route,
    model_error: out.cls.error ?? null,
    latency_ms: Date.now() - t0,
  };
}

export const captureUtterance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => utteranceInput.parse(d))
  .handler(async ({ data, context }) => captureUtteranceImpl(context.userId, data, "simulated"));

/**
 * Live speech capture (8A.2 live speech, 8A.13 zero-loss): the browser uploads a complete
 * WAV chunk; the server transcribes it through the live Whisper-class adapter and runs the
 * same consent-gated pipeline. Speaker identity is the authenticated participant's chosen
 * participant record — never guessed from audio. No silent fallback to simulated: a
 * transcription failure is surfaced, and the client keeps the audio buffered for retry.
 */
export const captureLiveSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        speaker_id: uuid,
        audio_wav_base64: z.string().min(100).max(28_000_000),
        t_offset_ms: z.number().int().min(0),
        client_id: z.string().max(80).optional(),
        language: z.string().max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { transcribeAudio } = await import("@/server/adapters/transcription/live.server");
    const bin = atob(data.audio_wav_base64);
    const wav = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) wav[i] = bin.charCodeAt(i);
    const transcript = await transcribeAudio(wav, data.language ? { language: data.language } : {});
    const out = await captureUtteranceImpl(
      context.userId,
      {
        session_id: data.session_id,
        speaker_id: data.speaker_id,
        text: transcript.text.slice(0, 4000),
        mode: "speech",
        t_offset_ms: data.t_offset_ms,
        client_id: data.client_id,
      },
      "live",
    );
    return { ...out, transcript: transcript.text, transcribe_model: transcript.model };
  });

function maxTier(a: ContentTier | undefined, b: ContentTier): ContentTier {
  const o = { A: 0, B: 1, C: 2 };
  return (o[a ?? "A"] ?? 0) >= o[b] ? (a ?? "A") : b;
}

export const captureImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        speaker_id: uuid,
        kind: z.enum(["whiteboard", "diagram", "screen_capture"]),
        t_offset_ms: z.number().int().min(0),
        data_url: z
          .string()
          .regex(/^data:image\/(png|jpeg|webp);base64,/)
          .max(7_000_000),
        name: z.string().max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const db = await admin();
    const session = await loadSessionFor(db, context.userId, data.session_id);
    if (session.lifecycle_state !== "capturing") throw threadError("CAPTURE_NOT_OPEN");
    const speaker = participants(session).find((p) => p.id === data.speaker_id);
    if (!speaker) throw threadError("NOT_FOUND: participant");
    const mime = data.data_url.slice(5, data.data_url.indexOf(";"));
    const bytes = Uint8Array.from(atob(data.data_url.split(",")[1]!), (ch) => ch.charCodeAt(0));
    const path = `${session.id}/${crypto.randomUUID()}.${mime.split("/")[1]}`;
    const up = await db.storage.from("artifacts").upload(path, bytes, { contentType: mime });
    if (up.error) throw new Error(up.error.message);
    const { data: consents } = await db
      .from("consent_records")
      .select("id")
      .eq("session_id", session.id)
      .is("withdrawn_at", null);
    const artifact = await create(
      db,
      extractor(context.userId),
      payload(
        "CoCreationArtifact",
        `${data.kind.replace("_", " ")} · ${data.name}`,
        `Image captured: ${data.name}`,
        {
          session_ref: session.id,
          kind: data.kind,
          media_ref: path,
          duration_or_size: bytes.length,
          captured_at: new Date().toISOString(),
          captured_by: context.userId,
          speaker_id: speaker.id,
          content_tier: "A",
          consent_basis: (consents ?? []).map((x) => x.id),
          extraction_state: "pending",
          evidence_weight: evidenceWeight(data.kind),
          provenance: { simulated: false },
        },
        { owner: session.owner_id, rationale: "Drawing captured on the session timeline" },
      ),
    );
    const { describeDrawing } = await import("@/server/framing/extractor");
    const mode = await modelMode(db);
    let desc: Awaited<ReturnType<typeof describeDrawing>> = null;
    try {
      desc = await describeDrawing(data.data_url, mode);
    } catch (e) {
      await reviseBody(
        db,
        extractor(context.userId),
        artifact.id,
        (b) => ({ ...b, extraction_state: "failed", failure: (e as Error).message }),
        "Drawing description failed",
      );
      throw threadError(`MODEL_UNAVAILABLE: ${(e as Error).message}`);
    }
    if (!desc) {
      await reviseBody(
        db,
        extractor(context.userId),
        artifact.id,
        (b) => ({ ...b, extraction_state: "failed", failure: "model route not live" }),
        "No live model route",
      );
      return { statements: 0 };
    }
    const tier = classifyContent(
      desc.description + " " + desc.statements.map((s) => s.text).join(" "),
    );
    if (tier.tier === "C") {
      await reviseBody(
        db,
        extractor(context.userId),
        artifact.id,
        (b) => ({ ...b, extraction_state: "failed", failure: "Tier C content in the drawing" }),
        "Tier C",
      );
      return { statements: 0, blocked: true };
    }
    const units: UnitIn[] = [];
    for (const s of desc.statements) {
      const { data: ev } = await db
        .from("session_events")
        .insert({
          session_id: session.id,
          t_offset_ms: data.t_offset_ms,
          kind: "segment",
          ref: artifact.id,
          payload: {
            text: s.text,
            region: s.region,
            speaker: speaker.id,
            speaker_name: speaker.name,
            mode: data.kind,
          },
        })
        .select("id")
        .single();
      units.push({
        text: s.text,
        span: {
          kind: "region",
          start: [s.region.x, s.region.y],
          end: [s.region.x + s.region.w, s.region.y + s.region.h],
        },
        speaker,
        segment_event_id: ev?.id ?? null,
      });
    }
    const revision = (session.body?.extraction_revision as number) ?? 1;
    const out = await extractUnits(
      {
        db,
        uid: context.userId,
        session,
        artifact,
        tier: tier.tier,
        simulated: false,
        revision,
        version: session.body?.extractor_version ?? "xv1",
        mode,
      },
      units,
      t0,
    );
    await reviseBody(
      db,
      extractor(context.userId),
      artifact.id,
      (b) => ({
        ...b,
        extraction_state: "extracted",
        description: desc!.description,
        extraction_revision: revision,
      }),
      "Drawing extracted",
    );
    return { statements: out.created.length };
  });

export const getArtifactUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const a = await load(db, data.id);
    await loadSessionFor(db, context.userId, a.body.session_ref);
    if (!a.body.media_ref) return null;
    const { data: u } = await db.storage.from("artifacts").createSignedUrl(a.body.media_ref, 600);
    return u?.signedUrl ?? null;
  });

// ---------------------------------------------------------------- correction, confirmation, review

export const classifyStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        statement_id: uuid,
        classification: z.enum(CLASSES),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const xs = await load(db, data.statement_id);
    if (xs.type !== "ExtractedStatement") throw threadError("NOT_FOUND: not a statement");
    const session = await loadSessionFor(db, context.userId, xs.body.origin_session_ref);
    if (xs.lifecycle_state !== "draft")
      throw threadError(
        `CONFIRMATION_PRESERVED: ${xs.human_ref} is ${xs.lifecycle_state}; re-classification applies to drafts`,
      );
    const from = xs.body.classification as StatementClass;
    if (from === data.classification) return { ok: true };
    const ps = participants(session);
    const speaker = ps.find((p) => p.id === xs.body.speaker_actor) ?? {
      id: "",
      name: "unknown",
      role: "participant" as const,
      decision_authority: false,
    };
    const r = applyPostRules(
      {
        classification: data.classification,
        object_type: xs.body.proposed_object_type ?? null,
        kind: xs.body.kind ?? null,
        materiality_uncertain: false,
        confidence: 1,
        title: xs.title,
      },
      speaker,
      ps,
    );
    if (r.classification !== data.classification)
      throw threadError(`DECISION_WITHOUT_AUTHORITY: ${r.authority_mismatch}`);
    const actor = human(context.userId);
    // Retire the old draft object; a re-classified unit gets a new typed draft
    if (xs.body.resolved_object_ref) {
      const old = await load(db, xs.body.resolved_object_ref);
      if (!["draft", "proposed"].includes(old.lifecycle_state))
        throw threadError(`CONFIRMATION_PRESERVED: ${old.human_ref} is ${old.lifecycle_state}`);
      await tombstone(
        db,
        extractor(context.userId),
        old.id,
        `Re-classified from ${from} to ${data.classification} by a human`,
      );
    }
    const updated = await reviseBody(
      db,
      actor,
      xs.id,
      (b, o) => ({
        ...b,
        classification: r.classification,
        proposed_object_type: r.object_type,
        kind: r.kind,
        material: r.material,
        resolved_object_ref: null,
        classification_change: {
          by_kind: "human",
          by: context.userId,
          from,
          to: r.classification,
          version: o.version + 1,
          at: new Date().toISOString(),
          note: data.note ?? null,
        },
      }),
      `Re-classified ${from} → ${r.classification}`,
    );
    await db.from("classification_corrections").insert({
      statement_id: xs.id,
      session_id: session.id,
      from_class: from,
      to_class: r.classification,
      by_actor: context.userId,
      note: data.note ?? null,
    });
    if (r.object_type && r.object_type !== "ConfirmedDecision") {
      const spans = updated.body.provenance_spans;
      const sim = !!updated.body.provenance?.simulated;
      const typed = await create(
        db,
        extractor(context.userId),
        payload(
          r.object_type,
          xs.title,
          xs.statement,
          typedBody(
            r,
            { observed_condition: null, requested_solution: null, measurable_character: null },
            updated,
            session,
            spans,
            { simulated: sim, version: updated.body.extractor } as ExtractCtx,
            ps,
          ),
          {
            owner: session.owner_id,
            adapter_mode: sim ? "simulated" : undefined,
            rationale: "Re-classified by a human",
          },
        ),
      );
      await Promise.all([
        edge(db, extractor(context.userId), {
          verb: "clarifies",
          from_id: xs.id,
          to_id: typed.id,
          source: "decomposed",
          rationale: "Re-classified statement unit",
        }),
        edge(db, extractor(context.userId), {
          verb: "extracted_from",
          from_id: typed.id,
          to_id: spans[0].artifact_id,
          source: "stated",
          rationale: "Extracted with provenance span",
        }),
        r.object_type === "NeedStatement"
          ? edge(db, extractor(context.userId), {
              verb: "articulated_in",
              from_id: typed.id,
              to_id: session.id,
              source: "stated",
              rationale: "Articulated in this session",
            })
          : Promise.resolve(),
      ]);
      await reviseBody(
        db,
        extractor(context.userId),
        xs.id,
        (b) => ({ ...b, resolved_object_ref: typed.id }),
        "Linked to its draft object",
      );
    }
    return { ok: true };
  });

/** Confirmation is a recorded decision on the object — not an approval queue (8A.10). */
export const confirmObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        statement_id: uuid,
        title: z.string().trim().min(1).max(200).optional(),
        statement: z.string().trim().min(1).max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const xs = await load(db, data.statement_id);
    const session = await loadSessionFor(db, context.userId, xs.body.origin_session_ref);
    if (xs.lifecycle_state !== "draft")
      throw threadError(`ALREADY_${xs.lifecycle_state.toUpperCase()}: ${xs.human_ref}`);
    const ap = authorityParticipant(session, context.userId);
    const me = participants(session).find((p) => p.user_id === context.userId);
    const needsAuthority =
      xs.body.material ||
      xs.body.classification === "decision" ||
      xs.body.proposed_object_type === "NeedStatement";
    if (needsAuthority && !ap)
      throw threadError(
        "AUTHORITY_REQUIRED_TO_CONFIRM: material items and needs are confirmed only by the participant holding decision authority (8A.10)",
      );
    if (!me) throw threadError("PARTICIPANT_REQUIRED: only a session participant confirms");
    const authority_used = needsAuthority ? "act_with_confirmation" : "observe";
    const conf = {
      actor_id: context.userId,
      actor_name: me.name,
      authority_used,
      at: new Date().toISOString(),
      authority_domain: me.authority_domain ?? null,
    };
    const actor = human(context.userId, authority_used);
    let resolved = xs.body.resolved_object_ref as string | null;
    if (xs.body.classification === "decision") {
      const d = await create(
        db,
        actor,
        payload(
          "ConfirmedDecision",
          data.title ?? xs.title,
          data.statement ?? xs.statement,
          {
            origin_session_ref: session.id,
            provenance_spans: xs.body.provenance_spans,
            source_statement_id: xs.id,
            decision: data.statement ?? xs.statement,
            decided_by: context.userId,
            authority_used,
            material: true,
            confirmation: conf,
            provenance: { simulated: false },
          },
          { owner: context.userId, rationale: "Decision confirmed by its authority holder" },
        ),
      );
      await Promise.all([
        edge(db, actor, {
          verb: "clarifies",
          from_id: xs.id,
          to_id: d.id,
          source: "stated",
          rationale: "Decision stated in the session",
        }),
        edge(db, actor, {
          verb: "extracted_from",
          from_id: d.id,
          to_id: xs.body.provenance_spans[0].artifact_id,
          source: "stated",
          rationale: "Decision provenance",
        }),
      ]);
      resolved = d.id;
    } else if (resolved) {
      const t = await load(db, resolved);
      await reviseBody(
        db,
        actor,
        t.id,
        (b) => ({
          ...b,
          confirmation: conf,
          ...(data.statement ? { edited_statement: data.statement } : {}),
        }),
        "Confirmation recorded",
        {
          ...(data.title ? { title: data.title } : {}),
          ...(data.statement ? { statement: data.statement } : {}),
        },
      );
      const target = confirmedState(familyOf(t.type));
      await transition(db, actor, t.id, target, "Confirmed in the framing session");
    }
    await reviseBody(
      db,
      actor,
      xs.id,
      (b) => ({ ...b, confirmation: conf, resolved_object_ref: resolved }),
      "Confirmation recorded",
    );
    await transition(db, actor, xs.id, "confirmed", "Confirmed in the framing session");
    await reviseBody(
      db,
      extractor(context.userId),
      session.id,
      (b) => ({ ...b, objects_confirmed: ((b.objects_confirmed as number) ?? 0) + 1 }),
      "Confirmation count",
    );
    return { ok: true, object_id: resolved };
  });

export const rejectObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ statement_id: uuid, reason: z.string().trim().min(1).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const xs = await load(db, data.statement_id);
    await loadSessionFor(db, context.userId, xs.body.origin_session_ref);
    if (xs.lifecycle_state !== "draft")
      throw threadError(`CONFIRMATION_PRESERVED: ${xs.human_ref} is ${xs.lifecycle_state}`);
    if (xs.body.resolved_object_ref)
      await tombstone(
        db,
        extractor(context.userId),
        xs.body.resolved_object_ref,
        `Rejected in review: ${data.reason}`,
      );
    await reviseBody(
      db,
      human(context.userId),
      xs.id,
      (b) => ({
        ...b,
        rejection: { by: context.userId, reason: data.reason, at: new Date().toISOString() },
      }),
      "Rejected",
    );
    await transition(db, human(context.userId), xs.id, "rejected", data.reason);
    return { ok: true };
  });

export const deferObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        statement_id: uuid,
        owner_participant_id: uuid,
        due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().trim().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const xs = await load(db, data.statement_id);
    const s = await loadSessionFor(db, context.userId, xs.body.origin_session_ref);
    const owner = participants(s).find((p) => p.id === data.owner_participant_id);
    if (!owner) throw threadError("OWNER_REQUIRED: a deferral names an owner");
    await reviseBody(
      db,
      human(context.userId),
      xs.id,
      (b) => ({
        ...b,
        deferral: {
          owner: owner.id,
          owner_name: owner.name,
          due: data.due,
          reason: data.reason,
          by: context.userId,
          at: new Date().toISOString(),
        },
      }),
      "Explicitly deferred",
    );
    return { ok: true };
  });

export const resolveFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        finding_id: uuid,
        action: z.enum([
          "link",
          "supersede",
          "dismiss",
          "prior_stands",
          "new_stands",
          "defer",
          "accepted_ambiguity",
          "yes_record",
          "no_keep",
          "confirm_relationship",
          "discard_relationship",
          "experience_first",
        ]),
        owner_participant_id: uuid.optional(),
        due: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: f } = await db
      .from("framing_live_findings")
      .select("*")
      .eq("id", data.finding_id)
      .maybeSingle();
    if (!f) throw threadError("NOT_FOUND: finding");
    const s = await loadSessionFor(db, context.userId, f.session_id);
    const actor = human(context.userId);
    const xs = f.statement_id ? await load(db, f.statement_id) : null;
    const typedId = (xs?.body?.resolved_object_ref as string | null) ?? null;
    let state = "resolved";
    let resolution: Json = {
      action: data.action,
      by: context.userId,
      at: new Date().toISOString(),
      note: data.note ?? null,
    };
    switch (data.action) {
      case "link": {
        if (!typedId || !f.related_object_id) throw threadError("NOTHING_TO_LINK");
        const e = await edge(db, actor, {
          verb: "relates_to",
          from_id: typedId,
          to_id: f.related_object_id,
          source: "resolved",
          confidence: 0.9,
          rationale: `Linked to a prior object surfaced live: ${f.message.slice(0, 200)}`,
        });
        if ((e as Row).error) throw threadError((e as Row).error);
        state = "linked";
        break;
      }
      case "supersede": {
        if (!typedId || !f.related_object_id) throw threadError("NOTHING_TO_LINK");
        const e = await edge(db, actor, {
          verb: "supersedes_understanding_of",
          from_id: typedId,
          to_id: f.related_object_id,
          source: "resolved",
          confidence: 0.9,
          rationale: "Intent evolved; the earlier understanding is preserved as history",
        });
        if ((e as Row).error) throw threadError((e as Row).error);
        state = "superseded_link";
        break;
      }
      case "dismiss":
      case "experience_first":
        state = data.action === "dismiss" ? "dismissed" : "resolved";
        break;
      case "prior_stands":
      case "new_stands": {
        if (!authorityParticipant(s, context.userId))
          throw threadError(
            "AUTHORITY_REQUIRED_TO_CONFIRM: which statement stands is decided by the authority holder",
          );
        if (typedId && f.related_object_id)
          await edge(db, actor, {
            verb: "contradicts",
            from_id: typedId,
            to_id: f.related_object_id,
            source: "stated",
            confidence: 1,
            rationale: `Contradiction resolved: ${data.action === "prior_stands" ? "the prior statement stands" : "the new statement stands"}`,
          });
        if (data.action === "prior_stands" && xs && xs.lifecycle_state === "draft") {
          if (typedId)
            await tombstone(db, extractor(context.userId), typedId, "The prior statement stands");
          await reviseBody(
            db,
            actor,
            xs.id,
            (b) => ({
              ...b,
              rejection: {
                by: context.userId,
                reason: "Contradicted a prior statement that stands",
                at: new Date().toISOString(),
              },
            }),
            "Rejected",
          );
          await transition(db, actor, xs.id, "rejected", "The prior statement stands");
        }
        resolution = {
          ...resolution,
          stands: data.action === "prior_stands" ? "prior" : "new",
          follow_up:
            data.action === "new_stands"
              ? "Changing the prior confirmed object goes through a canon change or a new version (P15)"
              : null,
        };
        break;
      }
      case "defer": {
        const owner = participants(s).find((p) => p.id === data.owner_participant_id);
        if (!owner || !data.due)
          throw threadError("OWNER_AND_DATE_REQUIRED: a deferral names an owner and a date");
        state = "deferred";
        resolution = { ...resolution, owner: owner.id, owner_name: owner.name, due: data.due };
        break;
      }
      case "accepted_ambiguity": {
        if (typedId && f.related_object_id)
          await edge(db, actor, {
            verb: "contradicts",
            from_id: typedId,
            to_id: f.related_object_id,
            source: "stated",
            confidence: 1,
            rationale: "Recorded as accepted ambiguity",
          });
        state = "accepted_ambiguity";
        break;
      }
      case "yes_record": {
        if (!xs || xs.lifecycle_state !== "draft") throw threadError("NOT_A_DRAFT");
        const ps = participants(s);
        const speaker = ps.find((p) => p.id === xs.body.speaker_actor);
        const to: StatementClass = speaker?.decision_authority
          ? "confirmed_behavior"
          : "suggestion";
        await reviseBody(
          db,
          actor,
          xs.id,
          (b, o) => ({
            ...b,
            classification: to,
            kind: "rule",
            proposed_object_type: "BehaviorStatement",
            material: to === "confirmed_behavior",
            classification_change: {
              by_kind: "human",
              by: context.userId,
              from: b.classification,
              to,
              version: o.version + 1,
              at: new Date().toISOString(),
              note: "Answered the materiality question",
            },
          }),
          "Recorded as a rule",
        );
        if (typedId)
          await reviseBody(
            db,
            extractor(context.userId),
            typedId,
            (b) => ({ ...b, kind: "rule", material: to === "confirmed_behavior" }),
            "Recorded as a rule",
          );
        state = "answered";
        break;
      }
      case "no_keep":
        state = "answered";
        break;
      case "confirm_relationship": {
        const p = f.payload as Json;
        if (p["origin"] === "inferred") resolution = { ...resolution, human_confirmed: true };
        const e = await edge(db, actor, {
          verb: String(p["verb"]),
          from_id: String(p["from_id"]),
          to_id: String(p["to_id"]),
          source: String(p["origin"]),
          confidence: Number(p["confidence"] ?? 0.5),
          rationale: `Confirmed in session review: ${f.message.slice(0, 200)}`,
        });
        if ((e as Row).error) throw threadError((e as Row).error);
        resolution = { ...resolution, edge_id: (e as Row).edge.id };
        break;
      }
      case "discard_relationship":
        state = "dismissed";
        break;
    }
    const { error } = await db
      .from("framing_live_findings")
      .update({ state, resolution: resolution as never, resolved_at: new Date().toISOString() })
      .eq("id", f.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEntryTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        person: z.string().max(300).nullable(),
        outcome: z.string().max(300).nullable(),
        ability: z.string().max(300).nullable(),
        evidence: z.string().max(300).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    await loadSessionFor(db, context.userId, data.session_id);
    const { session_id: _s, ...e } = data;
    await reviseBody(
      db,
      human(context.userId),
      data.session_id,
      (b) => ({ ...b, entry_test: { ...EMPTY_ENTRY_TEST, ...e } }),
      "Entry test edited by a participant",
    );
    return { ok: true };
  });

// ---------------------------------------------------------------- re-extraction and close

export const reExtractSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ session_id: uuid, extractor_version: z.enum(["xv1", "xv2"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const db = await admin();
    const session = await loadSessionFor(db, context.userId, data.session_id);
    const revision = ((session.body?.extraction_revision as number) ?? 1) + 1;
    const mode = await modelMode(db);
    await db.from("extraction_revisions").insert({
      session_id: session.id,
      revision,
      extractor_version: data.extractor_version,
      model_route: `intent.classify.${data.extractor_version}`,
      adapter_mode: mode === "live" ? "live" : "simulated",
    });
    await reviseBody(
      db,
      extractor(context.userId),
      session.id,
      (b) => ({ ...b, extraction_revision: revision, extractor_version: data.extractor_version }),
      `Re-extraction revision ${revision}`,
    );
    const fresh = await load(db, session.id);
    const { data: arts } = await db
      .from("objects")
      .select("*")
      .eq("type", "CoCreationArtifact")
      .eq("body->>session_ref", session.id)
      .eq("is_tombstone", false);
    const { data: prior } = await db
      .from("objects")
      .select("*")
      .eq("type", "ExtractedStatement")
      .eq("body->>origin_session_ref", session.id)
      .eq("is_tombstone", false)
      .in("lifecycle_state", ["draft", "confirmed", "rejected"]);
    let preserved = 0;
    let superseded = 0;
    let statements = 0;
    for (const a of (arts ?? []) as Row[]) {
      if (!a.body.content) continue; // images keep their description; re-run them by re-capture
      const mine = ((prior ?? []) as Row[]).filter(
        (x) => x.body.provenance_spans?.[0]?.artifact_id === a.id,
      );
      const confirmedBySpan = new Map<string, Row>();
      for (const x of mine) {
        const sp = x.body.provenance_spans[0];
        if (x.lifecycle_state === "confirmed") {
          confirmedBySpan.set(JSON.stringify([sp.start, sp.end]), x);
          preserved++;
        } else {
          if (x.body.resolved_object_ref)
            await tombstone(
              db,
              extractor(context.userId),
              x.body.resolved_object_ref,
              `Superseded by extraction revision ${revision}`,
            ).catch(() => undefined);
          await transition(
            db,
            extractor(context.userId),
            x.id,
            "superseded",
            `Superseded by extraction revision ${revision}`,
          );
          superseded++;
        }
      }
      const speaker =
        participants(fresh).find((p) => p.id === a.body.speaker_id) ?? participants(fresh)[0]!;
      const evs = await db
        .from("session_events")
        .select("id,t_offset_ms,payload")
        .eq("ref", a.id)
        .eq("kind", "segment")
        .order("id");
      const units: UnitIn[] = ((evs.data ?? []) as Row[])
        .filter((e) => !e.payload.region)
        .map((e) => ({
          text: e.payload.text,
          speaker,
          segment_event_id: e.id,
          span:
            e.payload.t_end !== undefined
              ? { kind: "time_range", start: e.t_offset_ms, end: e.payload.t_end }
              : {
                  kind: a.body.kind === "prototype_interaction" ? "log_offset" : "char_range",
                  start: e.payload.char_start,
                  end: e.payload.char_end,
                },
        }));
      // A confirmed unit is never overwritten; its successor is proposed only if the new extractor disagrees
      const out = await extractUnits(
        {
          db,
          uid: context.userId,
          session: fresh,
          artifact: a,
          tier: (a.body.content_tier ?? "A") as ContentTier,
          simulated: !!a.body.provenance?.simulated,
          revision,
          version: data.extractor_version,
          mode,
        },
        units,
        t0,
        { reextract_of: confirmedBySpan },
      );
      statements += out.created.length;
    }
    await db
      .from("extraction_revisions")
      .update({
        statements,
        preserved_confirmations: preserved,
        superseded_drafts: superseded,
        finished_at: new Date().toISOString(),
      })
      .eq("session_id", session.id)
      .eq("revision", revision);
    return {
      revision,
      statements,
      preserved_confirmations: preserved,
      superseded_drafts: superseded,
    };
  });

export const closeFramingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const db = await admin();
    const s = await loadSessionFor(db, context.userId, data.session_id);
    const e: EntryTest = { ...EMPTY_ENTRY_TEST, ...(s.body?.entry_test ?? {}) };
    const complete = entryTestComplete(e);
    const result = { completed: complete, sentence: complete ? entryTestSentence(e) : null };
    let questionRef: string | null = null;
    if (!complete) {
      const { data: arts } = await db
        .from("objects")
        .select("id")
        .eq("type", "CoCreationArtifact")
        .eq("body->>session_ref", s.id)
        .eq("is_tombstone", false)
        .limit(5);
      if (!arts?.length)
        throw threadError(
          "NO_ARTIFACTS: nothing was captured; retire the session instead of closing it",
        );
      const q = await create(
        db,
        human(context.userId),
        payload(
          "OpenQuestion",
          "Entry test incomplete",
          `The entry test is incomplete: ${entryTestSentence(e)}`,
          {
            origin_session_ref: s.id,
            provenance_spans: arts.map((a) => ({
              artifact_id: a.id,
              kind: "log_offset",
              start: 0,
              end: 0,
              speaker_id: null,
            })),
            question: entryTestSentence(e),
            why_it_matters: "Do not proceed to build on an incomplete sentence (8A.1)",
            blocking: true,
            owner: s.body.co_creator,
            needed_by: today(14),
            material: false,
            provenance: { simulated: false },
          },
          {
            owner: s.owner_id,
            rationale: "The session yields an OpenQuestion instead of a mission",
          },
        ),
      );
      questionRef = q.human_ref;
    }
    await reviseBody(
      db,
      human(context.userId),
      s.id,
      (b) => ({
        ...b,
        entry_test_result: result,
        closed_at: new Date().toISOString(),
        entry_test_open_question: questionRef,
      }),
      "Entry test result recorded",
    );
    try {
      await transition(
        db,
        human(context.userId),
        s.id,
        "closed",
        "Session closed with its object set",
      );
    } catch (err) {
      await reviseBody(
        db,
        human(context.userId),
        s.id,
        (b) => {
          const { entry_test_result: _r, closed_at: _c, ...rest } = b;
          return rest;
        },
        "Close refused; entry test result withdrawn",
      );
      throw err;
    }
    await db.from("session_events").insert({
      session_id: s.id,
      t_offset_ms: 0,
      kind: "session.closed",
      payload: { entry_test: result },
    });
    await sweep(db, context.userId);
    await timing(db, s.id, null, "close_to_graph", Date.now() - t0);
    return { entry_test_result: result, open_question: questionRef };
  });

// ---------------------------------------------------------------- quality publication and evidence

export const publishExtractionQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { classifyUnits } = await import("@/server/framing/extractor");
    const { data: items } = await db.from("extraction_eval_items").select("*").order("created_at");
    const rows = (items ?? []) as Row[];
    if (!rows.length) throw threadError("NO_LABELLED_SET");
    const mode = await modelMode(db);
    const cls = await classifyUnits(
      rows.map((r) => r.text),
      "A",
      "xv1",
      mode,
      rows.map((r) =>
        r.speaker_has_decision_authority ? "co_creator, holds decision authority" : "participant",
      ),
    );
    const holder: Participant = {
      id: "h",
      name: "the authority holder",
      role: "co_creator",
      decision_authority: true,
    };
    const other: Participant = {
      id: "o",
      name: "participant",
      role: "participant",
      decision_authority: false,
    };
    const preds = rows.map((r, i) =>
      applyPostRules(cls.units[i]!, r.speaker_has_decision_authority ? holder : other, [
        holder,
        other,
      ]),
    );
    const byClass = precisionRecall(
      rows.map((r, i) => ({
        expected: r.expected_classification,
        predicted: preds[i]!.classification,
      })),
      CLASSES,
    );
    const types = [...new Set(rows.map((r) => r.expected_object_type).filter(Boolean))] as string[];
    const byType = precisionRecall(
      rows.map((r, i) => ({ expected: r.expected_object_type, predicted: preds[i]!.object_type })),
      types,
    );
    const correct = rows.filter(
      (r, i) => r.expected_classification === preds[i]!.classification,
    ).length;
    const id = crypto.randomUUID();
    const body = {
      title: "Extraction precision and recall",
      label_set: "agent_authored_seed_v1",
      label_set_note:
        "Hand-labelled by the build agent, not yet relabelled by a human: indicative only.",
      items: rows.length,
      accuracy: correct / rows.length,
      by_classification: byClass,
      by_object_type: byType,
      model: cls.model,
      route: cls.route,
      adapter_mode: cls.adapter_mode,
      extractor_version: "xv1",
      model_error: cls.error ?? null,
      counts_drafts: false,
      misses: rows
        .map((r, i) => ({
          text: r.text,
          expected: r.expected_classification,
          predicted: preds[i]!.classification,
        }))
        .filter((x) => x.expected !== x.predicted),
    };
    await db
      .from("renditions")
      .update({ state: "stale" })
      .eq("kind", "extraction_quality")
      .eq("state", "live");
    const { error } = await db.from("renditions").insert({
      id,
      kind: "extraction_quality",
      generated_from: [{ table: "extraction_eval_items", count: rows.length }] as never,
      citations: [
        { source: "extraction_eval_items", label_source: "agent_authored_seed_v1" },
      ] as never,
      generator: { model: cls.model, route: cls.route, extractor: "xv1" } as never,
      permission_context: { actor: context.userId } as never,
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      state: "live",
      body: body as never,
    });
    if (error) throw new Error(error.message);
    return { id, ...body };
  });

export const getExtractionQuality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("renditions")
      .select("id,generated_at,expires_at,state,body")
      .eq("kind", "extraction_quality")
      .eq("state", "live")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const runPhase2bEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db.rpc("thread_record_phase2b_evidence", {
      p_actor: human(context.userId) as never,
      p: {} as never,
    });
    if (error) throw new Error(error.message);
    return data as Row;
  });

export const getPhase2bEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ledger")
      .select("seq,occurred_at,payload")
      .eq("action", "phase2b.exit_evidence")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const runFramingSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data, error } = await db.rpc("thread_framing_sweep", {
      p_actor: human(context.userId) as never,
    });
    if (error) throw new Error(error.message);
    return data as Row;
  });

export const getFramingFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("detector_findings")
      .select("id,detector_key,object_id,severity,state,evidence,created_at")
      .in("detector_key", [
        "RawSpeechTreatedAsAuthority",
        "UnextractedDecision",
        "BehaviorWithoutNeed",
        "NeedWithoutBehavior",
        "NeedWithoutMeasure",
        "UnextractedSession",
        "SessionWithoutConsent",
        "ContradictionUnresolved",
        "AssumptionUnverified",
        "ProvenanceSpanMissing",
        "DraftObjectUsedAsBasis",
        "DraftCountedAsProgress",
        "SessionProducingMinutes",
        "DependencyCycle",
        "InferredEdgeAutoConfirmed",
        "FramingSessionAsMeeting",
      ])
      .eq("state", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

// ---------------------------------------------------------------- the framing views (8A.8)

export interface FvNode {
  id: string;
  ref: string;
  type: string;
  title: string;
  state: string;
  draft: boolean;
  x: number;
  y: number;
  session_ref: string | null;
  created_at: string;
}
export interface FvEdge {
  id: string;
  verb: string;
  from: string;
  to: string;
  source: string;
  kind: string | null;
  confidence: number | null;
  inferred: boolean;
  rationale: string | null;
  created_by: Row;
  created_at: string;
  synthetic?: boolean;
}

const VIEW_TYPES = [
  "NeedStatement",
  "BehaviorStatement",
  "OpenQuestion",
  "Assumption",
  "ConfirmedDecision",
  "ComposableCapability",
  "Constraint",
  "NonNegotiableConsequence",
  "EvidenceRequirement",
  "TestRun",
  "FramingSession",
];
const DRAFT_STATES = new Set(["draft", "proposed"]);

export const getFramingView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { view: FramingView; session?: string | undefined; root?: string | undefined }) =>
      z
        .object({ view: z.enum(FRAMING_VIEWS), session: uuid.optional(), root: uuid.optional() })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: objs, error } = await sb
      .from("objects")
      .select("id,human_ref,type,title,lifecycle_state,created_at,body")
      .in("type", VIEW_TYPES)
      .eq("is_tombstone", false)
      .not("lifecycle_state", "in", "(rejected,superseded,retired)")
      .limit(3000);
    if (error) throw new Error(error.message);
    const all = (objs ?? []) as Row[];
    const ids = all.map((o) => o.id);
    const { data: es } = ids.length
      ? await sb
          .from("edges")
          .select("id,verb,from_id,to_id,source,kind,confidence,rationale,created_by,created_at")
          .is("retired_at", null)
          .in("from_id", ids)
          .limit(10000)
      : { data: [] };
    const idSet = new Set(ids);
    const edges: FvEdge[] = ((es ?? []) as Row[])
      .filter((e) => idSet.has(e.to_id))
      .map((e) => ({
        id: e.id,
        verb: e.verb,
        from: e.from_id,
        to: e.to_id,
        source: e.source,
        kind: e.kind,
        confidence: e.confidence,
        inferred: e.source === "inferred" || e.source === "co_occurrence",
        rationale: e.rationale,
        created_by: e.created_by,
        created_at: e.created_at,
      }));
    const node = (o: Row): FvNode => ({
      id: o.id,
      ref: o.human_ref,
      type: o.type,
      title: o.title,
      state: o.lifecycle_state,
      draft: DRAFT_STATES.has(o.lifecycle_state),
      x: 0,
      y: 0,
      session_ref: o.body?.origin_session_ref ?? null,
      created_at: o.created_at,
    });
    let nodes: FvNode[] = [];
    let keep: FvEdge[] = [];
    let list: Array<{ ref: string; title: string; type: string; state: string; why: string }> = [];
    const circle = (ns: FvNode[], r = 100) =>
      ns.forEach((n, i) => {
        const a = (2 * Math.PI * i) / Math.max(1, ns.length);
        n.x = Math.cos(a) * r;
        n.y = Math.sin(a) * r;
      });
    const layers = (ns: FvNode[], depth: (n: FvNode) => number) => {
      const byD = new Map<number, FvNode[]>();
      ns.forEach((n) => {
        const d = depth(n);
        byD.set(d, [...(byD.get(d) ?? []), n]);
      });
      for (const [d, row] of byD)
        row.forEach((n, i) => {
          n.x = (i - (row.length - 1) / 2) * 30;
          n.y = d * 60;
        });
    };
    switch (data.view) {
      case "need_web": {
        nodes = all.filter((o) => o.type === "NeedStatement").map(node);
        const s = new Set(nodes.map((n) => n.id));
        keep = edges.filter(
          (e) =>
            s.has(e.from) &&
            s.has(e.to) &&
            ["depends_on", "relates_to", "contradicts", "supersedes_understanding_of"].includes(
              e.verb,
            ),
        );
        circle(nodes);
        break;
      }
      case "decomposition": {
        const order: Record<string, number> = {
          NeedStatement: 0,
          BehaviorStatement: 1,
          ComposableCapability: 2,
          TestRun: 3,
        };
        nodes = all
          .filter(
            (o) =>
              o.type in order &&
              (data.session
                ? o.body?.origin_session_ref === data.session || o.type !== "NeedStatement"
                : true),
          )
          .map(node);
        const s = new Set(nodes.map((n) => n.id));
        keep = edges.filter(
          (e) =>
            s.has(e.from) &&
            s.has(e.to) &&
            [
              "expressed_as",
              "addresses",
              "references_capability",
              "needs_capability",
              "verified_by",
            ].includes(e.verb),
        );
        const linked = new Set(keep.flatMap((e) => [e.from, e.to]));
        nodes = nodes.filter((n) => n.type === "NeedStatement" || linked.has(n.id));
        layers(nodes, (n) => order[n.type] ?? 0);
        break;
      }
      case "session_constellation": {
        nodes = all
          .filter(
            (o) =>
              o.id === data.session ||
              (data.session && o.body?.origin_session_ref === data.session),
          )
          .map(node);
        const s = new Set(nodes.map((n) => n.id));
        keep = edges.filter((e) => s.has(e.from) && s.has(e.to));
        nodes.forEach((n, i) => {
          if (n.id === data.session) {
            n.x = 0;
            n.y = 0;
            return;
          }
          const a = i * 2.399963;
          const r = 12 * Math.sqrt(i);
          n.x = Math.cos(a) * r * 5;
          n.y = Math.sin(a) * r * 5;
        });
        break;
      }
      case "dependency_web": {
        nodes = all.filter((o) => o.type === "BehaviorStatement").map(node);
        const s = new Set(nodes.map((n) => n.id));
        keep = edges.filter((e) => s.has(e.from) && s.has(e.to) && e.verb === "depends_on");
        const out = new Map<string, string[]>();
        keep.forEach((e) => out.set(e.from, [...(out.get(e.from) ?? []), e.to]));
        const memo = new Map<string, number>();
        const depth = (id: string, seen: Set<string>): number => {
          if (memo.has(id)) return memo.get(id)!;
          if (seen.has(id)) return 0;
          seen.add(id);
          const d = Math.max(0, ...(out.get(id) ?? []).map((t) => depth(t, seen) + 1));
          memo.set(id, d);
          return d;
        };
        layers(nodes, (n) => -depth(n.id, new Set()));
        break;
      }
      case "contradiction_map": {
        const { data: fs } = await sb
          .from("framing_live_findings")
          .select("id,statement_id,related_object_id,message,payload,state,created_at")
          .eq("kind", "contradiction")
          .limit(500);
        const synth: FvEdge[] = [];
        const xsIds = ((fs ?? []) as Row[]).map((f) => f.statement_id).filter(Boolean);
        const { data: xss } = xsIds.length
          ? await sb.from("objects").select("id,body").in("id", xsIds)
          : { data: [] };
        const resolveTo = new Map(
          ((xss ?? []) as Row[]).map((x) => [x.id, x.body?.resolved_object_ref ?? null]),
        );
        for (const f of (fs ?? []) as Row[]) {
          const from = resolveTo.get(f.statement_id);
          if (!from || !f.related_object_id) continue;
          synth.push({
            id: `f-${f.id}`,
            verb: "contradicts",
            from,
            to: f.related_object_id,
            source: "surfaced",
            kind: f.state,
            confidence: null,
            inferred: false,
            synthetic: true,
            rationale: `NEW: "${f.payload?.new_quote ?? ""}" · PRIOR: "${f.payload?.prior_quote ?? ""}" (${f.state})`,
            created_by: { kind: "agent", id: "challenge-agent" },
            created_at: f.created_at,
          });
        }
        keep = [...edges.filter((e) => e.verb === "contradicts"), ...synth];
        const s = new Set(keep.flatMap((e) => [e.from, e.to]));
        keep = keep.filter((e) => idSet.has(e.from) && idSet.has(e.to));
        nodes = all.filter((o) => s.has(o.id)).map(node);
        circle(nodes, 80);
        break;
      }
      case "unresolved_frontier": {
        const has = (id: string, verbs: string[], dir: "from" | "to") =>
          edges.some((e) => verbs.includes(e.verb) && e[dir] === id);
        for (const o of all) {
          let why: string | null = null;
          if (
            o.type === "NeedStatement" &&
            !has(o.id, ["expressed_as"], "from") &&
            !has(o.id, ["addresses"], "to")
          )
            why = "Need with no behaviour statement";
          else if (
            o.type === "BehaviorStatement" &&
            !["proposed"].includes(o.lifecycle_state) &&
            !has(o.id, ["verified_by"], "from")
          )
            why = "Behaviour with no evidence";
          else if (
            o.type === "OpenQuestion" &&
            ["draft", "active"].includes(o.lifecycle_state) &&
            !has(o.id, ["resolves_question"], "to")
          )
            why = "Question unanswered";
          else if (o.type === "Assumption" && (o.body?.status ?? "unverified") === "unverified")
            why = "Assumption unverified";
          if (why)
            list.push({
              ref: o.human_ref,
              title: o.title,
              type: o.type,
              state: o.lifecycle_state,
              why,
            });
        }
        const keepIds = new Set(list.map((l) => l.ref));
        nodes = all.filter((o) => keepIds.has(o.human_ref)).map(node);
        const groups = ["NeedStatement", "BehaviorStatement", "OpenQuestion", "Assumption"];
        layers(nodes, (n) => groups.indexOf(n.type));
        break;
      }
      case "cross_session_timeline": {
        nodes = all
          .filter((o) => o.type === "NeedStatement" || o.type === "BehaviorStatement")
          .map(node)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const t0 = nodes[0] ? Date.parse(nodes[0].created_at) : 0;
        const span = Math.max(1, (nodes.at(-1) ? Date.parse(nodes.at(-1)!.created_at) : 1) - t0);
        nodes.forEach((n, i) => {
          n.x = ((Date.parse(n.created_at) - t0) / span) * 400;
          n.y = (n.type === "NeedStatement" ? 0 : 60) + (i % 5) * 8;
        });
        const s = new Set(nodes.map((n) => n.id));
        keep = edges.filter(
          (e) =>
            s.has(e.from) &&
            s.has(e.to) &&
            ["supersedes_understanding_of", "expressed_as", "addresses"].includes(e.verb),
        );
        break;
      }
      case "impact_overlay": {
        if (!data.root) {
          nodes = [];
          break;
        }
        // Forward closure: whatever depends on or decomposes from the root must be re-verified if it changes
        const depth = new Map<string, number>([[data.root, 0]]);
        const q = [data.root];
        while (q.length) {
          const cur = q.shift()!;
          for (const e of edges) {
            const next =
              e.verb === "depends_on" && e.to === cur
                ? e.from
                : ["expressed_as", "references_capability", "needs_capability"].includes(e.verb) &&
                    e.from === cur
                  ? e.to
                  : e.verb === "addresses" && e.to === cur
                    ? e.from
                    : null;
            if (next && !depth.has(next)) {
              depth.set(next, depth.get(cur)! + 1);
              q.push(next);
              keep.push(e);
            }
          }
        }
        nodes = all.filter((o) => depth.has(o.id)).map(node);
        layers(nodes, (n) => depth.get(n.id) ?? 0);
        break;
      }
    }
    if (!list.length)
      list = nodes.map((n) => ({
        ref: n.ref,
        title: n.title,
        type: n.type,
        state: n.state,
        why: n.draft ? "draft" : n.state,
      }));
    return { nodes, edges: keep, list, total_edges: keep.length };
  });

/** Check: are confirmable families defined? (keeps the import used and documents the mapping) */
export const CONFIRM_FAMILIES = Object.keys(LIFECYCLE_FAMILIES);
export const ARTIFACT_KIND_LIST = ARTIFACT_KINDS;
export const modalityOf = artifactModality;

// ---------------------------------------------------------------------------
// Microsoft Teams / Outlook per-user connector ingestion (App User Connectors).
// Server-only modules are loaded dynamically inside handlers so this module's
// client stub stays credential-free.
// ---------------------------------------------------------------------------

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

// Server-only modules are loaded dynamically: this file is a server-function module
// and static imports of server-only code would leak credentials into the client bundle.
async function auc() {
  return import("@/integrations/lovable/appUserConnector");
}
async function connStore() {
  return import("@/server/appUserConnections.server");
}

export const CONNECTORS = {
  microsoft_teams: {
    label: "Microsoft Teams",
    envVar: "MICROSOFT_TEAMS_APP_USER_CONNECTOR_CLIENT_API_KEY",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "Chat.Read",
      "ChannelMessage.Read.All",
      "Team.ReadBasic.All",
    ],
  },
  microsoft_outlook: {
    label: "Microsoft Outlook",
    envVar: "MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY",
    scopes: ["openid", "profile", "email", "offline_access", "Mail.Read"],
  },
} as const;
export type ConnectorId = keyof typeof CONNECTORS;

const connectorInput = z.enum(["microsoft_teams", "microsoft_outlook"]);

function clientKey(connector: ConnectorId): string {
  const key = process.env[CONNECTORS[connector].envVar];
  if (!key)
    throw threadError(
      `CONNECTOR_NOT_CONFIGURED: ${CONNECTORS[connector].label} is not linked to this project yet`,
    );
  return key;
}

function returnUrlFor(connector: ConnectorId): string {
  const request = getRequest();
  if (!request) throw new Error("OAuth must start from an app request.");
  const url = new URL(request.url);
  const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return new URL(
    `/api/oauth/${connector}/return`,
    sandboxHost ? `https://${sandboxHost}` : url.origin,
  ).toString();
}

export const startConnectorConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connector: connectorInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await connStore();
    const existing = await getConnectionKeyForUser(context.userId, data.connector);
    const { authorizeAppUserOAuth } = await auc();
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.connector,
      appUserId: context.userId,
      clientAPIKey: clientKey(data.connector),
      returnUrl: returnUrlFor(data.connector),
      ...(existing ? { connectionAPIKey: existing } : {}),
      credentialsConfiguration: {
        scopes: [...CONNECTORS[data.connector].scopes],
        prompt: "select_account",
      },
    });
    return { authorizationUrl };
  });

export const completeConnectorConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await auc();
    const { saveConnectionKeyForUser } = await connStore();
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (!(connectorId in CONNECTORS))
      throw threadError("CONNECTOR_MISMATCH: OAuth completion returned an unknown connector");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true, connector: connectorId };
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connector: connectorInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await connStore();
    const { disconnectAppUser } = await auc();
    const key = await getConnectionKeyForUser(context.userId, data.connector);
    if (key)
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: data.connector,
      });
    await deleteConnectionKeyForUser(context.userId, data.connector);
    return { ok: true };
  });

export const getConnectorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: Record<string, { connected: boolean; configured: boolean; label: string }> = {};
    for (const id of Object.keys(CONNECTORS) as ConnectorId[]) {
      const { getConnectionKeyForUser } = await connStore();
      out[id] = {
        connected: !!(await getConnectionKeyForUser(context.userId, id)),
        configured: !!process.env[CONNECTORS[id].envVar],
        label: CONNECTORS[id].label,
      };
    }
    return out;
  });

async function callGraph(
  uid: string,
  connector: ConnectorId,
  path: string,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; reason: string }> {
  const { getConnectionKeyForUser } = await connStore();
  const { callAsAppUser, appUserReconnectRequired } = await auc();
  const key = await getConnectionKeyForUser(uid, connector);
  if (!key) return { ok: false, reason: "not_connected" };
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: connector,
    path,
    requiredScopes: [...CONNECTORS[connector].scopes],
  });
  if (await appUserReconnectRequired(res)) return { ok: false, reason: "reconnect_required" };
  if (!res.ok) {
    const body = await res.text();
    console.error(`Graph call failed [${res.status}] ${path}: ${body}`);
    throw threadError(`PROVIDER_ERROR: ${CONNECTORS[connector].label} returned ${res.status}`);
  }
  return { ok: true, json: (await res.json()) as Record<string, unknown> };
}

/** Binary download through the connector gateway (e.g. attachment $value). */
async function callGraphBlob(
  uid: string,
  connector: ConnectorId,
  path: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> {
  const { getConnectionKeyForUser } = await connStore();
  const { callAsAppUser, appUserReconnectRequired } = await auc();
  const key = await getConnectionKeyForUser(uid, connector);
  if (!key) return { ok: false, reason: "not_connected" };
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: connector,
    path,
    requiredScopes: [...CONNECTORS[connector].scopes],
  });
  if (await appUserReconnectRequired(res)) return { ok: false, reason: "reconnect_required" };
  if (!res.ok) {
    const body = await res.text();
    console.error(`Graph download failed [${res.status}] ${path}: ${body}`);
    throw threadError(`PROVIDER_ERROR: ${CONNECTORS[connector].label} returned ${res.status}`);
  }
  return { ok: true, bytes: new Uint8Array(await res.arrayBuffer()) };
}

// ---------------------------------------------------------------- Teams

export const listTeamsChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await callGraph(
      context.userId,
      "microsoft_teams",
      "/me/chats?$top=50&$expand=members",
    );
    if (!r.ok) return r;
    const chats = ((r.json.value as Array<Record<string, unknown>>) ?? []).map((c) => ({
      id: c.id as string,
      topic: (c.topic as string | null) ?? null,
      chatType: c.chatType as string,
      members: ((c.members as Array<Record<string, unknown>>) ?? [])
        .map((m) => m.displayName as string)
        .filter(Boolean),
    }));
    return { ok: true as const, chats };
  });

export const listTeamsChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const teamsR = await callGraph(context.userId, "microsoft_teams", "/me/joinedTeams");
    if (!teamsR.ok) return teamsR;
    const teams = (teamsR.json.value as Array<{ id: string; displayName: string }>) ?? [];
    const out: Array<{ teamId: string; teamName: string; channelId: string; name: string }> = [];
    for (const t of teams.slice(0, 20)) {
      const ch = await callGraph(context.userId, "microsoft_teams", `/teams/${t.id}/channels`);
      if (!ch.ok) continue;
      for (const c of (ch.json.value as Array<{ id: string; displayName: string }>) ?? [])
        out.push({ teamId: t.id, teamName: t.displayName, channelId: c.id, name: c.displayName });
    }
    return { ok: true as const, channels: out };
  });

interface GraphMessage {
  id: string;
  createdDateTime?: string;
  from?: { user?: { displayName?: string } | null } | null;
  body?: { contentType?: string; content?: string };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Ingest a Teams chat or channel into a framing session. Each message becomes a
 * chat/thread artifact (8A.2: lower evidence weight) through the standard pipeline.
 * Speaker is matched to a participant by display name; unmatched senders use the
 * chosen fallback participant and the real sender is recorded in provenance.
 */
export const ingestTeamsMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        fallback_speaker_id: uuid,
        chat_id: z.string().optional(),
        team_id: z.string().optional(),
        channel_id: z.string().optional(),
        max_messages: z.number().int().min(1).max(100).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.chat_id && !(data.team_id && data.channel_id))
      throw threadError("INVALID_INPUT: choose a chat or a channel");
    const path = data.chat_id
      ? `/chats/${encodeURIComponent(data.chat_id)}/messages?$top=${data.max_messages}`
      : `/teams/${encodeURIComponent(data.team_id!)}/channels/${encodeURIComponent(data.channel_id!)}/messages?$top=${data.max_messages}`;
    const r = await callGraph(context.userId, "microsoft_teams", path);
    if (!r.ok) return r;

    const db = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const session = await loadSessionFor(db, context.userId, data.session_id);
    const participants = (session.body?.participants ?? []) as Array<{
      id: string;
      name: string;
    }>;
    const messages = ((r.json.value as GraphMessage[]) ?? []).reverse();
    let ingested = 0;
    let skipped = 0;
    const sourceRef = data.chat_id ?? `${data.team_id}/${data.channel_id}`;
    for (const m of messages) {
      const text = htmlToText(m.body?.content ?? "");
      if (!text) {
        skipped++;
        continue;
      }
      const sender = m.from?.user?.displayName ?? "unknown";
      const match = participants.find(
        (p) => p.name.trim().toLowerCase() === sender.trim().toLowerCase(),
      );
      const out = await captureUtteranceImpl(
        context.userId,
        {
          session_id: data.session_id,
          speaker_id: match?.id ?? data.fallback_speaker_id,
          text: `[Teams · ${sender} · ${m.createdDateTime ?? "unknown time"}] ${text}`.slice(
            0,
            4000,
          ),
          mode: "chat",
          t_offset_ms: 0,
          client_id: `teams-${m.id}`,
        },
        "live",
      );
      if (out.duplicate) skipped++;
      else ingested++;
    }
    return { ok: true as const, ingested, skipped, source: sourceRef };
  });

// ---------------------------------------------------------------- Outlook

export const listOutlookMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const path = data.search
      ? `/me/messages?$top=25&$search="${encodeURIComponent(data.search)}"&$select=id,subject,from,receivedDateTime,hasAttachments,conversationId`
      : `/me/messages?$top=25&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,hasAttachments,conversationId`;
    const r = await callGraph(context.userId, "microsoft_outlook", path);
    if (!r.ok) return r;
    const messages = ((r.json.value as Array<Record<string, unknown>>) ?? []).map((m) => ({
      id: m.id as string,
      subject: (m.subject as string) ?? "(no subject)",
      from:
        ((
          (m.from as Record<string, unknown> | undefined)?.emailAddress as
            Record<string, unknown> | undefined
        )?.address as string) ?? "unknown",
      received: m.receivedDateTime as string,
      hasAttachments: !!m.hasAttachments,
      conversationId: m.conversationId as string,
    }));
    return { ok: true as const, messages };
  });

/**
 * Ingest an Outlook message (and its attachments) into a framing session as
 * brought-in documents (8A.2). The message text runs the consent/tier gate and the
 * extraction pipeline; attachments are stored with provenance and classified before
 * any model call — Tier C hard-blocks.
 */
export const ingestOutlookMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: uuid,
        message_id: z.string().min(1),
        speaker_id: uuid,
        include_attachments: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const r = await callGraph(
      context.userId,
      "microsoft_outlook",
      `/me/messages/${encodeURIComponent(data.message_id)}?$select=id,subject,from,receivedDateTime,body,hasAttachments,conversationId`,
    );
    if (!r.ok) return r;
    const m = r.json as unknown as {
      id: string;
      subject?: string;
      receivedDateTime?: string;
      conversationId?: string;
      from?: { emailAddress?: { address?: string } };
      body?: { contentType?: string; content?: string };
      hasAttachments?: boolean;
    };
    const sender = m.from?.emailAddress?.address ?? "unknown";
    const text = htmlToText(m.body?.content ?? "");
    const header = `[Outlook · ${sender} · ${m.receivedDateTime ?? "unknown time"}] Subject: ${m.subject ?? "(no subject)"}`;
    const out = await captureUtteranceImpl(
      context.userId,
      {
        session_id: data.session_id,
        speaker_id: data.speaker_id,
        text: `${header}\n\n${text}`.slice(0, 4000),
        mode: "brought_in_document",
        t_offset_ms: 0,
        client_id: `outlook-${m.id}`,
      },
      "live",
    );

    const attachments: Array<{ name: string; stored: boolean; reason?: string }> = [];
    if (data.include_attachments && m.hasAttachments && !out.duplicate && !out.blocked) {
      const ar = await callGraph(
        context.userId,
        "microsoft_outlook",
        `/me/messages/${encodeURIComponent(data.message_id)}/attachments?$select=id,name,contentType,size`,
      );
      if (ar.ok) {
        const db = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;
        const session = await loadSessionFor(db, context.userId, data.session_id);
        for (const a of (ar.json.value as Array<Record<string, unknown>>) ?? []) {
          const name = (a.name as string) ?? "attachment";
          const contentType = (a.contentType as string) ?? "application/octet-stream";
          const size = (a.size as number) ?? 0;
          if (size > 25 * 1024 * 1024) {
            attachments.push({ name, stored: false, reason: "over 25 MB" });
            continue;
          }
          const dl = await callGraphBlob(
            context.userId,
            "microsoft_outlook",
            `/me/messages/${encodeURIComponent(data.message_id)}/attachments/${encodeURIComponent(a.id as string)}/$value`,
          );
          if (!dl.ok) {
            attachments.push({ name, stored: false, reason: dl.reason });
            continue;
          }
          // Tier gate on what we know about the file before storing (8A.3)
          const tier = classifyContent(`${name} ${contentType}`);
          if (tier.tier === "C") {
            attachments.push({ name, stored: false, reason: "content tier C hard-block" });
            continue;
          }
          const path = `outlook/${data.session_id}/${m.id}/${a.id}`;
          const bytes = dl.bytes;
          const up = await db.storage
            .from("artifacts")
            .upload(path, bytes, { contentType, upsert: true });
          if (up.error) {
            attachments.push({ name, stored: false, reason: up.error.message });
            continue;
          }
          await create(db, extractor(context.userId), {
            ...payload(
              "CoCreationArtifact",
              `Email attachment · ${name}`,
              `Attachment ${name} from Outlook message ${m.subject ?? m.id}`,
              {
                session_ref: data.session_id,
                kind: "brought_in_document",
                media_ref: path,
                content: null,
                duration_or_size: size,
                captured_at: new Date().toISOString(),
                captured_by: context.userId,
                speaker_id: data.speaker_id,
                content_tier: tier.tier,
                consent_basis: [],
                extraction_state: "pending",
                evidence_weight: "corroborating",
                provenance: {
                  simulated: false,
                  adapter: "Outlook.connector",
                  source: "microsoft_outlook",
                  message_id: m.id,
                  conversation_id: m.conversationId ?? null,
                  from: sender,
                  received: m.receivedDateTime ?? null,
                  attachment_name: name,
                },
              },
              {
                owner: session.owner_id,
                tier: tier.tier,
                rationale: "Ingested from Outlook with provenance",
              },
            ),
          });
          attachments.push({ name, stored: true });
        }
      }
    }
    return { ...out, attachments, from: sender, subject: m.subject ?? null };
  });

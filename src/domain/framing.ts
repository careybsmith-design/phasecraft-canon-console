/**
 * Framing pipeline rules (Layer B Part 8A), as pure functions so the server and the tests agree.
 * Segmentation, six-way classification post-rules (authority-aware), materiality, the entry test,
 * stated-dependency cues, the contradiction heuristic and precision/recall.
 */
export const CLASSES = [
  "question",
  "suggestion",
  "assumption",
  "decision",
  "confirmed_behavior",
  "context",
] as const;
export type StatementClass = (typeof CLASSES)[number];

export const CLASS_LABELS: Record<StatementClass, string> = {
  question: "Question",
  suggestion: "Suggestion",
  assumption: "Assumption",
  decision: "Decision",
  confirmed_behavior: "Confirmed behaviour",
  context: "Context",
};

/** Object types an extracted unit may become (8A.4). ConfirmedDecision is only created on confirmation. */
export const EXTRACT_TYPES = [
  "NeedStatement",
  "BehaviorStatement",
  "Assumption",
  "OpenQuestion",
  "ConfirmedDecision",
  "Constraint",
  "NonNegotiableConsequence",
  "EvidenceRequirement",
  "GlossaryTerm",
] as const;
export type ExtractType = (typeof EXTRACT_TYPES)[number];
export const BEHAVIOR_KINDS = ["behavior", "rule", "exception"] as const;
export type BehaviorKind = (typeof BEHAVIOR_KINDS)[number];

export const ARTIFACT_KINDS = [
  "audio",
  "transcript",
  "whiteboard",
  "diagram",
  "prototype_interaction",
  "screen_capture",
  "recording",
  "brought_in_document",
  "third_party_recording",
  "chat",
  "typed_notes",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export const MODALITIES = ["audio", "text", "visual", "document"] as const;
export type Modality = (typeof MODALITIES)[number];

export function artifactModality(kind: ArtifactKind): Modality {
  if (["audio", "transcript", "recording", "third_party_recording"].includes(kind)) return "audio";
  if (["whiteboard", "diagram", "screen_capture", "prototype_interaction"].includes(kind))
    return "visual";
  if (kind === "brought_in_document") return "document";
  return "text";
}

/** 8A.2 evidence weight per artifact class. */
export function evidenceWeight(kind: ArtifactKind): "primary" | "corroborating" | "context_only" {
  if (kind === "audio" || kind === "transcript") return "primary";
  if (kind === "chat" || kind === "third_party_recording") return "context_only";
  return "corroborating";
}

export interface Unit {
  text: string;
  start: number;
  end: number;
}

/** Statement units, not fixed windows: the smallest span that can stand as a claim (8A.3). */
export function segment(text: string): Unit[] {
  const out: Unit[] = [];
  const re = /[^.!?;\n]+[.!?;]?/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t.replace(/[^a-z0-9]/gi, "").length < 3) continue;
    const start = (m.index ?? 0) + lead;
    out.push({ text: t, start, end: start + t.length });
  }
  return out;
}

export interface Participant {
  id: string;
  name: string;
  role: "co_creator" | "builder" | "participant" | "third_party";
  decision_authority: boolean;
  user_id?: string | null;
  authority_domain?: string | null;
}

export interface ModelUnit {
  classification: StatementClass;
  object_type: ExtractType | null;
  kind: BehaviorKind | null;
  materiality_uncertain: boolean;
  confidence: number;
  title: string;
}

export interface PostRuled extends ModelUnit {
  initial_classification: StatementClass;
  material: boolean;
  /** Conflict the extractor detected at extraction time. */
  authority_mismatch: string | null;
  materiality_question: string | null;
}

/**
 * Whether THIS viewer, now, may confirm a draft (W2.5). Computed on the server from the same
 * predicate the confirmation handler enforces; the client renders it and never re-derives it.
 * Distinct from authority_mismatch (an extraction-time conflict).
 */
export type ConfirmationAuthority = "not_required" | "held" | "missing";
export type ConfirmationReason = "material" | "decision" | "need";

export interface StatementAuthorityView {
  authority_mismatch: string | null;
  confirmation_authority: ConfirmationAuthority;
  confirmation_reason: ConfirmationReason | null;
}

/** The single confirmation-authority predicate (8A.10). */
export function confirmationReason(body: {
  material?: unknown;
  classification?: unknown;
  proposed_object_type?: unknown;
}): ConfirmationReason | null {
  if (body.material) return "material";
  if (body.classification === "decision") return "decision";
  if (body.proposed_object_type === "NeedStatement") return "need";
  return null;
}

export function confirmationAuthority(
  body: Parameters<typeof confirmationReason>[0],
  viewerHoldsAuthority: boolean,
): { confirmation_authority: ConfirmationAuthority; confirmation_reason: ConfirmationReason | null } {
  const reason = confirmationReason(body);
  if (!reason) return { confirmation_authority: "not_required", confirmation_reason: null };
  return {
    confirmation_authority: viewerHoldsAuthority ? "held" : "missing",
    confirmation_reason: reason,
  };
}

/** Name of the decision-authority holder for the mismatch note. */
export function authorityHolder(participants: Participant[]): string {
  const h = participants.find((p) => p.decision_authority);
  return h
    ? `${h.name}${h.authority_domain ? ` (${h.authority_domain})` : ""}`
    : "the Business Co-Creator";
}

/**
 * Deterministic post-rules applied after the model (8A.5):
 *  - authority-aware: a decision or a stated rule from a non-authority speaker is a suggestion, and the mismatch is surfaced;
 *  - context never becomes an object; a question becomes an OpenQuestion;
 *  - no silent materiality: an uncertain rule/decision/consequence asks in the session.
 */
export function applyPostRules(
  m: ModelUnit,
  speaker: Participant,
  participants: Participant[],
): PostRuled {
  const initial = m.classification;
  let cls = m.classification;
  let type = m.object_type;
  let kind = m.kind;
  let mismatch: string | null = null;
  const statesRule =
    type === "BehaviorStatement" &&
    (kind === "rule" || kind === "exception") &&
    cls !== "question" &&
    cls !== "suggestion";
  if (
    !speaker.decision_authority &&
    (cls === "decision" ||
      cls === "confirmed_behavior" ||
      statesRule ||
      type === "NonNegotiableConsequence")
  ) {
    mismatch = `Recorded as a suggestion — the decision authority for this belongs to ${authorityHolder(participants)}.`;
    cls = "suggestion";
    if (type === "ConfirmedDecision") type = "BehaviorStatement";
  }
  if (cls === "context") {
    type = null;
    kind = null;
  }
  if (cls === "question") {
    type = "OpenQuestion";
    kind = null;
  }
  if (cls === "assumption" && type !== "Assumption") type = "Assumption";
  if (cls === "decision") type = "ConfirmedDecision";
  if (
    cls === "confirmed_behavior" &&
    (type === null ||
      type === "OpenQuestion" ||
      type === "Assumption" ||
      type === "ConfirmedDecision")
  )
    type = "BehaviorStatement";
  if (
    cls === "suggestion" &&
    (type === null || type === "ConfirmedDecision" || type === "OpenQuestion")
  )
    type = "BehaviorStatement";
  if (type === "BehaviorStatement" && !kind) kind = "behavior";
  const material = isMaterial(cls, type, kind);
  const materiality_question =
    m.materiality_uncertain && !material && cls !== "question" && cls !== "context"
      ? `That sounds like a ${type === "NonNegotiableConsequence" ? "non-negotiable consequence" : kind === "exception" ? "exception" : "rule"} — should I record it as one?`
      : null;
  return {
    ...m,
    classification: cls,
    object_type: type,
    kind,
    initial_classification: initial,
    material,
    authority_mismatch: mismatch,
    materiality_question,
  };
}

/** 8A.10: material = rules, exceptions, non-negotiable consequences, decisions and confirmed behaviour. */
export function isMaterial(
  cls: StatementClass,
  type: ExtractType | null,
  kind: BehaviorKind | null,
): boolean {
  if (cls === "decision" || cls === "confirmed_behavior") return true;
  if (cls === "suggestion" || cls === "question" || cls === "assumption" || cls === "context")
    return false;
  return type === "NonNegotiableConsequence" || kind === "rule" || kind === "exception";
}

/** Target lifecycle state when an extracted object is confirmed, by lifecycle family. */
export function confirmedState(family: string): string {
  if (family === "behavior_statement" || family === "framing_extract") return "confirmed";
  if (family === "canon") return "active";
  return "recorded";
}

/** In-boundary deterministic classifier (Tier B route and the fallback when the model route is unavailable). */
export function ruleClassify(text: string): ModelUnit {
  const t = text.trim();
  const l = t.toLowerCase();
  const title = t.length > 80 ? `${t.slice(0, 77)}…` : t;
  const u = (
    classification: StatementClass,
    object_type: ExtractType | null,
    kind: BehaviorKind | null = null,
    confidence = 0.55,
    materiality_uncertain = false,
  ): ModelUnit => ({ classification, object_type, kind, confidence, materiality_uncertain, title });
  if (
    /\?$/.test(t) ||
    /^(how|what|why|who|when|where|which|do|does|did|is|are|can|could|should|would|will)\b/.test(l)
  )
    return u("question", "OpenQuestion");
  if (
    /\b(we (?:have )?decided|decision:|let'?s go with|we will|we are not going to|we won'?t)\b/.test(
      l,
    )
  )
    return u("decision", "ConfirmedDecision", null, 0.6);
  if (/\b(agreed|confirmed|yes,? when)\b/.test(l))
    return u("confirmed_behavior", "BehaviorStatement", "behavior", 0.6);
  if (/\b(we need|members need|need to be able)\b/.test(l))
    return u("suggestion", "NeedStatement", null, 0.55);
  if (/\b(maybe|what if|we could|might be worth|perhaps|how about)\b/.test(l))
    return u("suggestion", "BehaviorStatement", "behavior");
  if (/\b(i assume|presumably|probably|i think|most .* only|likely)\b/.test(l))
    return u("assumption", "Assumption");
  if (/\b(must|always|never|full stop|required to)\b/.test(l))
    return u(
      "confirmed_behavior",
      "BehaviorStatement",
      /\bexcept|unless\b/.test(l) ? "exception" : "rule",
      0.5,
      true,
    );
  return u("context", null, null, 0.5);
}

/** The entry test (8A.1): "For [person/situation], we will improve [outcome] by enabling [ability], proven by [evidence]." */
export interface EntryTest {
  person: string | null;
  outcome: string | null;
  ability: string | null;
  evidence: string | null;
}
export const EMPTY_ENTRY_TEST: EntryTest = {
  person: null,
  outcome: null,
  ability: null,
  evidence: null,
};
export function mergeEntryTest(prev: EntryTest, next: Partial<EntryTest>): EntryTest {
  const pick = (a: string | null, b: string | null | undefined) => (b && b.trim() ? b.trim() : a);
  return {
    person: pick(prev.person, next.person),
    outcome: pick(prev.outcome, next.outcome),
    ability: pick(prev.ability, next.ability),
    evidence: pick(prev.evidence, next.evidence),
  };
}
export function entryTestComplete(e: EntryTest): boolean {
  return !!(e.person && e.outcome && e.ability && e.evidence);
}
export function entryTestSentence(e: EntryTest): string {
  const s = (v: string | null, label: string) => v ?? `[${label}]`;
  return `For ${s(e.person, "specific person or situation")}, we will improve ${s(e.outcome, "measurable outcome")} by enabling ${s(e.ability, "new business ability")}, proven by ${s(e.evidence, "observable production evidence")}.`;
}

/** Stated dependency cue (8A.7.1 "explicit statement"). Returns the dependency kind or null. */
export function statedDependency(
  text: string,
): { kind: "data" | "sequence" | "authority" | "capability" | "decision" } | null {
  const l = text.toLowerCase();
  if (
    !/\b(depends on|dependent on|requires|can'?t .* until|cannot .* until|blocked by|only after|needs .* first)\b/.test(
      l,
    )
  )
    return null;
  if (/\b(data|feed|record|eligibility)\b/.test(l)) return { kind: "data" };
  if (/\b(approv|decid|sign)\w*/.test(l)) return { kind: "decision" };
  if (/\b(capabilit|service|api|system)\w*/.test(l)) return { kind: "capability" };
  if (/\b(authority|permission|allowed)\b/.test(l)) return { kind: "authority" };
  return { kind: "sequence" };
}

const STOP = new Set(
  "the a an and or of to for in on at is are be we our us it this that with will can not no never do does should would could must they them their as by from have has".split(
    " ",
  ),
);
export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
export function overlap(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}
const NEG =
  /\b(not|never|no|without|won'?t|cannot|can'?t|don'?t|doesn'?t|isn'?t|aren'?t|shouldn'?t|mustn'?t|drop|remove)\b/i;
/** Heuristic contradiction: high subject overlap with opposite polarity. Always surfaced, never auto-resolved. */
export function polarityConflict(a: string, b: string): boolean {
  return overlap(a, b) >= 0.4 && NEG.test(a) !== NEG.test(b);
}

/** Precision and recall per label (8A.13: published, never asserted). */
export interface PR {
  label: string;
  tp: number;
  fp: number;
  fn: number;
  support: number;
  precision: number | null;
  recall: number | null;
}
export function precisionRecall(
  rows: Array<{ expected: string | null; predicted: string | null }>,
  labels: readonly string[],
): PR[] {
  return labels.map((label) => {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const r of rows) {
      if (r.predicted === label && r.expected === label) tp++;
      else if (r.predicted === label) fp++;
      else if (r.expected === label) fn++;
    }
    return {
      label,
      tp,
      fp,
      fn,
      support: tp + fn,
      precision: tp + fp ? tp / (tp + fp) : null,
      recall: tp + fn ? tp / (tp + fn) : null,
    };
  });
}

/** p95 of a latency sample (nearest-rank). */
export function p95(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!;
}

/** 8A.13 latency budgets (ms, p95). */
export const LATENCY_BUDGETS = {
  extraction: 3000,
  contradiction: 5000,
  prior_surfacing: 3000,
  capability_reuse: 2000,
  close_to_graph: 60000,
} as const;

/** Seven + one framing views (8A.8). */
export const FRAMING_VIEWS = [
  "need_web",
  "decomposition",
  "session_constellation",
  "dependency_web",
  "contradiction_map",
  "unresolved_frontier",
  "cross_session_timeline",
  "impact_overlay",
] as const;
export type FramingView = (typeof FRAMING_VIEWS)[number];
export const FRAMING_VIEW_LABELS: Record<FramingView, string> = {
  need_web: "Need Web",
  decomposition: "Decomposition Tree",
  session_constellation: "Session Constellation",
  dependency_web: "Dependency Web",
  contradiction_map: "Contradiction Map",
  unresolved_frontier: "Unresolved Frontier",
  cross_session_timeline: "Cross-Session Timeline",
  impact_overlay: "Impact Overlay",
};

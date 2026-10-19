/**
 * Signal Intake (correction round L-22 / S-09): the front door of the value flow.
 * Causal order enforced here and in the database: Signal → Mission → Cell → Burst → Framing session.
 * A signal is evidence that a condition may be worth acting on — never a solution request.
 * All four origination channels terminate in a ValueSignal in `detected` state, and every
 * attempt (including blocked, quarantined and duplicate ones) is recorded in
 * `signal_intake_events`, an append-only audit trail with no approval state.
 */
import { z } from "zod/v4";

export const SIGNAL_ORIGINS = [
  "agent_sensor",
  "human_expertise",
  "artifact_upload",
  "live_capture",
] as const;
export type SignalOrigin = (typeof SIGNAL_ORIGINS)[number];
export const INTAKE_STATUSES = [
  "received",
  "extracted",
  "confirmed",
  "rejected",
  "duplicate",
  "no_proposal",
  "abandoned",
] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

/** B.2 rule 5 / SI-1: only a promoted signal can originate a mission. */
export const PROMOTABLE_STATES = ["detected", "enriched", "monitoring"] as const;
export const MISSION_ELIGIBLE_STATE = "promoted";

const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.uuid();

/** Human expertise channel: a person states a condition they own; no extraction step. */
export const RecordSignalInput = z
  .object({
    observed_condition: text(2000),
    affected_population: text(500).optional(),
    evidence_refs: z.array(id).max(20).default([]),
    potential_value: text(300).optional(),
    urgency: z.enum(["low", "medium", "high", "critical"]).optional(),
    source_ref: text(300).optional(),
    title: text(200).optional(),
  })
  .strict();

/** Artifact channel: extraction produces draft proposals only; a human confirms each signal. */
export const ExtractSignalInput = z
  .object({
    artifact_text: text(20000),
    kind: text(60),
    domain: text(120).optional(),
    source_ref: text(300).optional(),
  })
  .strict();

export const CaptureStartInput = z
  .object({
    modalities: z
      .array(z.enum(["audio", "text"]))
      .min(1)
      .max(2),
    purpose: text(500),
    /** W3.2: a capture opens only when the opener positively confirms every participant consented. */
    consent_confirmed: z.literal(true),
  })
  .strict();

export const CaptureCompleteInput = z
  .object({
    capture_id: id,
    transcript: text(20000),
  })
  .strict();

export const CaptureAbandonInput = z.object({ capture_id: id }).strict();

/** Human confirmation of one draft proposal from the artifact, capture or detector channel. */
export const ConfirmDraftInput = z
  .object({
    origin: z.enum(["artifact_upload", "live_capture", "agent_sensor"]),
    observed_condition: text(2000),
    evidence_refs: z.array(id).max(20).default([]),
    source_ref: text(300).optional(),
    raw_input_ref: text(300).optional(),
    extraction_method: z.enum(["manual", "model_extraction", "detector"]),
    model_route: text(120).optional(),
  })
  .strict();

export const PromoteSignalInput = z.object({ signal_id: id, rationale: text(1000) }).strict();
export const LinkSignalInput = z
  .object({ signal_id: id, mission_id: id, rationale: text(1000) })
  .strict();

export interface DraftSignal {
  observed_condition: string;
  evidence_excerpt: string;
  confidence: "low" | "medium";
  basis: string;
}

/** Words that mark a sentence as a candidate observed condition (gap, risk, opportunity). */
const CONDITION_CUES =
  /\b(gap|risk|delay|wait\w*|backlog|error|fail\w*|cost|waste|drop|decline|complaint|churn|manual|rework|duplicat\w*|slow|miss\w*|overdue|bottleneck|opportunit\w*|demand|grow\w*|friction|hand.?off|abandon|takes? \w+ (weeks?|days?|months?))\b/i;

/**
 * Rule-based extraction (L-15: no live model route is attested, so extraction is deterministic).
 * Produces proposals, never objects: nothing becomes a ValueSignal until a person with
 * authority confirms the observed condition (mirrors the 8A.4 draft/confirm rule).
 */
export function draftSignalsFromText(source: string, max = 5): DraftSignal[] {
  const sentences = source
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 400);
  return sentences
    .filter((s) => CONDITION_CUES.test(s))
    .slice(0, max)
    .map((s) => ({
      observed_condition: s,
      evidence_excerpt: s,
      confidence: "low" as const,
      basis:
        "Rule-based extraction proposal; a person must confirm the observed condition before any signal exists (8A.4 draft/confirm).",
    }));
}

/** Mandatory dedupe decision (B.2 rule 4): normalised-condition equality collapses near-duplicates. */
export function normalizeCondition(condition: string): string {
  return condition
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function isNearDuplicate(candidate: string, existing: string): boolean {
  return normalizeCondition(candidate) === normalizeCondition(existing);
}

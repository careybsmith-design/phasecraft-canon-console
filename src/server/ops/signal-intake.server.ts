/**
 * Signal intake cores (L-22/S-09), shared by the human server functions and the MCP gateway.
 * The PHI/PAN gate (deterministic ContentClassifier) runs BEFORE any extraction, and a blocked
 * or quarantined attempt is still recorded as an intake event. Extraction returns draft
 * proposals only; a ValueSignal exists only after human confirmation (8A.4 draft/confirm).
 * All writes go through thread_signal_intake (service-role, ledgered, append-only events).
 */
import { opErr, type Json, type OpCtx } from "./context";
import { classifyContent } from "@/domain/content-tier";
import {
  draftSignalsFromText,
  type ConfirmDraftInput,
  type ExtractSignalInput,
  type RecordSignalInput,
} from "@/domain/signal-intake";
import type { z } from "zod/v4";

export interface IntakeResult {
  intake_event_id?: string;
  status?: string;
  signal?: { id: string; human_ref: string; version: number; lifecycle_state: string };
  existing_signal?: { id: string; human_ref: string; title: string; lifecycle_state: string };
  promoted?: boolean;
  recorded_as?: string;
  note?: string;
  decision_id?: string;
  decision_ref?: string;
  signal_id?: string;
  human_ref?: string;
  lifecycle_state?: string;
  linked?: boolean;
  mission_id?: string;
}

async function intakeRpc(ctx: OpCtx, operation: string, p: Json): Promise<IntakeResult> {
  const { data, error } = await ctx.db.rpc("thread_signal_intake", {
    p_actor: ctx.actor,
    p_operation: operation,
    p: p as never,
  });
  if (error) throw opErr(error.message);
  return data as unknown as IntakeResult;
}

/** Record a blocked or quarantined attempt so the front door's audit trail is complete. */
async function recordBlocked(
  ctx: OpCtx,
  origin: string,
  status: "rejected" | "received",
  rawHash: string,
  classification: string,
) {
  await intakeRpc(ctx, "record_event", {
    origin,
    status,
    raw_input_ref: rawHash,
    extraction_method: "manual",
    data_classification: classification,
  });
}

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * W3.4: every persisted free-text field passes the PHI/PAN gate before any write,
 * on every channel. PAN/SAD hard-blocks (attempt recorded as rejected); PHI
 * quarantines (attempt recorded as received). The gate runs before persistence.
 */
async function gateFields(
  ctx: OpCtx,
  origin: "agent_sensor" | "human_expertise" | "artifact_upload" | "live_capture",
  fields: Array<[name: string, value: string | undefined | null]>,
) {
  for (const [name, value] of fields) {
    if (!value) continue;
    const tier = classifyContent(value);
    if (tier.pan) {
      await recordBlocked(ctx, origin, "rejected", await sha(value), "restricted");
      throw opErr(
        `INTAKE_BLOCKED_PAN: payment card data in ${name} is hard-blocked and was not stored; the blocked attempt is recorded`,
      );
    }
    if (tier.phi) {
      await recordBlocked(ctx, origin, "received", await sha(value), "restricted");
      throw opErr(
        `INTAKE_QUARANTINED_PHI: personal/health identifiers in ${name} are quarantined, not routed; no signal was created`,
      );
    }
  }
}

/** Human expertise channel (B.2 rule 3): direct creation in `detected`. PAN is never stored. */
export async function recordSignalCore(
  ctx: OpCtx,
  input: z.infer<typeof RecordSignalInput>,
  origin: "human_expertise" | "agent_sensor" = "human_expertise",
) {
  await gateFields(ctx, origin, [
    ["observed_condition", input.observed_condition],
    ["title", input.title],
    ["affected_population", input.affected_population],
    ["potential_value", input.potential_value],
    ["source_ref", input.source_ref],
  ]);
  return intakeRpc(ctx, "record", {
    ...input,
    origin,
    extraction_method: origin === "agent_sensor" ? "detector" : "manual",
  });
}

/** Artifact channel: gate first, then rule-based draft proposals. Never creates a signal. */
export async function extractSignalCore(ctx: OpCtx, input: z.infer<typeof ExtractSignalInput>) {
  await gateFields(ctx, "artifact_upload", [
    ["artifact_text", input.artifact_text],
    ["source_ref", input.source_ref],
    ["kind", input.kind],
    ["domain", input.domain],
  ]);
  const proposals = draftSignalsFromText(input.artifact_text);
  // W3.3: exactly one outcome event per resolved attempt — an artifact that
  // yields no proposals is recorded as no_proposal, not silently dropped.
  if (!proposals.length) {
    const ev = await intakeRpc(ctx, "record_event", {
      origin: "artifact_upload",
      status: "no_proposal",
      source_ref: input.source_ref ?? null,
      raw_input_ref: await sha(input.artifact_text),
      extraction_method: "model_extraction",
      data_classification: "internal",
    });
    return {
      gate: "ok",
      proposals,
      intake_event_id: ev.intake_event_id,
      note: "No candidate conditions found; the attempt is recorded with status no_proposal.",
      source_ref: input.source_ref ?? null,
    };
  }
  return {
    gate: "ok",
    proposals,
    note: "Proposals only — a person confirms each observed condition before any ValueSignal exists.",
    source_ref: input.source_ref ?? null,
  };
}

/**
 * Live capture channel (W3.2): the capture id is persisted, owned by the opener,
 * consent-gated and single-use. Fabricated, foreign and replayed ids are rejected
 * by the database.
 */
export async function startCaptureCore(
  ctx: OpCtx,
  input: { modalities: string[]; purpose: string; consent_confirmed: true },
) {
  const r = await intakeRpc(ctx, "open_capture", {
    modalities: input.modalities,
    purpose: input.purpose,
    consent_confirmed: input.consent_confirmed,
  });
  return {
    capture_id: r.signal_id ?? r.decision_id ?? (r as unknown as { capture_id: string }).capture_id,
    consent_required: true as const,
    modalities: input.modalities,
    purpose: input.purpose,
  };
}

/** Abandoning a capture resolves it and records exactly one `abandoned` event (W3.3). */
export async function abandonCaptureCore(ctx: OpCtx, input: { capture_id: string }) {
  return intakeRpc(ctx, "abandon_capture", input);
}

/** Live capture completion: same gate and draft-only rule as the artifact channel. */
export async function completeCaptureCore(
  ctx: OpCtx,
  input: { capture_id: string; transcript: string },
) {
  // W3.2: validate ownership, open state and consent, and resolve the capture
  // exactly once, before any content work.
  await intakeRpc(ctx, "complete_capture", { capture_id: input.capture_id });
  await gateFields(ctx, "live_capture", [["transcript", input.transcript]]);
  const drafts = draftSignalsFromText(input.transcript);
  // W3.3: the resolved attempt leaves exactly one outcome event.
  const ev = await intakeRpc(ctx, "record_event", {
    origin: "live_capture",
    status: drafts.length ? "extracted" : "no_proposal",
    source_ref: input.capture_id,
    raw_input_ref: await sha(input.transcript),
    extraction_method: "manual",
    data_classification: "internal",
  });
  return {
    capture_id: input.capture_id,
    gate: "ok",
    draft_signal: drafts,
    intake_event_id: ev.intake_event_id,
    note: drafts.length
      ? "Draft only — confirm the observed condition to create the signal."
      : "No candidate conditions found; the attempt is recorded with status no_proposal.",
  };
}

/** Human confirmation of a draft proposal: creates exactly one signal and one intake event. */
export async function confirmDraftCore(ctx: OpCtx, input: z.infer<typeof ConfirmDraftInput>) {
  // W3.3/W3.4: a rejected confirmation is gated on every field and the blocked
  // attempt is recorded, never silently dropped.
  await gateFields(ctx, input.origin, [
    ["observed_condition", input.observed_condition],
    ["source_ref", input.source_ref],
    ["raw_input_ref", input.raw_input_ref],
  ]);
  return intakeRpc(ctx, "confirm", { ...input, data_classification: "internal" });
}

export async function promoteSignalCore(
  ctx: OpCtx,
  input: { signal_id: string; rationale: string },
) {
  return intakeRpc(ctx, "promote", input);
}

export async function linkSignalCore(
  ctx: OpCtx,
  input: { signal_id: string; mission_id: string; rationale: string },
) {
  return intakeRpc(ctx, "link", input);
}

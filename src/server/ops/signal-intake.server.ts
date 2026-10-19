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

/** Human expertise channel (B.2 rule 3): direct creation in `detected`. PAN is never stored. */
export async function recordSignalCore(
  ctx: OpCtx,
  input: z.infer<typeof RecordSignalInput>,
  origin: "human_expertise" | "agent_sensor" = "human_expertise",
) {
  const tier = classifyContent(input.observed_condition);
  if (tier.pan) {
    await recordBlocked(ctx, origin, "rejected", await sha(input.observed_condition), "restricted");
    throw opErr(
      "INTAKE_BLOCKED_PAN: payment card data is hard-blocked and was not stored; the blocked attempt is recorded",
    );
  }
  return intakeRpc(ctx, "record", {
    ...input,
    origin,
    extraction_method: origin === "agent_sensor" ? "detector" : "manual",
  });
}

/** Artifact channel: gate first, then rule-based draft proposals. Never creates a signal. */
export async function extractSignalCore(ctx: OpCtx, input: z.infer<typeof ExtractSignalInput>) {
  const tier = classifyContent(input.artifact_text);
  if (tier.pan) {
    await recordBlocked(
      ctx,
      "artifact_upload",
      "rejected",
      await sha(input.artifact_text),
      "restricted",
    );
    throw opErr(
      "INTAKE_BLOCKED_PAN: payment card data is hard-blocked before any model call; the blocked attempt is recorded with no signal",
    );
  }
  if (tier.phi) {
    await recordBlocked(
      ctx,
      "artifact_upload",
      "received",
      await sha(input.artifact_text),
      "restricted",
    );
    throw opErr(
      "INTAKE_QUARANTINED_PHI: personal/health identifiers are quarantined, not routed; no signal was created",
    );
  }
  return {
    gate: tier.tier,
    proposals: draftSignalsFromText(input.artifact_text),
    note: "Proposals only — a person confirms each observed condition before any ValueSignal exists.",
    source_ref: input.source_ref ?? null,
  };
}

/** Live capture channel: consent-gated opening; the capture id identifies the attempt. */
export function startCaptureCore(input: { modalities: string[]; purpose: string }) {
  return {
    capture_id: crypto.randomUUID(),
    consent_required: true as const,
    modalities: input.modalities,
    purpose: input.purpose,
  };
}

/** Live capture completion: same gate and draft-only rule as the artifact channel. */
export async function completeCaptureCore(
  ctx: OpCtx,
  input: { capture_id: string; transcript: string },
) {
  const tier = classifyContent(input.transcript);
  if (tier.pan) {
    await recordBlocked(ctx, "live_capture", "rejected", await sha(input.transcript), "restricted");
    throw opErr(
      "INTAKE_BLOCKED_PAN: payment card data is hard-blocked before any model call; the blocked attempt is recorded with no signal",
    );
  }
  if (tier.phi) {
    await recordBlocked(ctx, "live_capture", "received", await sha(input.transcript), "restricted");
    throw opErr(
      "INTAKE_QUARANTINED_PHI: personal/health identifiers are quarantined, not routed; no signal was created",
    );
  }
  return {
    capture_id: input.capture_id,
    gate: tier.tier,
    draft_signal: draftSignalsFromText(input.transcript),
    note: "Draft only — confirm the observed condition to create the signal.",
  };
}

/** Human confirmation of a draft proposal: creates exactly one signal and one intake event. */
export async function confirmDraftCore(ctx: OpCtx, input: z.infer<typeof ConfirmDraftInput>) {
  const tier = classifyContent(input.observed_condition);
  if (tier.pan || tier.phi)
    throw opErr("INTAKE_BLOCKED: the confirmed condition still carries blocked identifiers");
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

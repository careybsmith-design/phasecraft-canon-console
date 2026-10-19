/**
 * W3.4: every persisted free-text field passes the PHI/PAN gate before any write,
 * on every channel. These are metadata-only negative tests: the assertion is on
 * what reaches persistence (the RPC operations invoked), not on what is returned.
 */
import { describe, expect, it, vi } from "vitest";
import {
  recordSignalCore,
  extractSignalCore,
  confirmDraftCore,
  completeCaptureCore,
} from "./signal-intake.server";
import type { OpCtx } from "./context";

const PAN = "4111 1111 1111 1111"; // Luhn-valid card number
const PHI = "ssn 123-45-6789";

function fakeCtx() {
  const rpc = vi.fn(async () => ({ data: { intake_event_id: "ev-1", status: "rejected" } }));
  const ctx = {
    db: { rpc },
    actor: { kind: "human", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", authority_used: "observe" },
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  } as unknown as OpCtx;
  return { ctx, rpc };
}

const ops = (rpc: ReturnType<typeof vi.fn>) =>
  rpc.mock.calls.map((c) => (c[1] as { p_operation: string }).p_operation);

describe("signal intake field gating (W3.4)", () => {
  it("a card number in potential_value is hard-blocked and never persisted", async () => {
    const { ctx, rpc } = fakeCtx();
    await expect(
      recordSignalCore(ctx, {
        observed_condition: "Onboarding takes weeks for new clinics",
        potential_value: `charge card ${PAN}`,
        evidence_refs: [],
      }),
    ).rejects.toThrow(/INTAKE_BLOCKED_PAN/);
    // Only the blocked-attempt event was written; no 'record' ever reached persistence.
    expect(ops(rpc)).toEqual(["record_event"]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_operation: "record_event" });
  });

  it("a health identifier in affected_population is quarantined and never persisted", async () => {
    const { ctx, rpc } = fakeCtx();
    await expect(
      recordSignalCore(ctx, {
        observed_condition: "Onboarding takes weeks for new clinics",
        affected_population: `patient ${PHI}`,
        evidence_refs: [],
      }),
    ).rejects.toThrow(/INTAKE_QUARANTINED_PHI/);
    expect(ops(rpc)).toEqual(["record_event"]);
  });

  it("a card number in the title is hard-blocked and never persisted", async () => {
    const { ctx, rpc } = fakeCtx();
    await expect(
      recordSignalCore(ctx, {
        observed_condition: "Onboarding takes weeks for new clinics",
        title: `ref ${PAN}`,
        evidence_refs: [],
      }),
    ).rejects.toThrow(/INTAKE_BLOCKED_PAN/);
    expect(ops(rpc)).toEqual(["record_event"]);
  });

  it("the sensor channel gates source_ref too", async () => {
    const { ctx, rpc } = fakeCtx();
    await expect(
      recordSignalCore(
        ctx,
        {
          observed_condition: "Queue depth keeps growing",
          source_ref: `feed ${PAN}`,
          evidence_refs: [],
        },
        "agent_sensor",
      ),
    ).rejects.toThrow(/INTAKE_BLOCKED_PAN/);
    expect(ops(rpc)).toEqual(["record_event"]);
  });

  it("the artifact channel gates source_ref, not only artifact_text", async () => {
    const { ctx, rpc } = fakeCtx();
    await expect(
      extractSignalCore(ctx, {
        artifact_text: "The backlog keeps growing and rework is common.",
        kind: "document",
        source_ref: `scan ${PAN}`,
      }),
    ).rejects.toThrow(/INTAKE_BLOCKED_PAN/);
    expect(ops(rpc)).toEqual(["record_event"]);
  });

  it("a rejected confirmation is recorded, not silently dropped (W3.3)", async () => {
    const { ctx, rpc } = fakeCtx();
    await expect(
      confirmDraftCore(ctx, {
        origin: "artifact_upload",
        observed_condition: `condition mentions ${PHI}`,
        evidence_refs: [],
        extraction_method: "model_extraction",
      }),
    ).rejects.toThrow(/INTAKE_QUARANTINED_PHI/);
    expect(ops(rpc)).toEqual(["record_event"]);
  });

  it("capture completion validates the capture before touching content (W3.2)", async () => {
    const { ctx, rpc } = fakeCtx();
    rpc.mockRejectedValueOnce(new Error("CAPTURE_ALREADY_RESOLVED"));
    await expect(
      completeCaptureCore(ctx, {
        capture_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        transcript: `pay ${PAN}`,
      }),
    ).rejects.toThrow(/CAPTURE_ALREADY_RESOLVED/);
    // The replayed id was rejected first; the transcript was never even gated.
    expect(ops(rpc)).toEqual(["complete_capture"]);
  });
});

import { z } from "zod";

/** Transport limits are resource ceilings, not value/productivity measures. */
export const MCP_BODY_BYTES = 262144;
export const MCP_BATCH_ITEMS = 20;
export const CONTEXT_NODE_LIMIT = 200;
export const CONTEXT_EDGE_LIMIT = 1000;
export const SCALE_TARGET = {
  operating_objects: 5000000,
  relationships: 30000000,
  evidence_objects: 15000000,
  live_renditions: 1000000,
  humans: 2000,
  agent_calls_per_second: 5000,
} as const;
export const RECOVERY_TARGET = { rpo_minutes: 15, rto_minutes: 240 } as const;
export const ASSURANCE_KINDS = [
  "penetration",
  "accessibility",
  "recovery",
  "load",
  "independent_verification",
  "compliance_walkthrough",
] as const;
export const AssuranceInput = z
  .object({
    subject_id: z.string().uuid(),
    kind: z.enum(ASSURANCE_KINDS),
    result: z.enum(["passed", "failed", "pending_live_adapter"]),
    evidence_refs: z.array(z.string().uuid()).min(1).max(20),
    rationale: z.string().trim().min(1).max(2000),
  })
  .strict();
export type AssuranceInput = z.infer<typeof AssuranceInput>;

export function rpcBatch(body: unknown): unknown[] {
  const messages = Array.isArray(body) ? body : [body];
  if (messages.length === 0 || messages.length > MCP_BATCH_ITEMS)
    throw new Error("BATCH_LIMIT: expected 1–20 messages");
  return messages;
}

/** Read incrementally; Content-Length is not trusted and chunked payloads are also bounded. */
export async function boundedText(request: Request): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > MCP_BODY_BYTES) throw new Error("BODY_LIMIT");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("PARSE_ERROR");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MCP_BODY_BYTES) {
        await reader.cancel();
        throw new Error("BODY_LIMIT");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
export async function boundedJson(request: Request): Promise<unknown> {
  return JSON.parse(await boundedText(request));
}

export function recoveryWithinTarget(rpo: number, rto: number, ledgerVerified: boolean) {
  return (
    Number.isFinite(rpo) &&
    Number.isFinite(rto) &&
    rpo >= 0 &&
    rto >= 0 &&
    rpo <= RECOVERY_TARGET.rpo_minutes &&
    rto <= RECOVERY_TARGET.rto_minutes &&
    ledgerVerified
  );
}

export function independentlyVerified(test: {
  code_route: string;
  test_route: string;
  implementation_visible: boolean;
  human_reviewed: boolean;
  provenance: string;
}) {
  return Boolean(
    test.code_route &&
    test.test_route &&
    test.code_route !== test.test_route &&
    !test.implementation_visible &&
    test.human_reviewed &&
    test.provenance === "independently_authored",
  );
}

/** Capability Fabric cores (Part 7), shared by the Fabric page and the MCP gateway. */
import { reuseDecisionError, type ReuseResult } from "@/domain/fabric";
import { opErr as err, type OpCtx } from "./context";

export interface IntentShape { outcome: string; inputs: string[]; outputs: string[]; domain: string }

export async function searchFabricCore(ctx: OpCtx, s: IntentShape) {
  const { data: rows, error } = await ctx.sb.rpc("fabric_search", { p_outcome: s.outcome, p_inputs: s.inputs, p_outputs: s.outputs, p_domain: s.domain, p_limit: 10 } as never);
  if (error) throw err(error.message);
  return (rows ?? []) as unknown as Array<ReuseResult & { human_ref: string; title: string; statement: string; lifecycle_state: string; authority_level: string }>;
}

export async function reuseCheckCore(ctx: OpCtx, data: { intent_shape: IntentShape; decision: "reuse_as_is" | "compose_existing" | "create_new"; rationale: string;
  behavior_statement_id?: string | undefined; extra_gaps?: Record<string, string[]> }) {
  // Results are recomputed on the server, never trusted from the caller.
  const rows = await searchFabricCore(ctx, data.intent_shape);
  const extra = data.extra_gaps ?? {};
  const results = rows.map((r) => ({ capability_id: r.capability_id, match_score: r.match_score, reuse_mode: r.reuse_mode, gaps: [...r.gaps, ...(extra[r.capability_id] ?? [])] }));
  const bad = reuseDecisionError(results, data.decision, data.rationale);
  if (bad) throw err(bad);
  if (data.behavior_statement_id) {
    const { data: bs } = await ctx.sb.from("objects").select("type").eq("id", data.behavior_statement_id).maybeSingle();
    if (bs?.type !== "BehaviorStatement") throw err("NOT_A_BEHAVIOR_STATEMENT: the reuse check links to the originating Behaviour Statement");
  }
  const id = crypto.randomUUID();
  const { error: e2 } = await ctx.db.from("reuse_checks").insert({
    id, intent_shape: data.intent_shape, query_text: `${data.intent_shape.outcome} ${data.intent_shape.domain}`.trim(), results, decision: data.decision,
    rationale: data.rationale, checked_by: ctx.actor, behavior_statement_id: data.behavior_statement_id ?? null,
  } as never);
  if (e2) throw err(e2.message);
  return { reuse_check_id: id, results };
}

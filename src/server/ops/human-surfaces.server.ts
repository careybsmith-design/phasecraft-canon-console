import { type OpCtx, type Json, opErr } from "./context";
import {
  MissionInput,
  CellInput,
  BurstInput,
  FinishBurstInput,
  CapabilitySimulationInput,
  behaviouralChallenge,
  nextScenario,
} from "@/domain/human-surfaces";
import { prohibitedInference } from "@/domain/generation";
import type { Json as DbJson } from "@/integrations/supabase/types";

export type SurfaceObject = {
  id: string;
  human_ref: string;
  type: string;
  title: string;
  statement: string;
  body: Record<string, DbJson>;
  version: number;
  lifecycle_state: string;
  risk_tier: string;
  authority_level: string;
  confidence_bundle: DbJson;
  review_date: string;
  expiration_condition: DbJson;
  data_classification: string;
  content_hash: string;
  owner_id: string;
  co_creator_id: string | null;
  builder_id: string | null;
  updated_at: string;
};
export type SurfaceContext = {
  objects: SurfaceObject[];
  edges: Array<{ id: string; from_id: string; to_id: string; verb: string }>;
};
export async function humanOperation(ctx: OpCtx, operation: string, input: unknown) {
  const schemas = {
    mission: MissionInput,
    cell: CellInput,
    burst: BurstInput,
    finish_burst: FinishBurstInput,
    simulation: CapabilitySimulationInput,
    adversarial: CapabilitySimulationInput,
  };
  const schema = schemas[operation as keyof typeof schemas];
  if (!schema) throw opErr("UNKNOWN_OPERATION");
  const p = schema.parse(input);
  const { data, error } = await ctx.db.rpc("thread_human_operation", {
    p_actor: ctx.actor,
    p_operation: operation,
    p: p as never,
  });
  if (error) throw opErr(error.message);
  return data as unknown as {
    id: string;
    human_ref: string;
    version: number;
    lifecycle_state?: string;
  };
}
export async function readSurface(ctx: OpCtx, root?: string) {
  const { data, error } = await ctx.sb.rpc("human_surface_context", root ? { p_root: root } : {});
  if (error) throw opErr(error.message);
  return data as unknown as SurfaceContext;
}
export async function surfaceRendition(
  ctx: OpCtx,
  purpose: string,
  sources: string[],
  body: Json,
  request = "",
) {
  if (!sources.length) throw opErr("SOURCES_REQUIRED: choose canon evidence first");
  if (prohibitedInference(request))
    throw opErr("PROHIBITED_INFERENCE: individual activity analysis is not permitted");
  const { data, error } = await ctx.db.rpc("thread_generate_rendition", {
    p_actor: ctx.actor,
    p: {
      kind: "conversational_walkthrough",
      purpose,
      context: "Phase 11 human surface",
      request_text: request,
      sources,
      citations: sources,
      body,
      generator: {
        agent: "thread.human-surfaces",
        model: "rule-based",
        route: "route.surface.in_boundary",
        template_version: "surface-1",
        adapter_mode: "none",
      },
    } as never,
  });
  if (error) throw opErr(error.message);
  const result = data as unknown as { rendition_id?: string; refused?: boolean; reason?: string };
  if (result.refused || !result.rendition_id) throw opErr(result.reason ?? "RENDITION_REFUSED");
  return openSurfaceRendition(ctx, result.rendition_id, purpose);
}
export async function openSurfaceRendition(ctx: OpCtx, id: string, purpose: string) {
  const { data, error } = await ctx.db.rpc("thread_serve_rendition", {
    p_actor: ctx.actor,
    p_id: id,
    p_purpose: purpose,
  });
  if (error) throw opErr(error.message);
  return data as unknown as {
    id: string;
    human_ref: string;
    marker: string;
    body: Record<string, DbJson>;
    generated_at: string;
    expires_at: string;
    generated_from: Array<{ id: string; human_ref: string; version: number; content_hash: string }>;
    generator: { model: string; route: string };
  };
}
export async function companionResponse(ctx: OpCtx, statement: string, sourceIds: string[]) {
  if (prohibitedInference(statement)) throw opErr("PROHIBITED_INFERENCE");
  const { data: sources, error } = await ctx.sb
    .from("objects")
    .select("id,human_ref,title,statement,type,body")
    .in("id", sourceIds)
    .eq("is_tombstone", false);
  if (error) throw opErr(error.message);
  if (!sources || sources.length !== sourceIds.length) throw opErr("SOURCE_NOT_PERMITTED");
  return surfaceRendition(
    ctx,
    "Value Companion",
    sourceIds,
    {
      title: "Current condition and evidence",
      challenge: behaviouralChallenge(statement),
      sections: sources.map((s) => ({
        heading: `${s.human_ref} · ${s.title}`,
        text: s.statement,
        cites: [s.id],
      })),
      note: "Evidence-grounded, rule-based challenge.",
    },
    statement,
  );
}
export async function scenarioTurn(
  ctx: OpCtx,
  sourceIds: string[],
  scenario: string,
  response: string,
  turn: number,
) {
  if (prohibitedInference(`${scenario} ${response}`)) throw opErr("PROHIBITED_INFERENCE");
  const next = nextScenario(response, turn);
  return surfaceRendition(
    ctx,
    "Simulation Studio",
    sourceIds,
    {
      scenario,
      turn,
      ...next,
      response,
      mode: "simulated",
      authority_earned: false,
      sections: [{ heading: next.role, text: next.prompt, cites: sourceIds }],
      evaluation_basis:
        "Rule-based feedback on this simulated choice only; not a verified assessment of a person.",
    },
    scenario,
  );
}

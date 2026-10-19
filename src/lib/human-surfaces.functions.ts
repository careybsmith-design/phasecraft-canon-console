import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MissionInput,
  CellInput,
  BurstInput,
  FinishBurstInput,
  ScenarioInput,
  ChoiceInput,
  FollowInput,
  CapabilitySimulationInput,
} from "@/domain/human-surfaces";

const actor = (id: string) => ({ kind: "human" as const, id, authority_used: "observe" });
export const refreshSurfaceRendition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.uuid(), purpose: z.enum(["Value Companion", "Simulation Studio"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { openSurfaceRendition } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return openSurfaceRendition(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data.id,
      data.purpose,
    );
  });
export const getHumanSurface = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ root: z.uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { readSurface } = await import("@/server/ops/human-surfaces.server");
    // readSurface uses only the caller's permission-scoped client.
    return readSurface(
      {
        sb: context.supabase,
        db: context.supabase,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data.root,
    );
  });
export const createMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MissionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return humanOperation(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      "mission",
      data,
    );
  });
export const formCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CellInput.parse(d))
  .handler(async ({ data, context }) => {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return humanOperation(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      "cell",
      data,
    );
  });
export const startBurst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BurstInput.parse(d))
  .handler(async ({ data, context }) => {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return humanOperation(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      "burst",
      data,
    );
  });
export const finishBurst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FinishBurstInput.parse(d))
  .handler(async ({ data, context }) => {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return humanOperation(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      "finish_burst",
      data,
    );
  });
export const probeCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    CapabilitySimulationInput.extend({ adversarial: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return humanOperation(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data.adversarial ? "adversarial" : "simulation",
      { capability_id: data.capability_id, scenario: data.scenario },
    );
  });
export const askCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        statement: z.string().trim().min(1).max(2000),
        source_ids: z.array(z.uuid()).min(1).max(20),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { companionResponse } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return companionResponse(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data.statement,
      data.source_ids,
    );
  });
export const beginScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScenarioInput.parse(d))
  .handler(async ({ data, context }) => {
    const { scenarioTurn } = await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return scenarioTurn(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data.source_ids,
      data.scenario,
      "",
      0,
    );
  });
export const respondToScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChoiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { openSurfaceRendition, scenarioTurn } =
      await import("@/server/ops/human-surfaces.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ctx = {
      sb: context.supabase,
      db: supabaseAdmin,
      actor: actor(context.userId),
      userId: context.userId,
    };
    const previous = await openSurfaceRendition(ctx, data.session_id, "Simulation Studio");
    return scenarioTurn(
      ctx,
      previous.generated_from.map((s) => s.id),
      String(previous.body["scenario"]),
      data.response,
      Number(previous.body["turn"] ?? 0) + 1,
    );
  });
export const getFollows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("surface_follows").select("kind,value");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const setFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FollowInput.parse(d))
  .handler(async ({ data, context }) => {
    const result = data.following
      ? await context.supabase
          .from("surface_follows")
          .upsert({ user_id: context.userId, kind: data.kind, value: data.value })
      : await context.supabase
          .from("surface_follows")
          .delete()
          .eq("user_id", context.userId)
          .eq("kind", data.kind)
          .eq("value", data.value);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

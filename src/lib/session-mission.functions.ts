import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LinkSessionMissionInput, NeedMissionInput } from "@/domain/session-mission";

type Scope = { id: string; human_ref: string; title: string; origin: string; depth: number };
export const runSessionMissionAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: steward, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "steward",
    });
    if (roleError) throw new Error(roleError.message);
    if (!steward) throw new Error("STEWARD_REQUIRED");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("thread_session_mission_selftest");
    if (error) throw new Error(error.message);
    return data;
  });
export const getSessionMissionOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ session_id: z.uuid().optional(), mission_id: z.uuid().optional() })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [missions, sessions, scope, frontier] = await Promise.all([
      sb
        .from("objects")
        .select("id,human_ref,title")
        .eq("type", "ValueMission")
        .eq("is_tombstone", false)
        .not("lifecycle_state", "in", "(closed,redirected)")
        .gte("review_date", new Date().toISOString().slice(0, 10))
        .order("title")
        .limit(200),
      sb
        .from("objects")
        .select("id,human_ref,title,body")
        .eq("type", "FramingSession")
        .eq("is_tombstone", false)
        .order("created_at", { ascending: false })
        .limit(200),
      data.session_id
        ? sb.rpc("session_mission_scope", { p_session: data.session_id })
        : Promise.resolve({ data: null, error: null }),
      sb.rpc("intent_mission_frontier", data.session_id ? { p_session: data.session_id } : {}),
    ]);
    for (const r of [missions, sessions, scope, frontier])
      if (r.error) throw new Error(r.error.message);
    const resolved = await Promise.all(
      (sessions.data ?? []).map(async (s) => {
        const r = await sb.rpc("session_mission_scope", { p_session: s.id });
        if (r.error) throw new Error(r.error.message);
        return {
          id: s.id,
          human_ref: s.human_ref,
          title: s.title,
          mission: r.data as Scope | null,
        };
      }),
    );
    return {
      missions: missions.data ?? [],
      sessions: resolved.filter((s) => !s.mission || s.mission.id === data.mission_id),
      scope: scope.data as Scope | null,
      frontier: frontier.data ?? [],
    };
  });
export const linkSessionToMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LinkSessionMissionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { linkSessionMissionCore } = await import("@/server/ops/session-mission.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return linkSessionMissionCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        userId: context.userId,
        actor: { kind: "human", id: context.userId, authority_used: "observe" },
      },
      data,
    );
  });
export const reverseSessionMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LinkSessionMissionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { linkSessionMissionCore } = await import("@/server/ops/session-mission.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return linkSessionMissionCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        userId: context.userId,
        actor: { kind: "human", id: context.userId, authority_used: "observe" },
      },
      data,
      true,
    );
  });
export const createMissionFromNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NeedMissionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { needMissionCore } = await import("@/server/ops/session-mission.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return needMissionCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        userId: context.userId,
        actor: { kind: "human", id: context.userId, authority_used: "observe" },
      },
      data,
    );
  });

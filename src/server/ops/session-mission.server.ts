import { LinkSessionMissionInput, NeedMissionInput } from "@/domain/session-mission";
import { classifyContent } from "@/domain/content-tier";
import { opErr, type OpCtx } from "./context";

export type AssociationResult = {
  recorded_as: "decision" | "suggestion";
  edge: {
    id: string;
    from_id: string;
    to_id: string;
    verb: string;
    retired_at: string | null;
  } | null;
  decision_id: string | null;
  origin?: string;
  authority_mismatch?: boolean;
};
export async function linkSessionMissionCore(ctx: OpCtx, input: unknown, reverse = false) {
  const p = LinkSessionMissionInput.parse(input);
  const { data: visible, error: readError } = await ctx.sb
    .from("objects")
    .select("id,type")
    .in("id", [p.session_id, p.mission_id])
    .eq("is_tombstone", false);
  if (readError) throw opErr(readError.message);
  if (
    visible?.length !== 2 ||
    !visible.some((o) => o.id === p.session_id && o.type === "FramingSession") ||
    !visible.some((o) => o.id === p.mission_id && o.type === "ValueMission")
  )
    throw opErr("NOT_FOUND");
  if (classifyContent(p.rationale).tier !== "A")
    throw opErr("RATIONALE_CONTENT_BLOCKED: remove sensitive personal or payment information");
  const { data, error } = await ctx.db.rpc("thread_link_session_to_mission", {
    p_actor: ctx.actor,
    p_session: p.session_id,
    p_mission: p.mission_id,
    p_rationale: p.rationale,
    p_reverse: reverse,
  });
  if (error) throw opErr(error.message);
  return data as unknown as AssociationResult;
}
export async function needMissionCore(ctx: OpCtx, input: unknown) {
  const p = NeedMissionInput.parse(input);
  const { data: n, error: readError } = await ctx.sb
    .from("objects")
    .select("id")
    .eq("id", p.need_id)
    .eq("type", "NeedStatement")
    .eq("is_tombstone", false)
    .maybeSingle();
  if (readError) throw opErr(readError.message);
  if (!n) throw opErr("NOT_FOUND");
  if (classifyContent(JSON.stringify([p.mission, p.rationale])).tier !== "A")
    throw opErr("MISSION_CONTENT_BLOCKED");
  const { data, error } = await ctx.db.rpc("thread_need_to_mission", {
    p_actor: ctx.actor,
    p_need: p.need_id,
    p_mission: p.mission,
    p_rationale: p.rationale,
  });
  if (error) throw opErr(error.message);
  return data as unknown as {
    id: string;
    human_ref: string;
    version: number;
    association: AssociationResult;
  };
}

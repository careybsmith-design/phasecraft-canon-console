import { z } from "zod/v4";
import { MissionInput } from "./human-surfaces";

export const LinkSessionMissionInput = z.object({
  session_id: z.uuid(),
  mission_id: z.uuid(),
  rationale: z.string().trim().min(3).max(2000),
}).strict();
export const ReverseSessionMissionInput = LinkSessionMissionInput;
export const NeedMissionInput = z.object({
  need_id: z.uuid(),
  mission: MissionInput,
  rationale: z.string().trim().min(3).max(2000),
}).strict();
export const SESSION_MISSION_ADVISORY = "ConfirmedIntentWithoutMission";
export function intentMissionAdvisory(type: string, state: string, status: unknown, hasMission: boolean, hasSignal: boolean) {
  if (hasMission || !["BehaviorStatement", "NeedStatement"].includes(type)) return null;
  if (type === "NeedStatement" && status === "becomes_mission" && !hasSignal) return "intent awaiting a signal";
  return ["confirmed", "active", "generating", "verified_in_simulation", "verified_in_shadow", "verified_in_production"].includes(state)
    ? "intent awaiting a mission" : null;
}
/** Phase 11 contracts shared by human surfaces and the machine operations. */
import { z } from "zod/v4";

const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.uuid();
export const MissionInput = z.object({
  signal_id: id, title: text(200), measurable_condition: text(1000), baseline: text(500), target: text(500),
  affected_population: text(500), operating_boundaries: text(1000), proof_required: text(1000),
  co_creator: id, builder: id, decision_authority: text(1000), stop_conditions: text(1000),
  maximum_investment: z.number().min(0), review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value_hypothesis: text(1000), risk_tier: z.enum(["1", "2", "3", "4"]).default("1"),
}).strict().refine((m) => m.co_creator !== m.builder, { message: "A Value Cell needs two different people.", path: ["builder"] });
export const CellInput = z.object({ mission_id: id, agents: z.array(id).max(12).default([]) }).strict();
export const BURST_PHASES = ["Intent compression", "Experience generation", "Live interaction", "Autonomous challenge", "Refinement", "Controlled exposure", "Observe and decide"] as const;
export const BurstInput = z.object({ cell_id: id, phases: z.array(text(80)).min(1).max(10).default([...BURST_PHASES]), minutes: z.number().int().min(60).max(180).default(180) }).strict();
export const FinishBurstInput = z.object({ burst_id: id, output_ids: z.array(id).min(1).max(20), rationale: text(1000) }).strict();
export const SIMULATION_CRITERIA = [
  "Began with the outcome", "Identified evidence", "Avoided prematurely selecting a solution", "Formed the appropriate Value Cell",
  "Composed existing capability before creating", "Used progressive exposure", "Applied appropriate human judgment", "Captured reusable learning",
] as const;
export const SIMULATION_ROLES = ["Business executive", "Customer", "Frontline employee", "AI Builder", "Regulator / policy constraint", "Production failure", "Conflicting stakeholder"] as const;
export const ScenarioInput = z.object({ source_ids: z.array(id).min(1).max(20), scenario: text(1000) }).strict();
export const ChoiceInput = z.object({ session_id: id, response: text(2000) }).strict();
export const CapabilitySimulationInput = z.object({ capability_id: id, scenario: text(1000) }).strict();
export const FollowInput = z.object({ kind: z.enum(["domain", "mission", "capability", "outcome", "learning"]), value: text(200), following: z.boolean() }).strict();

export function missionSentence(m: Pick<z.infer<typeof MissionInput>, "measurable_condition" | "baseline" | "target" | "affected_population" | "operating_boundaries" | "proof_required">) {
  return `Change ${m.measurable_condition} from ${m.baseline} to ${m.target} for ${m.affected_population} within ${m.operating_boundaries}, proven by ${m.proof_required}.`;
}
export function substantiveBurstOutput(o: { type: string; lifecycle_state: string; body: Record<string, unknown> }) {
  if (o.type === "WorkingCapability") return !["proposed", "draft", "retired"].includes(o.lifecycle_state);
  if (o.type === "ProductionOutcome") return o.body["adapter_mode"] === "live" && (o.body["provenance"] as { simulated?: boolean } | undefined)?.simulated !== true;
  if (o.type === "ConfirmedDecision") return Boolean(o.body["decision"]);
  return o.type === "Assumption" && o.body["disproved"] === true;
}
export function behaviouralChallenge(statement: string) {
  if (/\b(application|app|feature|software|system)\b/i.test(statement)) return "You are beginning with a requested solution. What measurable condition must change?";
  if (/status (meeting|report)|progress update/i.test(statement)) return "The evidence can answer an update request. What decision could this time resolve in a Value Burst?";
  if (/detailed requirements|handoff|hand.over/i.test(statement)) return "Who is the Business Co-Creator, and which Builder can explore the condition with them now?";
  return "What evidence establishes the condition, and could an existing capability already change it?";
}

/** Feedback is about choices in this scenario only, never a person or certification. */
export function scenarioFeedback(response: string) {
  const patterns = [/outcome|condition|baseline|target/i, /evidence|measure|observ|baseline/i, /before.*(solution|app|build)|avoid.*solution|not.*(app|solution)|condition/i,
    /co.creator|builder|value cell/i, /reuse|compos|fabric|existing capability/i, /shadow|limited exposure|progressive|rollback/i,
    /human|authority|judg|risk|guardrail/i, /learning|lesson|disprov|reusable/i];
  return SIMULATION_CRITERIA.map((criterion, i) => ({ criterion, observed: patterns[i]?.test(response) ?? false, basis: "Explicit words in the simulated choice; not verified operating evidence." }));
}
export function nextScenario(response: string, turn: number) {
  const feedback = scenarioFeedback(response);
  const role = SIMULATION_ROLES[turn % SIMULATION_ROLES.length] ?? "Business executive";
  const firstMissing = feedback.find((f) => !f.observed);
  const situations: Record<string, string> = {
    "Began with the outcome": "I asked for an application, but the observable condition has not been agreed. What should change, for whom?",
    "Identified evidence": "We disagree about what is happening. What evidence and baseline would you inspect before committing?",
    "Avoided prematurely selecting a solution": "An application has been suggested. How do you keep the intervention open while testing the condition?",
    "Formed the appropriate Value Cell": "A business decision is needed. Who holds that authority, and which Builder stays in the loop?",
    "Composed existing capability before creating": "A related capability may already exist. How will you record reuse evidence before any creation?",
    "Used progressive exposure": "The intervention fails for a small population. How would shadow, limited exposure and reversal protect them?",
    "Applied appropriate human judgment": "A policy exception affects a person's rights. What must the machine stop and ask a person to decide?",
    "Captured reusable learning": "The initial assumption was disproved. What learning and evidence should another cell be able to reuse?",
  };
  return { role, prompt: firstMissing ? situations[firstMissing.criterion] ?? "What evidence changes your next action?" : "A conflicting stakeholder challenges your assumptions. What new evidence would make you revise or stop?", feedback };
}
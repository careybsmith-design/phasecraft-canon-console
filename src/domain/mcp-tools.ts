/**
 * The Part 12.2 tool set (twelve ValueOS tools, the extended set and the Part 8A.11 tools), each with its Part 12.3
 * ToolContract. Input schemas are the Zod schemas the gateway validates with; the stored contract is generated from them.
 * status: live = runs now; pending_kernel = the kernel arrives in a later phase (typed refusal names it);
 * human_only = consent-gated capture that only a person in the session may perform (P13).
 */
import { z } from "zod/v4";
import type { AuthorityLevel, ContentOrigin } from "./mcp";
import { PLATFORMS } from "./creation";
import { MissionInput, CellInput, BurstInput } from "./human-surfaces";
import { outputSchema } from "./mcp-output";

const id = z.uuid();
const txt = (n: number) => z.string().trim().min(1).max(n);
const ids = (n = 20) => z.array(id).min(1).max(n);
const confirmation = { confirmation_token: id.optional() };

export type SideEffects = "none" | "creates_objects" | "external_call" | "production_effect";
export type ToolStatus = "live" | "pending_kernel" | "human_only";
export interface ToolDef {
  name: string; kernel: string; purpose: string; input: z.ZodObject; output: string;
  side_effects: SideEffects; authority: AuthorityLevel; risk_tier: "1" | "2" | "3" | "4"; idempotent: boolean;
  high_consequence: boolean; status: ToolStatus; pending?: string; cost: number; origin: ContentOrigin;
  compensating: string; failure_modes: string[]; per_minute: number;
}

type Opt = Partial<Omit<ToolDef, "name" | "kernel" | "purpose" | "input">>;
const D = (name: string, kernel: string, purpose: string, input: z.ZodObject, o: Opt = {}): ToolDef => {
  const side = o.side_effects ?? "none";
  const authority = o.authority ?? (side === "none" ? "observe" : side === "creates_objects" ? "recommend" : "act_with_confirmation");
  const high = o.high_consequence ?? side === "production_effect";
  return {
    name, kernel, purpose, input, output: o.output ?? "object", side_effects: side, authority, risk_tier: o.risk_tier ?? (high ? "3" : side === "none" ? "1" : "2"),
    idempotent: o.idempotent ?? side === "none", high_consequence: high, status: o.status ?? "live", ...(o.pending ? { pending: o.pending } : {}),
    cost: o.cost ?? (side === "none" ? 0.01 : 0.05), origin: o.origin ?? "canon",
    compensating: o.compensating ?? (side === "none" ? "none needed (read-only)" : side === "creates_objects" ? "tombstone the created object with a reason (versioned, never deleted)" : "record a reversal as a new version and withdraw authority"),
    failure_modes: o.failure_modes ?? ["VALIDATION_FAILED", "AUTHORITY_EXCEEDED", "NOT_FOUND", "QUOTA_EXCEEDED"], per_minute: o.per_minute ?? 60,
  };
};
const P11 = { status: "pending_kernel" as const, pending: "Capability execution harness: probe recording is available, live simulation execution is not" };
const P12 = { status: "pending_kernel" as const, pending: "Phase 12 Hardening and assurance (live assurance adapters)" };
const HUMAN = { status: "human_only" as const, pending: "consent-gated framing capture (P13): performed by a consented person in the session" };

const objectShape = {
  title: txt(200), statement: txt(4000), machine_description: txt(2000).optional(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  data_classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
};
const intentShape = z.object({ outcome: txt(500), inputs: z.array(txt(120)).max(20).default([]), outputs: z.array(txt(120)).max(20).default([]), domain: z.string().trim().max(120).default("") });

const iterationDiff = z.object({ added_obligations: z.array(txt(300)).max(20).default([]), changed_results: z.array(txt(300)).max(20).default([]),
  changed_contracts: z.array(txt(300)).max(20).default([]), text_edits: z.array(txt(300)).max(20).default([]) });

export const TOOLS: ToolDef[] = [
  // The twelve ValueOS tools (exact names)
  D("detect_value_signal", "K2", "Create a signal from evidence; the observed condition is kept separate from requested solutions (P3)",
    z.object({ observed_condition: txt(2000), affected_population: txt(500).optional(), evidence_refs: z.array(id).max(20).default([]),
      requested_solution_candidates: z.array(txt(300)).max(10).default([]), title: txt(200).optional() }).strict(),
    { side_effects: "creates_objects", authority: "observe", output: "ValueSignal envelope" }),
  D("score_value_signal", "K2", "Score magnitude, urgency, value and confidence from the signal's typed fields", z.object({ signal_id: id }).strict(), { origin: "computed", output: "{magnitude, urgency, value, confidence_bundle}" }),
  D("find_related_missions", "K2", "Locate missions and capabilities related to a condition", z.object({ condition: txt(500), limit: z.number().int().min(1).max(50).default(10) }).strict(), { output: "{missions[], capabilities[]}" }),
  D("create_value_mission", "K2", "Establish a bounded mission from a signal; a named Co-Creator is required",
    MissionInput,
    { side_effects: "creates_objects", output: "ValueMission envelope" }),
  D("recommend_value_cell", "K2", "Form the mission's named Co-Creator + Builder + governed agents", CellInput, { side_effects: "creates_objects" }),
  D("start_value_burst", "K2", "Open a bounded burst; consented capture remains a separate human action", BurstInput, { side_effects: "creates_objects" }),
  D("search_capability_fabric", "K4", "Intent-shaped capability discovery (also records nothing)", intentShape.strict(), { output: "ReuseResult[]" }),
  D("run_adversarial_simulation", "K6", "Adversarial / misuse testing against a capability", z.object({ capability_id: id, scenario: txt(1000) }).strict(), { ...P11, side_effects: "creates_objects" }),
  D("request_exposure_authority", "K3", "Request productive exposure; the authority engine decides and a person is asked through the Human Decision Queue",
    z.object({ capability_id: id, population_pct: z.number().min(0).max(100), reason: txt(1000) }).strict(), { side_effects: "creates_objects", authority: "observe", output: "HumanDecisionRequest envelope" }),
  D("monitor_outcome_evidence", "K7", "Retrieve production and value evidence (permission-scoped)", z.object({ capability_id: id }).strict(), { output: "{production_outcomes[], value_measures[], incidents[]}" }),
  D("publish_reusable_capability", "K4", "Publish a primitive to the fabric (steward or owner)", z.object({ capability_id: id, contract_id: id, ...confirmation }).strict(),
    { side_effects: "production_effect", authority: "act_with_confirmation", high_consequence: true, compensating: "retire_capability with a reason" }),
  D("detect_legacy_behavior", "K8", "Evaluate observed behaviour text against the withdrawn-object anti-pattern set (Part 2.4)", z.object({ text: txt(4000) }).strict(), { origin: "computed", output: "{matches[]}" }),

  // Operating Graph
  D("get_object", "K1", "Read one canon object by id or human_ref", z.object({ id: id.optional(), human_ref: z.string().regex(/^[A-Z]{2}-\d{4}-\d{4}$/).optional() }).strict(), { output: "ObjectEnvelope" }),
  D("search_graph", "K1", "Full-text search of canon objects you may read", z.object({ q: txt(200), types: z.array(txt(60)).max(10).optional(), limit: z.number().int().min(1).max(50).default(20) }).strict(), { output: "Envelope[]" }),
  D("traverse_graph", "K1", "Neighbourhood of an object with an edge budget", z.object({ root: id, depth: z.number().int().min(1).max(4).default(2), verbs: z.array(txt(60)).max(20).optional() }).strict(), { output: "{nodes, edges, truncated}" }),
  D("get_rendition", "K9", "Open a rendition made for this agent and purpose", z.object({ id, purpose: txt(200) }).strict(), { origin: "generated" }),
  D("list_renditions", "K9", "List renditions made for this agent", z.object({}).strict(), { origin: "generated" }),
  D("propose_canon_change", "K1", "Propose a new version of an active canon object (challenge window applies, P15)",
    z.object({ object_id: id, patch: z.object({ title: txt(200).optional(), statement: txt(4000).optional() }).strict(), rationale: txt(2000), evidence_refs: z.array(id).max(20).default([]) }).strict(), { side_effects: "creates_objects" }),
  D("challenge_canon", "K1", "Add a counter-argument to an open canon change", z.object({ change_id: id, argument: txt(2000), evidence_refs: z.array(id).max(20).default([]) }).strict(), { side_effects: "creates_objects" }),
  D("get_canon_history", "K1", "Version history and ledger of an object", z.object({ object_id: id }).strict()),

  // Intent
  D("add_behavior_statement", "K2", "Add a draft Behaviour Statement (condition → observable result)", z.object({ condition: txt(1000), observable_result: txt(1000), operating_constraints: z.array(txt(300)).max(10).default([]), source_decision_ref: id.optional(), title: txt(200).optional() }).strict(), { side_effects: "creates_objects" }),
  D("confirm_behavior_statement", "K2", "Confirm a Behaviour Statement (only its owner or a steward may)", z.object({ id, expected_version: z.number().int().min(1), rationale: txt(1000) }).strict(), { status: "human_only", pending: "a person confirms intent and records decisions; an agent may request one with request_human_decision", side_effects: "creates_objects", authority: "act_with_confirmation" }),
  D("record_decision", "K3", "Record a ConfirmedDecision under stated authority", z.object({ decision: txt(2000), context: txt(2000), alternatives: z.array(txt(300)).max(10).default([]), rationale: txt(2000), reversibility: z.enum(["trivial", "assisted", "difficult", "impossible"]) }).strict(), { status: "human_only", pending: "a person confirms intent and records decisions; an agent may request one with request_human_decision", side_effects: "creates_objects", authority: "act_with_confirmation" }),
  D("raise_open_question", "K2", "Raise an unresolved question", z.object({ question: txt(1000), why_it_matters: txt(1000), blocking: z.boolean().default(false) }).strict(), { side_effects: "creates_objects" }),
  D("record_assumption", "K2", "Record an assumption awaiting verification", z.object({ statement: txt(1000), basis: txt(1000), verification_method: txt(500) }).strict(), { side_effects: "creates_objects" }),
  D("disprove_assumption", "K2", "Retire an assumption that evidence disproved", z.object({ id, expected_version: z.number().int().min(1), evidence_refs: ids(), rationale: txt(1000) }).strict(), { side_effects: "creates_objects" }),
  D("update_intent_model", "K2", "Revise a draft intent object", z.object({ id, expected_version: z.number().int().min(1), patch: z.object({ title: txt(200).optional(), statement: txt(4000).optional() }).strict(), rationale: txt(1000) }).strict(), { side_effects: "creates_objects" }),

  // Evidence graph
  D("explain_capability", "K7", "Answer one of the nine evidence questions with citations",
    z.object({ capability_id: id, question: z.enum(["authority", "decision", "evidence", "version", "tests", "exposure", "outcome", "value", "justification"]) }).strict()),
  D("trace_chain", "K7", "The eight-link signal-to-value chain of a capability", z.object({ capability_id: id }).strict()),
  D("blast_radius", "K7", "What a change to a behaviour statement would affect", z.object({ behavior_id: id }).strict()),
  D("find_gaps", "K7", "Missing links in a capability's evidence chain", z.object({ capability_id: id }).strict()),
  D("find_orphans", "K7", "Non-draft objects with no relationships", z.object({ limit: z.number().int().min(1).max(200).default(50) }).strict()),
  D("find_unowned", "K7", "Value results with no owner", z.object({}).strict()),

  // Creation loop
  D("record_reuse_check", "K4", "Search the fabric and record the reuse decision (P11: required before creation)",
    z.object({ intent_shape: intentShape, decision: z.enum(["reuse_as_is", "compose_existing", "create_new"]), rationale: txt(2000), behavior_statement_id: id.optional() }).strict(), { side_effects: "creates_objects" }),
  D("compile_creation_prompt", "K5", "Compile a creation prompt from typed, confirmed fields only (13.4)",
    z.object({ behavior_ids: ids(), contract_id: id, template_id: id, reuse_check_id: id, target_platform: z.enum(PLATFORMS), mission_ref: id.optional(), estimated_cost: z.number().min(0).max(100000).default(0) }).strict(),
    { side_effects: "creates_objects", output: "CreationPrompt envelope" }),
  D("dispatch_build", "K5", "Send a compiled prompt to one builder through the BuildPlatform adapter",
    z.object({ prompt_id: id, platform: z.enum(PLATFORMS), cost_ceiling: z.number().positive().max(100000), estimated_cost: z.number().min(0).max(100000).default(0), ...confirmation }).strict(),
    { side_effects: "external_call", high_consequence: true, cost: 1, compensating: "record a failed result; the run is versioned evidence and can be replayed" }),
  D("record_build_run", "K5", "Read a build run and its result", z.object({ run_id: id }).strict()),
  D("attach_artifact", "K5", "Attach a build artifact to a run", z.object({ run_id: id, kind: txt(60), uri: z.url() }).strict(), { side_effects: "creates_objects", status: "pending_kernel", pending: "live BuildPlatform adapters (artifacts arrive by signed webhook)" }),
  D("record_iteration", "K5", "Record an iteration between two runs with its declared change class (scope smuggling is flagged)", z.object({ from_run: id, to_run: id,
    declared_class: z.enum(["cosmetic", "behavioural", "scope", "architecture"]), trigger: z.string().trim().max(300).optional(), diff: iterationDiff }).strict(), { side_effects: "creates_objects" }),
  D("classify_change", "K5", "Classify a described change (cosmetic, behavioural, scope, architecture)", iterationDiff.strict(), { origin: "computed" }),

  // Authority and governance
  D("evaluate_authority", "K3", "Evaluate a proposed action and record its deterministic policy decision, never execute it", z.object({ object_id: id, action: txt(120) }).strict(), { side_effects: "creates_objects", authority: "observe", idempotent: false, origin: "computed" }),
  D("request_human_decision", "K3", "Put a decision to a person in the Human Decision Queue (Part 6.5 fields)",
    z.object({ subject_id: id, exact_decision_required: txt(1000), reason_ai_cannot_safely_decide: txt(1000), ai_recommendation: txt(1000), viable_alternatives: z.array(txt(300)).min(1).max(6), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), cost_of_waiting: txt(500), reversibility: z.enum(["trivial", "assisted", "difficult", "impossible"]) }).strict(),
    { side_effects: "creates_objects", authority: "observe" }),
  D("grant_exposure_authority", "K3", "Authorise exposure (people only: agents are refused by the database)", z.object({ capability_id: id, population_pct: z.number().min(0).max(100), rationale: txt(1000), ...confirmation }).strict(), { side_effects: "production_effect", authority: "act_with_confirmation", status: "human_only", pending: "only an accountable human may grant exposure authority" }),
  D("withdraw_authority", "K3", "Withdraw authority from an object", z.object({ object_id: id, reason: txt(1000), ...confirmation }).strict(), { side_effects: "production_effect", authority: "act_with_confirmation" }),
  D("evaluate_policy", "K3", "List active guardrails and the latest policy evaluations for an object", z.object({ object_id: id }).strict()),
  D("check_guardrails", "K3", "Scan text against the injection and prohibited-inference guardrails", z.object({ text: txt(4000) }).strict(), { origin: "computed" }),
  D("escalate_to_council", "K3", "Escalate a decision to the council", z.object({ request_id: id, reason: txt(1000) }).strict(), { status: "pending_kernel", pending: "council membership adapter (council decisions are recorded by a steward today)", side_effects: "creates_objects" }),

  // Shadow and production
  D("start_shadow", "K6", "Record a shadow run with its cases", z.object({ capability_id: id, sample_size: z.number().int().min(1).max(1000000),
    cases: z.array(z.object({ ref: txt(80), shadow: txt(200), actual: txt(200), cause: z.enum(["data_distribution", "edge_case", "policy_gap", "model_error", "integration", "unknown"]).default("unknown") }).strict()).max(500).default([]) }).strict(), { side_effects: "creates_objects" }),
  D("record_discrepancy", "K6", "Record a single discrepancy outside a run", z.object({ shadow_run_id: id, ref: txt(80) }).strict(), { status: "pending_kernel", pending: "discrepancies are recorded inside start_shadow today", side_effects: "creates_objects" }),
  D("record_production_outcome", "K7", "Record a production outcome", z.object({ capability_id: id, outcome: txt(1000), measured_at: z.string().max(40).optional() }).strict(), { side_effects: "creates_objects" }),
  D("record_value_measure", "K7", "Record a value measure against a mission", z.object({ mission_id: id, measure: txt(300), value: z.number(), unit: txt(40), baseline: z.number().optional() }).strict(), { side_effects: "creates_objects" }),
  D("raise_incident", "K6", "Raise an incident on a capability", z.object({ capability_id: id, severity: z.enum(["minor", "major", "critical"]), description: txt(2000) }).strict(), { side_effects: "creates_objects" }),
  D("execute_rollback", "K6", "Record a rollback on a capability", z.object({ capability_id: id, reason: txt(1000), ...confirmation }).strict(), { side_effects: "production_effect" }),
  D("arm_kill_switch", "K6", "Pull the kill switch on a capability", z.object({ capability_id: id, reason: txt(1000), ...confirmation }).strict(), { side_effects: "production_effect" }),

  // Assurance
  D("run_test_suite", "K6", "Run a capability's test suite", z.object({ capability_id: id }).strict(), P12),
  D("run_simulation", "K6", "Run a scenario simulation", z.object({ capability_id: id, scenario: txt(1000) }).strict(), P11),
  D("run_adversarial", "K6", "Run adversarial tests", z.object({ capability_id: id }).strict(), P11),
  D("run_model_evaluation", "K6", "Evaluate a model route", z.object({ route: txt(120) }).strict(), P12),
  D("scan_security", "K6", "Security scan of a build", z.object({ run_id: id }).strict(), P12),
  D("evaluate_accessibility", "K6", "Accessibility evaluation of a build", z.object({ run_id: id }).strict(), P12),
  D("check_data_use_permission", "K3", "Data-use permissions that apply to an object", z.object({ object_id: id }).strict()),

  // Capability fabric
  D("get_capability_contract", "K4", "The contract of a capability", z.object({ capability_id: id }).strict()),
  D("compose_capabilities", "K4", "Compose existing capabilities into a new draft", z.object({ ids: ids(10), title: txt(200), scenario: txt(1000) }).strict(), { side_effects: "creates_objects" }),
  D("propose_capability", "K4", "Propose a new capability draft (a reuse check must allow creation)", z.object({ ...objectShape, reuse_check_id: id }).strict(), { side_effects: "creates_objects" }),
  D("retire_capability", "K4", "Retire a capability", z.object({ capability_id: id, expected_version: z.number().int().min(1), reason: txt(1000), ...confirmation }).strict(), { side_effects: "production_effect" }),
  D("check_capability_usage", "K4", "Usage evidence for a capability (aggregate only)", z.object({ capability_id: id }).strict()),

  // Detectors and measurement
  D("list_detector_findings", "K8", "Open detector findings you may read", z.object({ detector_key: txt(80).optional(), limit: z.number().int().min(1).max(200).default(50) }).strict()),
  D("resolve_finding", "K8", "Resolve a finding; only a person may accept risk", z.object({ finding_id: id, resolution: txt(1000) }).strict(), { side_effects: "creates_objects" }),
  D("measure_flow", "K8", "Flow measures", z.object({ scope: txt(200) }).strict(), { origin: "computed" }),
  D("measure_value", "K8", "Value measures", z.object({ scope: txt(200) }).strict(), { origin: "computed" }),
  D("measure_capability_health", "K8", "Capability health measures", z.object({ capability_id: id }).strict(), { origin: "computed" }),
  D("measure_community", "K8", "Community measures (aggregate only)", z.object({ scope: txt(200) }).strict(), { origin: "computed" }),
  D("get_intent_to_value_time", "K8", "Intent-to-value time computed from the graph", z.object({ capability_id: id }).strict(), { origin: "computed" }),

  // Generation
  D("generate_briefing", "K9", "Generate the caller's morning intelligence brief", z.object({}).strict(), { side_effects: "creates_objects", origin: "generated", cost: 0.5 }),
  D("generate_explanation", "K9", "Generate a cited explanation of chosen objects for a purpose", z.object({ source_ids: ids(), purpose: txt(200), focus: z.string().trim().max(1000).default("") }).strict(), { side_effects: "creates_objects", origin: "generated", cost: 0.5 }),
  D("generate_scenario", "K9", "Generate a role-specific scenario rendition", z.object({ source_ids: ids(), purpose: txt(200), focus: z.string().trim().max(1000).default("") }).strict(), { side_effects: "creates_objects", origin: "generated", cost: 0.5 }),
  D("generate_decision_tree", "K9", "Generate a decision-tree rendition", z.object({ source_ids: ids(), purpose: txt(200), focus: z.string().trim().max(1000).default("") }).strict(), { side_effects: "creates_objects", origin: "generated", cost: 0.5 }),

  // Part 8A.11 framing tools
  D("start_framing_session", "K2", "Start a framing session", z.object({ purpose: txt(500), co_creator: id, builder: id, participants: z.array(id).max(20).default([]), mission_ref: id.optional() }).strict(), { ...HUMAN, side_effects: "creates_objects" }),
  D("capture_artifact", "K2", "Capture a session artifact", z.object({ session_id: id, kind: txt(60) }).strict(), { ...HUMAN, side_effects: "creates_objects", origin: "captured_data" }),
  D("extract_from_artifact", "K2", "Extract statements from an artifact", z.object({ artifact_id: id }).strict(), { ...HUMAN, side_effects: "creates_objects", origin: "captured_data" }),
  D("classify_statement", "K2", "Correct a statement's classification", z.object({ statement_id: id, classification: txt(60) }).strict(), { ...HUMAN, side_effects: "creates_objects" }),
  D("log_need", "K2", "Log a need statement (draft)", z.object({ statement: txt(1000), observed_condition: txt(1000) }).strict(), { side_effects: "creates_objects" }),
  D("log_behavior_statement", "K2", "Log a behaviour statement (draft)", z.object({ condition: txt(1000), observable_result: txt(1000), constraints: z.array(txt(300)).max(10).default([]) }).strict(), { side_effects: "creates_objects" }),
  D("link_need_to_behavior", "K2", "Link a need to a behaviour statement", z.object({ need_id: id, behavior_id: id }).strict(), { side_effects: "creates_objects" }),
  D("propose_dependency", "K2", "Propose a typed dependency (inferred until a person confirms)", z.object({ from_id: id, to_id: id, kind: z.enum(["data", "sequence", "authority", "capability", "decision"]) }).strict(), { side_effects: "creates_objects" }),
  D("confirm_object", "K2", "Confirm a drafted object (owner or steward)", z.object({ object_id: id, expected_version: z.number().int().min(1), to_state: txt(40), rationale: txt(1000) }).strict(), { status: "human_only", pending: "a person confirms intent and records decisions; an agent may request one with request_human_decision", side_effects: "creates_objects", authority: "act_with_confirmation" }),
  D("confirm_relationship", "K2", "Confirm an inferred relationship", z.object({ edge_id: id }).strict(), HUMAN),
  D("surface_prior_objects", "K2", "Prior needs, decisions and capabilities related to a statement", z.object({ statement: txt(1000) }).strict()),
  D("find_contradictions", "K2", "Contradicting statement pairs in the graph", z.object({}).strict()),
  D("render_need_web", "K2", "Need web around an object", z.object({ root_id: id, depth: z.number().int().min(1).max(4).default(2) }).strict()),
  D("render_dependency_web", "K2", "Dependency web around an object", z.object({ root_id: id, depth: z.number().int().min(1).max(4).default(2) }).strict()),
  D("render_unresolved_frontier", "K2", "Unresolved questions and assumptions of a mission", z.object({ mission_ref: id }).strict()),
  D("close_framing_session", "K2", "Close a framing session with its entry test", z.object({ session_id: id }).strict(), HUMAN),

  // Agent surface itself
  D("list_notifications", "K5", "Take pending notifications for this agent's subscriptions", z.object({ limit: z.number().int().min(1).max(200).default(50) }).strict(), { side_effects: "none" }),
  D("send_agent_message", "K5", "A2A: send a typed message to another registered agent (recorded in provenance)", z.object({ to_agent_id: id, intent: z.enum(["request_review", "share_finding", "handoff", "question"]), object_refs: z.array(id).max(20).default([]) }).strict(), { side_effects: "creates_objects", origin: "agent_message_data" }),
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
export const TOOL_CONTRACT_VERSION = "audit-1";

export function toolContract(t: ToolDef) {
  return {
    name: t.name, purpose: t.purpose, kernel: t.kernel,
    input_schema: z.toJSONSchema(t.input, { io: "input" }), output_schema: { ...z.toJSONSchema(outputSchema(t.name)), description: t.output, content_origin: t.origin },
    risk_tier: t.risk_tier, authority_required: t.authority, side_effects: t.side_effects, idempotent: t.idempotent,
    requires_policy_evaluation: t.side_effects !== "none", provenance_capture: true,
    permission_predicate: "evaluated at retrieval as the agent's own identity (row-level permissions), never at render",
    rate_limits: { per_minute: t.per_minute, agent_quota: "agents.quota" }, cost_model: { units_per_call: t.cost, cap: "agents.cost_cap per day" },
    failure_modes: [...t.failure_modes, ...(t.high_consequence ? ["CONFIRMATION_REQUIRED"] : []), ...(t.status === "human_only" ? ["HUMAN_ONLY"] : t.status === "pending_kernel" ? ["PENDING_KERNEL"] : []), "INJECTION_SUSPECTED"],
    compensating_action: t.compensating, high_consequence: t.high_consequence, status: t.status, ...(t.pending ? { pending: t.pending } : {}),
  };
}

/** The twelve names Section 11 requires verbatim. */
export const VALUEOS_TOOLS = ["detect_value_signal", "score_value_signal", "find_related_missions", "create_value_mission", "recommend_value_cell", "start_value_burst",
  "search_capability_fabric", "run_adversarial_simulation", "request_exposure_authority", "monitor_outcome_evidence", "publish_reusable_capability", "detect_legacy_behavior"] as const;

import { z } from "zod/v4";
import { ENVELOPE_COLUMNS } from "./object-read";

// JSON only: undefined/functions/class instances/non-finite numbers must never disappear in serialization.
function validJson(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  seen.add(value);
  const result = Object.values(value).every((item) => validJson(item, seen));
  seen.delete(value);
  return result;
}
const json = z.json().refine((value) => validJson(value), "Output must be finite plain JSON");
const object = (keys: string[]) => z.object(Object.fromEntries(keys.map((key) => [key, json]))).catchall(json);
const envelope = object(ENVELOPE_COLUMNS.split(",")).extend({
  id: z.uuid(), human_ref: z.string().min(1), type: z.string().min(1), schema_version: z.string().min(1),
  version: z.number().int().positive(), lifecycle_state: z.string().min(1),
  body: z.record(z.string(), json), permission: z.record(z.string(), json),
  expiration_condition: z.record(z.string(), json), retirement_path: z.record(z.string(), json),
  evidence_refs: z.array(z.uuid()), provenance_chain_id: z.uuid(), content_hash: z.string().min(1),
  supersedes: z.array(z.uuid()), superseded_by: z.array(z.uuid()), derived_from: z.array(z.uuid()),
  permitted_uses: z.array(z.string()), open_questions: z.array(z.string()), is_tombstone: z.boolean(),
});
const arrays = new Set(["search_capability_fabric", "search_graph", "list_renditions", "check_data_use_permission", "list_detector_findings", "measure_value", "measure_capability_health", "find_contradictions", "render_unresolved_frontier", "list_notifications"]);
const arrayFields: Record<string, string[]> = {
  search_capability_fabric: ["capability_id", "match_score", "reuse_mode", "gaps"], search_graph: ["id", "human_ref", "type"], list_renditions: ["id", "kind", "state"], check_data_use_permission: ["id", "body"],
  list_detector_findings: ["id", "detector_key", "severity", "state"], measure_value: ["id", "ref", "evidence"], measure_capability_health: ["id", "authority", "usage"],
  find_contradictions: ["edge", "a", "b"], render_unresolved_frontier: ["id", "human_ref", "type"], list_notifications: ["id", "topic", "ledger_seq", "body"],
};
const fields: Record<string, string[]> = {
  score_value_signal: ["signal", "magnitude", "urgency", "value", "confidence_bundle", "unscored"],
  find_related_missions: ["missions", "capabilities"], create_value_mission: ["id", "human_ref", "version"], recommend_value_cell: ["id", "human_ref", "version"], start_value_burst: ["id", "human_ref", "version"],
  monitor_outcome_evidence: ["capability", "production_outcomes", "value_measures", "incidents"], detect_legacy_behavior: ["legacy", "matches"],
  traverse_graph: ["root", "nodes", "edges", "total_edges", "edge_budget"], get_canon_history: ["versions", "ledger"],
  explain_capability: ["question", "answered", "answer", "citations"], trace_chain: ["root", "links", "completeness"],
  blast_radius: ["root", "count", "nodes"], find_gaps: ["object_id", "missing", "present", "total", "score"], find_orphans: ["count", "nodes"], find_unowned: ["query", "count", "rows"],
  record_reuse_check: ["reuse_check_id", "results"], dispatch_build: ["run_id", "human_ref", "status"], record_build_run: ["id", "human_ref", "run"], record_iteration: ["iteration_id", "human_ref", "classification", "detected_class", "scope_change_flag"],
  classify_change: ["detected_class", "governance", "scope_smuggled_if_declared_cosmetic"], evaluate_authority: ["outcome", "risk", "policy_evaluation", "decision_request"],
  evaluate_policy: ["guardrails", "evaluations"], check_guardrails: ["injection", "prohibited_inference"], start_shadow: ["shadow_run_id", "human_ref", "simulated"],
  record_production_outcome: ["outcome_id", "human_ref"], record_value_measure: ["measure_id", "human_ref"], raise_incident: ["incident_id", "human_ref", "severity"], execute_rollback: ["rollback_id", "human_ref"], arm_kill_switch: ["rollback_id", "human_ref", "stopped_at"],
  get_capability_contract: ["capability", "contracts"], compose_capabilities: ["composition_id", "human_ref", "effective_authority"], check_capability_usage: ["uses", "consumers", "note"], resolve_finding: ["ledger_seq"],
  measure_flow: ["judgment_latency", "stage_times"], measure_community: ["reuse", "status"], get_intent_to_value_time: ["capability_id", "hours", "status"],
  surface_prior_objects: ["needs", "decisions", "capabilities"], render_need_web: ["root", "nodes", "edges", "edge_budget"], render_dependency_web: ["root", "nodes", "edges", "edge_budget"], send_agent_message: ["ledger_seq"],
  link_need_to_behavior: ["id", "verb", "from_id", "to_id"], propose_dependency: ["id", "verb", "from_id", "to_id"],
};
export function outputSchema(name: string) {
  if (name === "get_object") return envelope;
  if (name === "search_graph") return z.array(envelope);
  if (arrays.has(name)) return z.array(object(arrayFields[name] ?? []));
  if (name.startsWith("generate_")) return z.union([
    object(["refused", "rendition_id", "human_ref", "ledger_seq"]).extend({ refused: z.literal(false) }),
    object(["refused", "reason"]).extend({ refused: z.literal(true) }),
    object(["skipped", "reason"]).extend({ skipped: z.literal(true) }),
  ]);
  return object(fields[name] ?? ["id"]);
}
export function validateToolOutput(name: string, value: unknown) {
  if (!validJson(value)) throw new Error("OUTPUT_VALIDATION_FAILED: result is not finite plain JSON");
  const result = outputSchema(name).safeParse(value);
  if (!result.success) throw new Error("OUTPUT_VALIDATION_FAILED: handler result does not satisfy its published contract");
  return result.data;
}
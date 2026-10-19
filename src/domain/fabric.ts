/**
 * Capability Fabric rules (Layer B Part 7), pure. Mirrored in SQL by `thread_publish_capability`,
 * `reuse_checks_guard`, `fabric_search` and `thread_fabric_sweep`.
 */
export const LADDER = [
  "observe",
  "recommend",
  "act_with_confirmation",
  "act_bounded",
  "autonomous_with_exception",
] as const;
export type Level = (typeof LADDER)[number];

/** 7.2 contract fields (verbatim list) -> ComposableCapability body keys. Every one must be present to publish. */
export const CONTRACT_FIELDS: Array<[label: string, keys: string[]]> = [
  ["Business outcome and plain-language purpose", ["business_outcome", "plain_language_purpose"]],
  ["Machine-discoverable description", ["machine_description"]],
  ["Intended users and consumers", ["intended_consumers"]],
  ["Input and output schemas", ["input_schema", "output_schema"]],
  ["Preconditions and dependencies", ["preconditions", "dependencies"]],
  ["Business rules and exceptions", ["business_rules", "exceptions"]],
  ["Data classifications and permitted uses", ["data_classifications", "permitted_uses"]],
  ["Authority level and risk tier", ["authority_level", "risk_tier"]],
  [
    "Policy, security, privacy and accessibility constraints",
    ["policy_constraints", "security_privacy_accessibility_constraints"],
  ],
  ["Confidence and evidence requirements", ["confidence_requirements"]],
  ["Explainability and audit behaviour", ["explainability_audit_behaviour"]],
  ["Failure modes and recovery behaviour", ["failure_modes", "recovery_behaviour"]],
  ["Human-intervention conditions", ["human_intervention_conditions"]],
  ["Tests, simulations and evaluation results", ["test_simulation_evaluation_refs"]],
  ["Service levels and performance limits", ["service_levels"]],
  ["Cost and resource telemetry", ["cost_resource_telemetry_ref"]],
  ["Version and compatibility information", ["version", "compatibility"]],
  ["Owner and stewardship model", ["owner_and_stewardship"]],
  [
    "Review date, minimum-use threshold and retirement condition",
    ["review_date", "minimum_use_threshold", "retirement_condition"],
  ],
];
/** 7.6 fields every capability receives at creation. */
export const LIFECYCLE_FIELDS = [
  "value_hypothesis",
  "owner",
  "review_date",
  "operating_cost_ceiling",
  "minimum_use_threshold",
  "performance_thresholds",
  "risk_thresholds",
  "expiration_condition",
  "retirement_path",
] as const;

/** Keys that are taken from the envelope rather than the body. */
const ENVELOPE_KEYS = new Set([
  "machine_description",
  "authority_level",
  "risk_tier",
  "review_date",
  "owner",
  "expiration_condition",
  "retirement_path",
]);

const present = (v: unknown) =>
  v !== undefined &&
  v !== null &&
  !(typeof v === "string" && !v.trim()) &&
  !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

export function contractGaps(body: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const [label, keys] of CONTRACT_FIELDS) {
    if (keys.some((k) => !ENVELOPE_KEYS.has(k) && !present(body[k]))) missing.push(label);
  }
  for (const k of LIFECYCLE_FIELDS)
    if (!ENVELOPE_KEYS.has(k) && !present(body[k])) missing.push(`7.6 ${k.replaceAll("_", " ")}`);
  return missing;
}
export const BODY_REQUIRED_KEYS = [
  ...new Set([...CONTRACT_FIELDS.flatMap(([, k]) => k), ...LIFECYCLE_FIELDS]),
].filter((k) => !ENVELOPE_KEYS.has(k));

/** 7.5: a composition's effective authority is the minimum of its parts. */
export function effectiveAuthority(levels: Level[]): Level {
  if (!levels.length) return "observe";
  return LADDER[Math.min(...levels.map((l) => LADDER.indexOf(l)))]!;
}

export type ReuseMode = "use_as_is" | "compose" | "extend";
export interface ReuseResult {
  capability_id: string;
  match_score: number;
  reuse_mode: ReuseMode;
  gaps: string[];
}
export type ReuseDecision = "reuse_as_is" | "compose_existing" | "create_new";

/** 7.4: create_new requires results empty OR every result has recorded gaps, AND a rationale. */
export function reuseDecisionError(
  results: ReuseResult[],
  decision: ReuseDecision,
  rationale: string,
): string | null {
  if (!rationale.trim()) return "RATIONALE_REQUIRED: a human or agent rationale is present";
  if (decision === "create_new" && results.some((r) => r.gaps.length === 0))
    return "CREATE_NEW_BLOCKED: a matching capability has no recorded gaps; reuse or compose it, or record its gaps";
  if (decision !== "create_new" && results.length === 0)
    return "NOTHING_TO_REUSE: no results to reuse or compose";
  return null;
}

export interface IntentShape {
  outcome: string;
  inputs: string[];
  outputs: string[];
  domain: string;
}
/** Contract-shape match: overlap of named inputs and outputs with the capability's schemas (0..1). */
export function shapeMatch(
  intent: IntentShape,
  inputs: string[],
  outputs: string[],
): { score: number; gaps: string[] } {
  const norm = (a: string[]) => new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const wi = norm(intent.inputs),
    wo = norm(intent.outputs),
    ci = norm(inputs),
    co = norm(outputs);
  const gaps = [
    ...[...wi].filter((x) => !ci.has(x)).map((x) => `missing input ${x}`),
    ...[...wo].filter((x) => !co.has(x)).map((x) => `missing output ${x}`),
  ];
  const want = wi.size + wo.size;
  const hit = [...wi].filter((x) => ci.has(x)).length + [...wo].filter((x) => co.has(x)).length;
  return { score: want ? hit / want : 0, gaps };
}

/** DESIGN DECISION: final score = 0.6 text relevance + 0.4 shape match; mode follows score and gaps. */
export function reuseMode(score: number, gaps: string[]): ReuseMode {
  if (!gaps.length && score >= 0.5) return "use_as_is";
  return score >= 0.35 ? "compose" : "extend";
}

/** 7.6: automatic retirement test. Usage below the minimum after a full window, or expiry. */
export function retirementDue(p: {
  uses_in_window: number;
  minimum_use: number;
  published_days: number;
  window_days: number;
  expired: boolean;
}): string | null {
  if (p.expired) return "expiration condition met";
  if (p.published_days >= p.window_days && p.uses_in_window < p.minimum_use)
    return `use below minimum (${p.uses_in_window} < ${p.minimum_use} in ${p.window_days} days)`;
  return null;
}

/**
 * Evidence graph (Layer B Part 5). Mirrors the SQL in evidence_chain / _explain / trace_*.
 * Change both together.
 */
export const CHAIN_LINKS = [
  { link: "signal", label: "Source Signal" },
  { link: "decision", label: "Confirmed Decision" },
  { link: "behavior", label: "Intended Behaviour" },
  { link: "implement", label: "Implement" },
  { link: "test", label: "Test + Simulate" },
  { link: "release", label: "Release Authority" },
  { link: "outcome", label: "Production Outcome" },
  { link: "value", label: "Value" },
] as const;
export type ChainLink = (typeof CHAIN_LINKS)[number]["link"];

/** Part 5.3. DESIGN DECISION: "decision" answers why it exists; "authority" answers which decision authorised it. */
export const QUESTIONS = [
  { q: "decision", label: "Why does it exist?" },
  { q: "authority", label: "Which decision authorised it?" },
  { q: "evidence", label: "What evidence supported that decision?" },
  { q: "version", label: "Which version implemented it?" },
  { q: "tests", label: "Which tests and simulations evaluated it?" },
  { q: "exposure", label: "Who or what authorised exposure?" },
  { q: "outcome", label: "What happened in production?" },
  { q: "value", label: "What value, cost, risk or harm emerged?" },
  { q: "justification", label: "Is continued operation still justified?" },
] as const;
export type Question = (typeof QUESTIONS)[number]["q"];

/** Part 5.4 queries with their Part 16.4 budgets (ms). `input` names the start object type, if any. */
export const TRACES = [
  {
    n: 1,
    fn: "trace_blast_radius",
    label: "Blast radius of a Behaviour Statement change",
    input: "BehaviorStatement",
    budget: 800,
  },
  {
    n: 2,
    fn: "trace_canon_change_impact",
    label: "Everything affected by a Guardrail, Pattern or Authority rule change",
    input: "Canon",
    budget: 800,
  },
  {
    n: 3,
    fn: "trace_value_without_owner",
    label: "Capabilities producing value with no current owner",
    input: null,
    budget: 1000,
  },
  {
    n: 4,
    fn: "trace_production_without_value",
    label: "In production with no value evidence in the last review period",
    input: null,
    budget: 1000,
  },
  {
    n: 5,
    fn: "trace_behaviors_without_tests",
    label: "Behaviour statements with no test coverage",
    input: null,
    budget: 1000,
  },
  {
    n: 6,
    fn: "trace_production_without_decision",
    label: "Production behaviours with no Confirmed Decision ancestor",
    input: null,
    budget: 1000,
  },
  {
    n: 7,
    fn: "trace_expired_exposures",
    label: "Exposure authorisations past effective_to with no renewal",
    input: null,
    budget: 1000,
  },
  {
    n: 8,
    fn: "trace_incident_to_decision",
    label: "Causal chain from an Incident back to a Decision",
    input: "Incident",
    budget: 1000,
  },
  {
    n: 9,
    fn: "trace_retirement_impact",
    label: "Everything affected if a Composable Capability were retired",
    input: "ComposableCapability",
    budget: 800,
  },
  {
    n: 10,
    fn: "trace_full_chain",
    label: "Full chain for any object, with hop depth and evidence",
    input: "any",
    budget: 1500,
  },
] as const;
export type TraceFn = (typeof TRACES)[number]["fn"];

/** DESIGN DECISION: the "last review period" for query 4 and justification is 90 days until a steward sets it. */
export const REVIEW_PERIOD_DAYS = 90;

export interface LinkSummary {
  link: ChainLink;
  present: boolean;
  count: number;
}
export function completeness(links: LinkSummary[]) {
  const present = links.filter((l) => l.present).length;
  return {
    present,
    total: 8,
    missing: links.filter((l) => !l.present).map((l) => l.link),
    score: Math.round((present / 8) * 1000) / 1000,
  };
}

/** Part 5.2: state rules for capabilities. Returns the error code or null. */
export function capabilityStateError(
  to: string,
  has: { exposureAuthorisation: boolean; valueMeasure: boolean },
): string | null {
  if ((to === "limited_exposure" || to === "producing_value") && !has.exposureAuthorisation)
    return "EXPOSURE_NOT_AUTHORISED";
  if (to === "producing_value" && !has.valueMeasure) return "VALUE_MEASURE_REQUIRED";
  return null;
}

/** Part 5.2: a behaviour reaches creation only when confirmed and with a Confirmed Decision ancestor. */
export function canReachCreation(state: string, hasDecisionAncestor: boolean) {
  return !["draft", "proposed", "rejected", "superseded"].includes(state) && hasDecisionAncestor;
}

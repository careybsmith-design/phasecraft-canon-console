/**
 * Phase 7 shadow, exposure and production outcome rules (Part 9, Part 6.2). Pure and mirrored in SQL
 * (migration 0023_phase7_shadow_exposure: thread_record_shadow_run, thread_authorize_exposure,
 * thread_kill_switch, thread_record_incident). Change both together.
 */

/** Discrepancy rate above this breaches the bound and demotes (mirrors PROMOTION_THRESHOLDS.discrepancy_rate_max). */
export const DISCREPANCY_RATE_THRESHOLD = 0.02;

/**
 * Progressive exposure population steps (percent). DESIGN DECISION, PROVISIONAL: Part 9 requires
 * progressive population without naming steps; the steward can change these by canon change.
 */
export const EXPOSURE_STEPS = [1, 5, 25, 50, 100] as const;

/** Stated bound: a kill switch must stop a live exposure within this time (9.2 / 6.2 PROHIBITED clause). */
export const KILL_SWITCH_BOUND_MS = 60_000;

/** Part 9.4: discrepancies are clustered by cause hypothesis; every class above threshold needs an owner and a disposition. */
export const CAUSE_CLASSES = ["data_distribution", "edge_case", "policy_gap", "model_error", "integration", "unknown"] as const;
export type CauseClass = (typeof CAUSE_CLASSES)[number];

export interface ShadowCase {
  case_ref: string;
  shadow_decision: string;
  actual_decision: string;
  delta?: string;
  hypothesised_cause: CauseClass;
  disposition?: "open" | "owned" | "resolved" | "accepted_risk";
}

/** A case is a discrepancy when the shadow decision and the actual decision differ. */
export function decisionsDiffer(shadow: string, actual: string): boolean {
  return shadow.trim() !== actual.trim();
}

export function discrepancyRate(sampleSize: number, discrepancyCount: number): number {
  if (sampleSize <= 0) throw new Error("SAMPLE_SIZE_REQUIRED: a shadow run needs a positive sample size");
  if (discrepancyCount < 0 || discrepancyCount > sampleSize) throw new Error("BAD_DISCREPANCY_COUNT");
  return discrepancyCount / sampleSize;
}

/** 9.4: automatic demotion when the rate breaches the bound. Simulated runs never demote (Section 3.4). */
export function rateBreaches(rate: number): boolean {
  return rate > DISCREPANCY_RATE_THRESHOLD;
}

/** 9.4: surface patterns, not just counts. */
export function clusterCauses(cases: ShadowCase[]): Array<{ cause: CauseClass; count: number; case_refs: string[] }> {
  const m = new Map<CauseClass, string[]>();
  for (const c of cases) {
    const arr = m.get(c.hypothesised_cause) ?? [];
    arr.push(c.case_ref);
    m.set(c.hypothesised_cause, arr);
  }
  return [...m.entries()].map(([cause, refs]) => ({ cause, count: refs.length, case_refs: refs })).sort((a, b) => b.count - a.count);
}

/** 9.4: every discrepancy class above threshold needs an owner and a disposition. */
export function unownedClasses(clusters: Array<{ cause: CauseClass; count: number }>, sampleSize: number): CauseClass[] {
  return clusters.filter((c) => sampleSize > 0 && c.count / sampleSize > DISCREPANCY_RATE_THRESHOLD).map((c) => c.cause);
}

/** Progressive population: the next authorised population must be a step up, never a leap. */
export function nextExposureStep(currentPct: number): number | null {
  for (const s of EXPOSURE_STEPS) if (s > currentPct) return s;
  return null;
}

export function exposureStepError(currentPct: number, requestedPct: number): string | null {
  const next = nextExposureStep(currentPct);
  if (next === null) return "EXPOSURE_COMPLETE: the capability is already at full population";
  if (requestedPct <= currentPct) return `EXPOSURE_NOT_PROGRESSIVE: ${requestedPct}% does not extend the current ${currentPct}%`;
  if (requestedPct > next) return `EXPOSURE_STEP_SKIPPED: the next step from ${currentPct}% is at most ${next}% (Part 9 progressive population)`;
  return null;
}

/** 6.2: a critical incident, or a repeated serious one, demotes automatically. */
export function incidentDemotes(severity: "minor" | "major" | "critical", recentSeriousCount: number): boolean {
  return severity === "critical" || recentSeriousCount >= 2;
}

/** Kill switch must stop within its stated bound. */
export function killSwitchWithinBound(requestedAtMs: number, stoppedAtMs: number, boundMs: number = KILL_SWITCH_BOUND_MS): boolean {
  return stoppedAtMs - requestedAtMs <= boundMs;
}

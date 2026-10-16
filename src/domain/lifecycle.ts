/**
 * Lifecycle state machines (Layer B Part 4.4), defined as data.
 * Mirrored in the database table `lifecycle_transitions` and enforced by the
 * `assert_transition` BEFORE UPDATE trigger. The SQL seed is generated from
 * this file (scripts/gen-phase1-seed.ts) so the two can never drift.
 *
 * Each family is an ordered list of ranks. A rank holds one or more
 * alternative states (e.g. "promoted / rejected / expired").
 * DESIGN DECISION (recorded in AGENTS.md): a transition is permitted from a
 * state to any state in a strictly later rank. Nothing moves backwards; a
 * reversal is a new version (P15), never a state regression.
 */
export const LIFECYCLE_FAMILIES = {
  // 4.4 verbatim families
  canon: [["draft"], ["active"], ["challenged"], ["superseded"], ["retired"]],
  value_signal: [
    ["detected"],
    ["enriched"],
    ["monitoring"],
    ["merged"],
    ["promoted", "rejected", "expired"],
  ],
  value_mission: [
    ["accepted"],
    ["activated"],
    ["probing"],
    ["advancing"],
    ["exposed"],
    ["proven"],
    ["embedded"],
    ["closed", "redirected"],
  ],
  behavior_statement: [
    ["proposed"],
    ["confirmed"],
    ["generating"],
    ["verified_in_simulation"],
    ["verified_in_shadow"],
    ["verified_in_production"],
    ["superseded"],
  ],
  composable_capability: [
    ["proposed"],
    ["skeleton"],
    ["shadow"],
    ["limited_exposure"],
    ["producing_value"],
    ["underperforming"],
    ["retired"],
  ],
  creation_run: [["compiled"], ["dispatched"], ["running"], ["succeeded", "failed"], ["superseded"]],
  rendition: [["live"], ["stale"], ["deleted"]],
  // States named in Part 4.3 for specific types
  detector_finding: [["new"], ["acknowledged"], ["remediated", "accepted_risk", "false_positive"]],
  opportunity_stream: [["now"], ["next"], ["observing"], ["expired"]],
  // DESIGN DECISION: Part 8A.7 draft-vs-confirmed for extracted framing objects
  framing_extract: [["draft"], ["confirmed"], ["superseded"]],
  // DESIGN DECISION: evidence and assurance records are immutable once recorded
  evidence_record: [["recorded"], ["superseded"], ["retired"]],
} as const satisfies Record<string, readonly (readonly string[])[]>;

export type LifecycleFamily = keyof typeof LIFECYCLE_FAMILIES;

export function initialState(family: LifecycleFamily): string {
  return LIFECYCLE_FAMILIES[family][0][0];
}

export function allStates(family: LifecycleFamily): string[] {
  return LIFECYCLE_FAMILIES[family].flat();
}

export function transitions(family: LifecycleFamily): Array<[string, string]> {
  const ranks = LIFECYCLE_FAMILIES[family];
  const out: Array<[string, string]> = [];
  ranks.forEach((rank, i) => {
    for (const from of rank) {
      for (let j = i + 1; j < ranks.length; j++) {
        for (const to of ranks[j]) out.push([from, to]);
      }
    }
  });
  return out;
}

export function canTransition(family: LifecycleFamily, from: string, to: string): boolean {
  return transitions(family).some(([f, t]) => f === from && t === to);
}

/** Part 4.4 NON-NEGOTIABLE: no approval-like state anywhere. Same regex as the DB CHECK. */
export const APPROVAL_STATE_PATTERN =
  /(approv|sign.?off|pending.?review|submitted.?for.?review|awaiting|qa.?phase|gate)/i;

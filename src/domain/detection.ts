/** Phase 10 deterministic signals. SQL uses these same fact names; uncertain semantic claims remain explicit observations. */
export const VALUEOS_DETECTORS = [
  [
    "RequestedSolutionWithoutCondition",
    "requested_solution_without_condition",
    "Record a measurable condition and baseline.",
  ],
  [
    "MissionWithoutEmpoweredCoCreator",
    "mission_without_empowered_co_creator",
    "Assign a Co-Creator with recorded decision authority.",
  ],
  [
    "DocumentPreparedForHandoff",
    "document_prepared_for_handoff",
    "Connect operating objects instead of handing off a document.",
  ],
  [
    "AwarenessOnlyRecurringMeeting",
    "awareness_only_recurring_meeting",
    "Replace awareness distribution with permission-scoped evidence.",
  ],
  [
    "StandardWorkAwaitingApproval",
    "standard_work_awaiting_approval",
    "Use encoded authority; escalate only an actual human decision.",
  ],
  [
    "CapabilityCreatedWithoutRegistrySearch",
    "capability_created_without_registry_search",
    "Record a reuse search before creation.",
  ],
  [
    "BatchThatCouldBeIncremental",
    "batch_that_could_be_incremental",
    "Reduce exposure to a bounded increment.",
  ],
  [
    "HumanMonitoringMachinesCouldPerform",
    "human_monitoring_machines_could_perform",
    "Delegate deterministic observation to telemetry.",
  ],
  [
    "AutonomousActionWithoutEvidence",
    "autonomous_action_without_evidence",
    "Reduce authority and supply independent evidence.",
  ],
  [
    "CapabilityWithoutOwnerTelemetryOrExpiration",
    "capability_without_owner_telemetry_or_expiration",
    "Restore ownership, telemetry and expiration.",
  ],
  [
    "LocalScopeOverEnterpriseValue",
    "local_scope_over_enterprise_value",
    "Reconcile the local decision with the mission outcome.",
  ],
  [
    "BuilderPerformingAgentWork",
    "builder_performing_agent_work",
    "Delegate repeatable mechanical work to an agent.",
  ],
  [
    "UncitableGeneratedAnswer",
    "uncitable_generated_answer",
    "Regenerate from cited authoritative operating objects.",
  ],
  [
    "HighImpactToolCallWithoutPolicy",
    "high_impact_tool_call_without_policy",
    "Attach deterministic policy evaluation and provenance.",
  ],
  [
    "ValueFeedDriftingTowardEngagement",
    "value_feed_drifting_toward_engagement",
    "Remove visibility rewards; retain reuse and value evidence.",
  ],
] as const;
export const THREAD_DETECTORS = [
  [
    "CanonFragmentation",
    "canon_fragmentation",
    "Challenge conflicting definitions through the canon change path.",
  ],
  [
    "ScopeChangeClassifiedAsCosmetic",
    "scope_change_classified_as_cosmetic",
    "Declare the material scope change explicitly.",
  ],
  [
    "RejectedMeasureInUse",
    "rejected_measure_in_use",
    "Use outcome evidence, never activity as a value proxy.",
  ],
  [
    "WikiDrift",
    "wiki_drift",
    "Restore operating actions; thresholds require Carey's recorded decision.",
  ],
  [
    "AuthorityInflation",
    "authority_inflation",
    "Re-evaluate evidence and reduce unsupported authority.",
  ],
] as const;
export const FRAMING_DETECTORS = [
  [
    "RawSpeechTreatedAsAuthority",
    "raw_speech_treated_as_authority",
    "Require explicit human reclassification.",
  ],
  ["UnextractedDecision", "unextracted_decision", "Record or explicitly defer the decision."],
  ["BehaviorWithoutNeed", "behavior_without_need", "Link the behaviour to its articulated need."],
  ["NeedWithoutBehavior", "need_without_behavior", "Elaborate the need into observable behaviour."],
  [
    "NeedWithoutMeasure",
    "need_without_measure",
    "Record measurable character, baseline and target.",
  ],
  ["UnextractedSession", "unextracted_session", "Extract the consented artifact."],
  ["SessionWithoutConsent", "session_without_consent", "Stop capture and restore valid consent."],
  [
    "ContradictionUnresolved",
    "contradiction_unresolved",
    "Resolve or explicitly defer the contradiction.",
  ],
  ["AssumptionUnverified", "assumption_unverified", "Verify the relied-on assumption."],
  [
    "ProvenanceSpanMissing",
    "provenance_span_missing",
    "Discard unattributed extraction; investigate any bypass.",
  ],
  [
    "DraftObjectUsedAsBasis",
    "draft_object_used_as_basis",
    "Stop creation or exposure until intent is confirmed.",
  ],
  ["DraftCountedAsProgress", "draft_counted_as_progress", "Exclude draft objects from measures."],
  [
    "SessionProducingMinutes",
    "session_producing_minutes",
    "Produce typed operating objects, not minutes.",
  ],
  ["DependencyCycle", "dependency_cycle", "Break the cyclic dependency with evidence."],
  [
    "InferredEdgeAutoConfirmed",
    "inferred_edge_auto_confirmed",
    "Require human confirmation for inferred links.",
  ],
  [
    "FramingSessionAsMeeting",
    "framing_session_as_meeting",
    "Capture operating intent rather than an awareness meeting.",
  ],
] as const;
export const DETECTION_RULES = [...VALUEOS_DETECTORS, ...THREAD_DETECTORS, ...FRAMING_DETECTORS];
export const ACTION_RATIO_WARNING = "AntiWikiActionRatioThresholdUnset";
// Optional intent-to-mission association is advisory, not another blocking detector.
export const SESSION_MISSION_ADVISORIES = ["ConfirmedIntentWithoutMission"] as const;
export const DETECTOR_MANIFEST = [...DETECTION_RULES.map(([key]) => key), ACTION_RATIO_WARNING];
export function evaluateFacts(facts: Record<string, unknown>) {
  return DETECTION_RULES.filter(([, fact]) => facts[fact] === true).map(([key]) => key);
}
export const REJECTED_MEASURE_PATTERN =
  /\b(story[ _-]?points|sprint[ _-]?velocity|requirements[ _-]?completed|features[ _-]?shipped[ _-]?without[ _-]?outcome[ _-]?evidence|lines[ _-]?of[ _-]?code|prompt[ _-]?count|agent[ _-]?call[ _-]?count|utili[sz]ation[ _-]?as[ _-]?a[ _-]?proxy[ _-]?for[ _-]?value|meetings[ _-]?held|documents[ _-]?produced|training[ _-]?modules[ _-]?completed)\b/i;
export function rejectedMeasure(text: string) {
  return REJECTED_MEASURE_PATTERN.test(text);
}
export function validActionRatioThresholds(
  value: unknown,
): value is { min_action_pct: number; max_read_only_pct: number } {
  if (!value || typeof value !== "object") return false;
  const thresholds = value as Record<string, unknown>;
  return [thresholds["min_action_pct"], thresholds["max_read_only_pct"]].every(
    (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100,
  );
}
export function actionRatios(
  rows: Array<{ mutating_actions: number; reads: number }>,
  setting: { status: string; value: { min_action_pct: number; max_read_only_pct: number } | null },
) {
  const total = rows.length;
  const action_pct = total
    ? (100 * rows.filter((r) => r.mutating_actions > 0).length) / total
    : null;
  const read_only_pct = total
    ? (100 * rows.filter((r) => r.reads > 0 && r.mutating_actions === 0).length) / total
    : null;
  if (setting.status === "open")
    return {
      action_pct,
      read_only_pct,
      status: "THRESHOLD_UNSET",
      pass: false,
      release_blocking: false,
      severity: "warning",
    };
  const configured = setting.status === "set" && validActionRatioThresholds(setting.value);
  const pass =
    configured &&
    setting.value !== null &&
    action_pct !== null &&
    read_only_pct !== null &&
    action_pct >= setting.value.min_action_pct &&
    read_only_pct <= setting.value.max_read_only_pct;
  return {
    action_pct,
    read_only_pct,
    status: !configured ? "THRESHOLD_UNSET" : total ? "measured" : "NO_EVIDENCE",
    pass,
    release_blocking: !pass,
    severity: pass ? "none" : "error",
  };
}
export function elapsedHours(start: string, end: string) {
  const duration = (Date.parse(end) - Date.parse(start)) / 36e5;
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}
export function median(values: number[]) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(s.length / 2);
  if (!s.length) return null;
  return s.length % 2 ? (s[middle] ?? null) : ((s[middle - 1] ?? 0) + (s[middle] ?? 0)) / 2;
}

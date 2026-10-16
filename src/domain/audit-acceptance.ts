export type AuditStatus = "passed" | "failed" | "blocked";
export interface AuditCheck { id: string; status: AuditStatus; reason: string; observed?: number | string | null }
export interface AuditObservations {
  forbidden_types: number; forbidden_states: number; invalid_notifications: number;
  missing_expiration: number; orphans: number; threshold_status: string; threshold_value: unknown;
  usage_sessions: number; handoff_findings: number;
}
/** All fifteen checks are reported. Unexecuted mandatory subchecks never become a pass from empty data. */
export function antiWikiAudit(o: AuditObservations): AuditCheck[] {
  return [
    { id: "AW-1", status: o.forbidden_types ? "failed" : "blocked", reason: o.forbidden_types ? "Forbidden schema type found" : "Registry scan clean; exhaustive field/semantic mutation acceptance pending", observed: o.forbidden_types },
    { id: "AW-2", status: o.forbidden_states ? "failed" : "blocked", reason: o.forbidden_states ? "Forbidden state found" : "Enum/lifecycle scan clean; authenticated rendered-state scan pending", observed: o.forbidden_states },
    { id: "AW-3", status: "blocked", reason: "Authenticated Mission Runtime screenshot and OCR pending" },
    { id: "AW-4", status: "blocked", reason: "All eleven phrase rules tested; complete API/UI output scan pending" },
    { id: "AW-5", status: o.threshold_status === "open" || o.threshold_value == null ? "failed" : "blocked", reason: o.threshold_status === "open" || o.threshold_value == null ? "THRESHOLD_UNSET" : "Semantic usage-session collection and comparison pending", observed: o.usage_sessions },
    { id: "AW-6", status: o.invalid_notifications ? "failed" : "blocked", reason: o.invalid_notifications ? "Notification lacks a trigger" : "Existing rows valid; isolated invalid-insert mutation acceptance pending", observed: o.invalid_notifications },
    { id: "AW-7", status: "passed", reason: "Current Phase 4/6 database tests reject creation without reuse and roll fixtures back" },
    { id: "AW-8", status: "passed", reason: "Current Phase 8 database generator rejects guidance with no citations" },
    { id: "AW-9", status: "blocked", reason: "Actual database generation refuses individual-activity guidance; complete MCP/query-path acceptance pending" },
    { id: "AW-10", status: "blocked", reason: "Guard exists; full static dataflow proof and Phase 1 database test time out/pending" },
    { id: "AW-11", status: o.orphans ? "failed" : "blocked", reason: o.orphans ? "Non-draft objects have no active relationship" : "Zero orphans observed; owned metric induction pending", observed: o.orphans },
    { id: "AW-12", status: o.missing_expiration ? "failed" : "blocked", reason: o.missing_expiration ? "Live object lacks expiration" : "All live rows have expiration; exhaustive per-type mutation acceptance pending", observed: o.missing_expiration },
    { id: "AW-13", status: "failed", reason: "Core adversarial simulation remains pending an execution harness" },
    { id: "AW-14", status: "failed", reason: "No published actual intent-to-first-working-evidence measurement" },
    { id: "AW-15", status: o.handoff_findings ? "failed" : "blocked", reason: o.handoff_findings ? "Unaddressed handoff finding" : "Zero open handoff findings; complete native induction/recurrence acceptance pending", observed: o.handoff_findings },
  ];
}
export function auditVerdict(checks: AuditCheck[]): AuditStatus {
  return checks.some((c) => c.status === "failed") ? "failed" : checks.some((c) => c.status === "blocked") ? "blocked" : "passed";
}
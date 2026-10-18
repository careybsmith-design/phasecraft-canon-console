import { describe, expect, it } from "vitest";
import { antiWikiAudit, auditVerdict } from "./audit-acceptance";
const observation = { forbidden_types: 0, forbidden_states: 0, invalid_notifications: 0, missing_expiration: 0, orphans: 92, threshold_status: "open", threshold_value: null, usage_sessions: 0, handoff_findings: 0 };
 describe("Release-blocking full AW-1–AW-16 report", () => {
  it.each(["AW-7", "AW-8"])("%s cannot claim a current pass from historical database results", (id) => {
    expect(antiWikiAudit(observation).find((c) => c.id === id)?.status).toBe("blocked");
  });
  it("reports each required test once", () => expect(antiWikiAudit(observation).map((c) => c.id)).toEqual(Array.from({ length: 16 }, (_, i) => `AW-${i+1}`)));
  it("keeps Carey's OPEN decision visible without blocking release", () => {
    const check = antiWikiAudit(observation).find((c) => c.id === "AW-5");
    expect(check).toMatchObject({ status: "warning" });
    expect(check?.reason).toContain("THRESHOLD_UNSET");
    expect(auditVerdict(check ? [check] : [])).toBe("passed");
  });
  it("fails release for a fixture of 92 non-draft orphans", () => expect(antiWikiAudit(observation).find((c) => c.id === "AW-11")).toMatchObject({ status: "failed", observed: 92 }));
  it("does not claim unexecuted screenshot/OCR acceptance passed", () => expect(antiWikiAudit(observation).find((c) => c.id === "AW-3")?.status).toBe("blocked"));
  it("cannot pass a release with blocked or failed mandatory tests", () => {
    expect(auditVerdict(antiWikiAudit(observation))).toBe("failed");
    expect(auditVerdict([{ id: "AW-1", status: "blocked", reason: "no execution" }])).toBe("blocked");
  });
  it("L-02 configured threshold violations fail rather than remain merely unexecuted", () => {
    expect(antiWikiAudit({ ...observation, threshold_status: "set", threshold_value: { min_action_pct: 60, max_read_only_pct: 25 }, usage_sessions: 10, action_pct: 50, read_only_pct: 50 }).find(c => c.id === "AW-5")?.status).toBe("failed");
  });
  it("L-02 configured settings without measured evidence fail closed", () => {
    expect(antiWikiAudit({ ...observation, threshold_status: "set", threshold_value: { min_action_pct: 60, max_read_only_pct: 25 } }).find(c => c.id === "AW-5")?.status).toBe("failed");
  });
  it("L-02 unknown setting status cannot pass with a non-null value", () => {
    expect(antiWikiAudit({ ...observation, threshold_status: "unknown", threshold_value: {} }).find(c => c.id === "AW-5")?.status).toBe("failed");
  });
  it("an empty acceptance set cannot pass", () => expect(auditVerdict([])).toBe("blocked"));
  it("L-08 live execution-state violations fail AW-16", () => expect(antiWikiAudit({ ...observation, state_ownership_violations: 1 }).find(c => c.id === "AW-16")?.status).toBe("failed"));
});
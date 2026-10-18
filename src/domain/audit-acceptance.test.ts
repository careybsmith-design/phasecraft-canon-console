import { describe, expect, it } from "vitest";
import { antiWikiAudit, auditVerdict } from "./audit-acceptance";
const observation = { forbidden_types: 0, forbidden_states: 0, invalid_notifications: 0, missing_expiration: 0, orphans: 92, threshold_status: "open", threshold_value: null, usage_sessions: 0, handoff_findings: 0 };
describe("Release-blocking full AW-1–AW-15 report", () => {
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
  it("fails release for the actual 92 non-draft orphans", () => expect(antiWikiAudit(observation).find((c) => c.id === "AW-11")).toMatchObject({ status: "failed", observed: 92 }));
  it("does not claim unexecuted screenshot/OCR acceptance passed", () => expect(antiWikiAudit(observation).find((c) => c.id === "AW-3")?.status).toBe("blocked"));
  it("cannot pass a release with blocked or failed mandatory tests", () => {
    expect(auditVerdict(antiWikiAudit(observation))).toBe("failed");
    expect(auditVerdict([{ id: "AW-1", status: "blocked", reason: "no execution" }])).toBe("blocked");
  });
});
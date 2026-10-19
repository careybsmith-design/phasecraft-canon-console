import { describe, expect, it } from "vitest";
import { formatPlan, inspectBytes, inspectImageText } from "./inspection";
import { confirmationAuthority } from "./framing";

const enc = (s: string) => new TextEncoder().encode(s);

describe("N03 inspect-or-quarantine", () => {
  it("benign-named .txt with a card number is hard-blocked", () => {
    const r = inspectBytes("notes.txt", "text/plain", enc("pay with 4111 1111 1111 1111"));
    expect(r.action).toBe("block");
    expect(r.tier_basis).toBe("content_extracted");
  });
  it("benign-named .txt with a health identifier is not stored", () => {
    const r = inspectBytes("notes.txt", "text/plain", enc("MRN: 00483921 follow-up"));
    expect(r.action).toBe("block");
  });
  it("benign-named .pdf containing a card number is quarantined, never stored", () => {
    const pdf = enc("%PDF-1.7\n<< /Filter /FlateDecode >> stream x\u009c\u00cb card 4111");
    const r = inspectBytes("summary.pdf", "application/pdf", pdf);
    expect(r.action).toBe("quarantine");
    expect(r.tier_basis).toBe("filename_only");
  });
  it("docx, xlsx and zip are quarantined", () => {
    for (const [n, t] of [
      ["a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["a.zip", "application/zip"],
    ] as const)
      expect(inspectBytes(n, t, enc("x")).action).toBe("quarantine");
  });
  it("invalid UTF-8 declared as text is quarantined", () => {
    expect(inspectBytes("a.txt", "text/plain", new Uint8Array([0xff, 0xfe, 0x00])).action).toBe(
      "quarantine",
    );
  });
  it("benign text is stored with content_extracted basis", () => {
    const r = inspectBytes("a.csv", "text/csv", enc("team,goal\nops,latency"));
    expect(r).toMatchObject({ action: "store", tier: "A", tier_basis: "content_extracted" });
  });
  it("screen capture without an image-reading route is quarantined", () => {
    expect(inspectImageText("shot", null).action).toBe("quarantine");
  });
  it("screen capture whose read text holds a member ID is blocked", () => {
    expect(inspectImageText("shot", "Member ID: XKQ4419920").action).toBe("block");
  });
  it("octet-stream falls back to extension for text only", () => {
    expect(formatPlan("a.txt", "application/octet-stream")).toBe("text");
    expect(formatPlan("a.pdf", "application/octet-stream")).toBe("unsupported");
  });
});

describe("W2.5 confirmation authority", () => {
  it("material draft, viewer without authority -> missing", () => {
    expect(confirmationAuthority({ material: true }, false)).toEqual({
      confirmation_authority: "missing",
      confirmation_reason: "material",
    });
  });
  it("material draft, viewer with authority -> held", () => {
    expect(confirmationAuthority({ material: true }, true).confirmation_authority).toBe("held");
  });
  it("need draft without authority -> missing (need)", () => {
    expect(confirmationAuthority({ proposed_object_type: "NeedStatement" }, false)).toEqual({
      confirmation_authority: "missing",
      confirmation_reason: "need",
    });
  });
  it("non-material draft -> not_required", () => {
    expect(confirmationAuthority({ classification: "fact" }, false).confirmation_authority).toBe(
      "not_required",
    );
  });
});

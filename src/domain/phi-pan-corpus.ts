/**
 * Labelled PHI/PAN corpus for the Phase 3 exit evidence (measured recall, published).
 * Synthetic examples only: card numbers are public test numbers, identifiers are invented.
 * label: "C" = must hard-block (PHI identifier or PAN); "notC" = must not block.
 * Labelled by the build agent; a human relabel is an open item (same as the Phase 2B quality set).
 */
export interface CorpusItem { text: string; label: "C" | "notC"; kind: string }

export const PHI_PAN_CORPUS: CorpusItem[] = [
  // PAN (Luhn-valid test numbers)
  { text: "Card on file is 4111 1111 1111 1111, please refund it.", label: "C", kind: "pan" },
  { text: "Use 5500-0000-0000-0004 for the test charge.", label: "C", kind: "pan" },
  { text: "Amex 378282246310005 was declined.", label: "C", kind: "pan" },
  { text: "The member paid with 6011111111111117 last month.", label: "C", kind: "pan" },
  { text: "card: 4012888888881881", label: "C", kind: "pan" },
  { text: "Visa 4222222222222 (13 digits) is on the old account.", label: "C", kind: "pan" },
  { text: "Discover 6011 0009 9013 9424 failed the address check.", label: "C", kind: "pan" },
  { text: "Mastercard 2223003122003222 is the corporate card.", label: "C", kind: "pan" },
  { text: "JCB 3530111333300000 came through the portal.", label: "C", kind: "pan" },
  { text: "Diners 30569309025904 was flagged.", label: "C", kind: "pan" },
  // SSN
  { text: "Her SSN is 123-45-6789.", label: "C", kind: "ssn" },
  { text: "Subscriber 987-65-4320 called twice about the denial.", label: "C", kind: "ssn" },
  { text: "Verify identity with 078-05-1120 before proceeding.", label: "C", kind: "ssn" },
  // MRN
  { text: "MRN 00482913 needs the prior authorisation.", label: "C", kind: "mrn" },
  { text: "Medical record number: 5583021 was merged.", label: "C", kind: "mrn" },
  { text: "mrn#7734211 shows two admissions.", label: "C", kind: "mrn" },
  { text: "medical record 90011223 is duplicated.", label: "C", kind: "mrn" },
  // Member / policy IDs
  { text: "Member ID: XZH4419027 is out of network.", label: "C", kind: "member_id" },
  { text: "policy number ABC123456 lapsed in March.", label: "C", kind: "member_id" },
  { text: "Subscriber id W99812345 changed plans.", label: "C", kind: "member_id" },
  { text: "member # QP7781200 has a pending appeal.", label: "C", kind: "member_id" },
  // DOB
  { text: "DOB 04/12/1961, female, plan B.", label: "C", kind: "dob" },
  { text: "date of birth: 1975-08-30 on the intake form.", label: "C", kind: "dob" },
  { text: "Patient born on 12/01/1990 was readmitted.", label: "C", kind: "dob" },
  { text: "dob: 3/7/58", label: "C", kind: "dob" },
  // Not C: health-related without identifiers (Tier B) and ordinary business text (Tier A)
  { text: "Patients with a chronic condition need faster prior authorisation.", label: "notC", kind: "tier_b" },
  { text: "The diagnosis code mapping is wrong for ICD-10 chapter 5.", label: "notC", kind: "tier_b" },
  { text: "Claim amount thresholds differ by plan.", label: "notC", kind: "tier_b" },
  { text: "Treatment plans should be visible to the care manager.", label: "notC", kind: "tier_b" },
  { text: "Prescription refills take three days on average.", label: "notC", kind: "tier_b" },
  { text: "We need claims under 500 dollars paid automatically.", label: "notC", kind: "tier_a" },
  { text: "The phone line opens at 8am.", label: "notC", kind: "tier_a" },
  { text: "Order 1234 5678 9012 3456 shipped yesterday.", label: "notC", kind: "near_miss_luhn_invalid" },
  { text: "Reference 4111 1111 1111 1112 is a ticket number.", label: "notC", kind: "near_miss_luhn_invalid" },
  { text: "Call 555-123-4567 for the broker desk.", label: "notC", kind: "near_miss_phone" },
  { text: "The 2026-10-15 decision changed the routing rule.", label: "notC", kind: "near_miss_date" },
  { text: "Version 12-34-56 of the form is retired.", label: "notC", kind: "near_miss_short" },
  { text: "Member services resolved 4,210 calls this week.", label: "notC", kind: "tier_a" },
  { text: "Policy wording must be plain language.", label: "notC", kind: "tier_a" },
  { text: "The member portal times out after 15 minutes.", label: "notC", kind: "tier_a" },
  { text: "Escalate appeals older than 30 days.", label: "notC", kind: "tier_a" },
  { text: "Invoice 20260415 is overdue.", label: "notC", kind: "tier_a" },
];

export function measureRecall(classify: (t: string) => { tier: string }) {
  let tp = 0, fn = 0, fp = 0, tn = 0;
  const misses: string[] = [];
  for (const c of PHI_PAN_CORPUS) {
    const blocked = classify(c.text).tier === "C";
    if (c.label === "C") { if (blocked) tp++; else { fn++; misses.push(c.text); } }
    else if (blocked) { fp++; misses.push(c.text); } else tn++;
  }
  return {
    items: PHI_PAN_CORPUS.length, positives: tp + fn, tp, fn, fp, tn,
    recall: tp + fn ? tp / (tp + fn) : null,
    precision: tp + fp ? tp / (tp + fp) : null,
    misses,
  };
}

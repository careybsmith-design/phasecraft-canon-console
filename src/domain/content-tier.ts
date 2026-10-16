/**
 * Content-tier classification and the PHI/PAN detection gate (8A.3, Section 3.4 ContentClassifier).
 * Deterministic regex + Luhn rules. Runs on every captured text BEFORE any model call.
 * Tier C hard-blocks (nothing raw is stored, nothing reaches a model).
 * Tier B routes in-boundary only (no external model call).
 */
export type ContentTier = "A" | "B" | "C";
export interface TierResult {
  tier: ContentTier;
  phi: boolean;
  pan: boolean;
  reasons: string[];
  spans: Array<{ start: number; end: number; kind: string }>;
}

export function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const HARD: Array<[RegExp, string]> = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, "ssn"],
  [/\b(?:mrn|medical record(?: number)?)\s*[:#]?\s*\d{5,}\b/gi, "mrn"],
  [/\b(?:member|subscriber|policy)\s*(?:id|number|#)\s*[:#]?\s*[A-Z0-9]{6,}\b/gi, "member_id"],
  [/\b(?:dob|date of birth|born on)\s*[:]?\s*\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/gi, "dob"],
];
const SOFT =
  /\b(diagnos\w*|prescri\w*|claim(?:s)? (?:amount|history)|patient|condition of|treatment|icd-?10|cpt)\b/i;

export function classifyContent(text: string): TierResult {
  const spans: TierResult["spans"] = [];
  const reasons: string[] = [];
  let pan = false;
  let phi = false;
  for (const m of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
    const digits = m[0].replace(/[ -]/g, "");
    if (luhnValid(digits)) {
      pan = true;
      spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: "pan" });
    }
  }
  if (pan) reasons.push("A payment card number (passes the Luhn check)");
  for (const [re, kind] of HARD) {
    for (const m of text.matchAll(re)) {
      phi = true;
      spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind });
    }
  }
  if (phi) reasons.push("A direct personal or health identifier");
  if (pan || phi) return { tier: "C", phi, pan, reasons, spans };
  if (SOFT.test(text))
    return {
      tier: "B",
      phi: false,
      pan: false,
      reasons: ["Health-related content without identifiers"],
      spans,
    };
  return { tier: "A", phi: false, pan: false, reasons: [], spans };
}

export const TIER_ROUTES: Record<ContentTier, string> = {
  A: "Any approved model route",
  B: "In-boundary only (no external model call)",
  C: "Hard-blocked: not stored, not sent to any model",
};

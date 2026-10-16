/** ContentClassifier (Section 3.4): deterministic regex + Luhn. PHI/PAN hard blocks apply in every mode. */
export { classifyContent as classify } from "@/domain/content-tier";
export type { TierResult } from "@/domain/content-tier";

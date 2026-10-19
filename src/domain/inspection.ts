/**
 * Content inspection before storage (8A.3, N03). Pure rules shared by every ingestion path.
 *
 * Governing rule: an uninspectable payload is quarantined, never stored-and-labelled.
 * - Supported text formats are decoded strictly and the EXTRACTED text is classified.
 * - Images are classified from text read off the image by the approved image-reading route;
 *   without that route they are quarantined.
 * - Everything else (PDF, DOCX, XLSX, ZIP, unknown binary) is quarantined: not stored.
 */
import { classifyContent, type ContentTier, type TierResult } from "./content-tier";

export type TierBasis = "content_extracted" | "content_scanned" | "filename_only";

export type InspectionOutcome =
  | { action: "store"; tier: ContentTier; tier_basis: TierBasis; text: string }
  | { action: "block"; tier: "C"; tier_basis: TierBasis; reasons: string[] }
  | { action: "quarantine"; tier: ContentTier; tier_basis: "filename_only"; reason: string };

const TEXT_MIME =
  /^(text\/(plain|markdown|x-markdown|csv|tab-separated-values)|application\/(json|csv))(;.*)?$/i;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json)$/i;
const IMAGE_MIME = /^image\/(png|jpeg|webp)$/i;

/** The supported set, stated explicitly. Anything else is quarantined. */
export const SUPPORTED_FORMATS = {
  text: ["text/plain", "text/markdown", "text/csv", "text/tab-separated-values", "application/json"],
  image: ["image/png", "image/jpeg", "image/webp"],
} as const;

export type FormatPlan = "text" | "image" | "unsupported";

export function formatPlan(name: string, contentType: string): FormatPlan {
  if (IMAGE_MIME.test(contentType)) return "image";
  if (TEXT_MIME.test(contentType)) return "text";
  // Generic content types (octet-stream) fall back to the extension for text only.
  if (/^application\/octet-stream$/i.test(contentType) && TEXT_EXT.test(name)) return "text";
  return "unsupported";
}

function fromTier(t: TierResult, basis: TierBasis, text: string): InspectionOutcome {
  if (t.tier === "C") return { action: "block", tier: "C", tier_basis: basis, reasons: t.reasons };
  return { action: "store", tier: t.tier, tier_basis: basis, text };
}

/** Quarantine record decision: the name itself is still screened (a Tier C name is blocked). */
export function quarantine(name: string, reason: string): InspectionOutcome {
  const t = classifyContent(name);
  if (t.tier === "C") return { action: "block", tier: "C", tier_basis: "filename_only", reasons: t.reasons };
  return { action: "quarantine", tier: t.tier, tier_basis: "filename_only", reason };
}

/** Inspect a supported text payload: strict UTF-8 decode, classify name + extracted text. */
export function inspectText(name: string, bytes: Uint8Array): InspectionOutcome {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return quarantine(name, "Declared as text but not valid UTF-8; content could not be inspected");
  }
  return fromTier(classifyContent(`${name}\n${text}`), "content_extracted", text);
}

/** Inspect an image from the text the image-reading route read off it. null = no route. */
export function inspectImageText(name: string, readText: string | null): InspectionOutcome {
  if (readText === null)
    return quarantine(name, "No cleared image-reading route; image content could not be inspected");
  return fromTier(classifyContent(`${name}\n${readText}`), "content_extracted", readText);
}

/** Dispatcher for byte payloads with no image route (attachments). */
export function inspectBytes(name: string, contentType: string, bytes: Uint8Array): InspectionOutcome {
  const plan = formatPlan(name, contentType);
  if (plan === "text") return inspectText(name, bytes);
  if (plan === "image")
    return quarantine(name, "Image attachment: image reading is applied only to session captures");
  return quarantine(
    name,
    `Unsupported format (${contentType}); no text extractor, so content could not be inspected`,
  );
}

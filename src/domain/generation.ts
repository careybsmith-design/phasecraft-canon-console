/**
 * Phase 8 Generation layer rules (Layer B Part 10, Part 14.3). Pure and mirrored in SQL
 * (migration 0030: `rendition_kinds` seed, `_prohibited_inference`, `thread_generate_rendition`,
 * `thread_serve_rendition`, `renditions_stale_on_source_change`, `thread_rendition_sweep`). Change both together.
 */

/** Visible on every rendition (10.2 "Non-authoritative by display"). */
export const CANON_MARKER = "Generated from canon. Not canon.";

/** Part 10.3: the source's kinds plus the operational kinds THREAD needs. */
export const RENDITION_KINDS = {
  audio_briefing_60s: { label: "60-second audio briefing", media: "audio" },
  interactive_visual_explanation: { label: "Interactive visual explanation", media: "interactive" },
  short_video: { label: "Short generated video", media: "video" },
  conversational_walkthrough: { label: "Conversational walkthrough", media: "text" },
  role_specific_scenario: { label: "Role-specific scenario", media: "text" },
  decision_tree: { label: "Decision tree", media: "text" },
  live_demonstration: { label: "Live demonstration", media: "interactive" },
  technical_explanation: { label: "Technical explanation", media: "text" },
  executive_narrative: { label: "Executive narrative", media: "text" },
  capability_explanation: { label: "Capability explanation", media: "text" },
  evidence_chain_rendering: { label: "Evidence chain rendering", media: "text" },
  impact_narrative: { label: "Impact narrative", media: "text" },
  morning_intelligence_brief: { label: "Morning intelligence brief", media: "text" },
  burst_brief: { label: "Burst brief", media: "text" },
  value_narrative: { label: "Value narrative", media: "text" },
  council_briefing: { label: "Council briefing", media: "text" },
  board_audit_report: { label: "Board / Audit Committee report", media: "text" },
} as const;
export type RenditionKind = keyof typeof RENDITION_KINDS;

/**
 * Part 14.3 + 10.4 prohibited inferences. Regex sources are written so they behave the same in
 * JavaScript and PostgreSQL ARE (`~*`). The SQL function `_prohibited_inference` holds the same list.
 */
export const PROHIBITED_INFERENCE_RULES: Array<{ key: string; pattern: string; reason: string }> = [
  {
    key: "actor_activity_fields",
    pattern:
      "(actor_id[\\s\\S]*(reads|mutating_actions)|(reads|mutating_actions)[\\s\\S]*actor_id)",
    reason: "Actor-level usage-session activity is never exposed (L-10 / 14.3)",
  },
  {
    key: "activity_volume",
    pattern:
      "(prompt|message|agent[ -]?call|keystroke|login|commit|meeting)s? (count|volume|total|frequency)",
    reason: "Infers performance from activity volume (14.3)",
  },
  {
    key: "hours_connected",
    pattern: "(hours|time) (connected|online|logged|active)",
    reason: "Infers performance from hours connected (14.3)",
  },
  {
    key: "leaderboard",
    pattern: "(leaderboard|league table)",
    reason: "Ranks individual humans (14.3)",
  },
  {
    key: "rank_people",
    pattern:
      "(rank|rate|score|compare)( the| all| our| each)? (individual|employee|people|person|staff|builder|co-creator|member|colleague)s?",
    reason: "Ranks, rates or compares individual humans (14.3)",
  },
  {
    key: "individual_activity",
    pattern:
      "(individual|per[- ](person|user|employee|builder)|each (person|employee|builder|user))('s)? (activity|productivity|output|usage|performance)",
    reason: "Surfaces an individual's activity-derived metric (14.3)",
  },
  {
    key: "activity_by_person",
    pattern:
      "(activity|productivity|usage|output) (by|per|for each) (person|user|employee|builder|individual)",
    reason: "Surfaces an individual's activity-derived metric (14.3)",
  },
  {
    key: "private_conversation",
    pattern: "private (conversation|message|chat)s?",
    reason: "Scores people from private conversations (14.3)",
  },
  {
    key: "discipline",
    pattern: "disciplin(e|ary)",
    reason: "Uses coaching data for discipline (14.3)",
  },
  {
    key: "progress_report",
    pattern: "(progress against plan|task list|activity summary|status report)",
    reason: "Progress, task list or activity summary is not a rendition (10.4)",
  },
];

export function prohibitedInference(text: string): { key: string; reason: string } | null {
  for (const r of PROHIBITED_INFERENCE_RULES)
    if (new RegExp(r.pattern, "i").test(text)) return { key: r.key, reason: r.reason };
  return null;
}

/** AW-8 / 10.2: guidance without canon citations cannot be produced; every citation must be a source. */
export function citationRefusal(sources: string[], citations: string[]): string | null {
  if (!citations.length)
    return "CITATIONS_REQUIRED: a rendition must cite the canon objects it renders";
  const s = new Set(sources);
  const bad = citations.find((c) => !s.has(c));
  return bad ? `CITATION_NOT_A_SOURCE: ${bad} is not one of the rendition's sources` : null;
}

export interface SourceStamp {
  id: string;
  version: number;
  content_hash: string;
}
/** 10.2 "Expiring": stale as soon as any source's content hash differs from the stamp. */
export function isStale(
  stamp: SourceStamp[],
  current: Record<string, { content_hash: string; is_tombstone?: boolean } | undefined>,
): boolean {
  return stamp.some((s) => {
    const c = current[s.id];
    return !c || c.is_tombstone === true || c.content_hash !== s.content_hash;
  });
}

export interface PermissionContext {
  actor: string;
  purpose: string;
}
/** 10.2 "Permission-scoped": served only to the identity AND purpose it was generated for. */
export function serveRefusal(
  ctx: PermissionContext,
  requester: string,
  purpose: string,
  state: "live" | "stale" | "deleted",
): string | null {
  if (ctx.actor !== requester || ctx.purpose !== purpose)
    return "RENDITION_CONTEXT_MISMATCH: this rendition was generated for a different identity or purpose";
  if (state === "deleted") return "RENDITION_DELETED: this rendition has been deleted";
  if (state === "stale") return "RENDITION_STALE: a source changed; regenerate it";
  return null;
}

/** Live model routes are refused for confidential or restricted sources (Tier B/C stay in-boundary). */
export function generationRoute(
  maxClass: "public" | "internal" | "confidential" | "restricted",
): "live" | "in_boundary" {
  return maxClass === "public" || maxClass === "internal" ? "live" : "in_boundary";
}

/** DESIGN DECISION (provisional): stale renditions are purged 24 h after going stale. */
export const STALE_DELETE_AFTER_HOURS = 24;
/** DESIGN DECISION (provisional): renditions live 7 days unless a source changes first. */
export const DEFAULT_TTL_HOURS = 168;

/** 10.4 brief sections — judgment only. */
export const BRIEF_SECTIONS = [
  "Decisions requiring your input",
  "Anomalies",
  "Opportunities",
  "Stop recommendations",
] as const;

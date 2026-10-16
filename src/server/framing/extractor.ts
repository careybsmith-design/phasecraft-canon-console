/**
 * The Intent extractor: segmentation -> six-way classification through ModelGateway (strict JSON schema),
 * then the deterministic post-rules in src/domain/framing.ts. Tier B never leaves the boundary: it uses the
 * in-boundary rule classifier. Server-only.
 */
import {
  CLASSES,
  EXTRACT_TYPES,
  BEHAVIOR_KINDS,
  ruleClassify,
  polarityConflict,
  type ModelUnit,
  type EntryTest,
} from "@/domain/framing";
import type { ContentTier } from "@/domain/content-tier";
import { liveModelGateway, LIVE_MODEL } from "@/server/adapters/model-gateway/live";
import type { ModelGateway } from "@/server/adapters/model-gateway/contract";

export const EXTRACTOR_VERSIONS = ["xv1", "xv2"] as const;
export type ExtractorVersion = (typeof EXTRACTOR_VERSIONS)[number];

export interface ClassifiedUnit extends ModelUnit {
  entry_test: Partial<EntryTest>;
  observed_condition: string | null;
  requested_solution: string | null;
  measurable_character: string | null;
}
export interface ClassifyOutcome {
  units: ClassifiedUnit[];
  route: string;
  model: string;
  model_version: string;
  adapter_mode: "live" | "simulated" | "none";
  latency_ms: number;
  error?: string;
}

const nstr = { type: ["string", "null"] };
const UNIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["units"],
  properties: {
    units: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "index",
          "classification",
          "object_type",
          "kind",
          "materiality_uncertain",
          "confidence",
          "title",
          "entry_test",
          "observed_condition",
          "requested_solution",
          "measurable_character",
        ],
        properties: {
          index: { type: "integer" },
          classification: { type: "string", enum: [...CLASSES] },
          object_type: { type: ["string", "null"], enum: [...EXTRACT_TYPES, null] },
          kind: { type: ["string", "null"], enum: [...BEHAVIOR_KINDS, null] },
          materiality_uncertain: { type: "boolean" },
          confidence: { type: "number" },
          title: { type: "string" },
          entry_test: {
            type: "object",
            additionalProperties: false,
            required: ["person", "outcome", "ability", "evidence"],
            properties: { person: nstr, outcome: nstr, ability: nstr, evidence: nstr },
          },
          observed_condition: nstr,
          requested_solution: nstr,
          measurable_character: nstr,
        },
      },
    },
  },
};

const PROMPTS: Record<ExtractorVersion, string> = {
  xv1: `You classify statement units from a live business framing session (THREAD Part 8A.5).
For each unit choose exactly one classification:
- question: an open enquiry, not a claim
- suggestion: a proposal, idea or possibility (including needs stated as wishes)
- assumption: stated or implied as true without evidence
- decision: an authoritative choice ("we have decided", "we will", "let's go with")
- confirmed_behavior: an agreed observable behaviour (condition -> observable result)
- context: background, narrative, anecdote, restatement
object_type: NeedStatement for a business need ("we need..."), BehaviorStatement for observable behaviour/rules/exceptions, Assumption, OpenQuestion, ConfirmedDecision, Constraint, NonNegotiableConsequence, EvidenceRequirement, GlossaryTerm, or null for context.
kind (BehaviorStatement only): behavior, rule or exception; otherwise null.
materiality_uncertain: true when you cannot tell whether it is a rule, decision or consequence. Never guess silently.
title: a short neutral title (max 80 chars).
entry_test: fill only parts that this unit states for the sentence "For [person/situation], we will improve [measurable outcome] by enabling [new business ability], proven by [observable production evidence]"; null otherwise.
observed_condition / requested_solution: separate the underlying condition from any requested solution (P3); measurable_character: what can be measured, if stated.
Do not decide authority: the system applies speaker authority afterwards. Return one entry per unit, same index.`,
  xv2: `You are extractor xv2 for THREAD framing sessions. Same task and classes as before, stricter:
- Treat hedged rules ("I think claims must...") as suggestion with materiality_uncertain=true.
- Restatements and summaries are context.
- A need ("we need", "members need") is a suggestion with object_type NeedStatement, unless explicitly agreed.
- "Agreed", "confirmed", "yes, when X then Y" are confirmed_behavior.
Classes: question, suggestion, assumption, decision, confirmed_behavior, context. object_type from the allowed list or null for context; kind only for BehaviorStatement (behavior, rule, exception).
Fill entry_test parts only when stated; separate observed_condition from requested_solution; fill measurable_character when stated. Return one entry per unit, same index.`,
};

function gateway(): ModelGateway | null {
  const key = process.env["LOVABLE_API_KEY"];
  return key ? liveModelGateway(key) : null;
}

function fromRules(texts: string[]): ClassifiedUnit[] {
  return texts.map((t) => ({
    ...ruleClassify(t),
    entry_test: {},
    observed_condition: null,
    requested_solution: null,
    measurable_character: null,
  }));
}

/** Classify statement units. modelMode comes from adapter_bindings (live|simulated). */
export async function classifyUnits(
  texts: string[],
  tier: ContentTier,
  version: ExtractorVersion,
  modelMode: string,
  speakerNotes?: string[],
): Promise<ClassifyOutcome> {
  const t0 = Date.now();
  if (!texts.length)
    return {
      units: [],
      route: "none",
      model: "none",
      model_version: "none",
      adapter_mode: "none",
      latency_ms: 0,
    };
  const gw = gateway();
  if (tier !== "A" || modelMode !== "live" || !gw) {
    const route = tier !== "A" ? "in_boundary.rules" : "simulated.rules";
    return {
      units: fromRules(texts),
      route,
      model: `rules-${version}`,
      model_version: "1.0.0",
      adapter_mode: tier !== "A" ? "none" : "simulated",
      latency_ms: Date.now() - t0,
    };
  }
  try {
    const r = await gw.complete({
      route: `intent.classify.${version}`,
      purpose: "framing statement classification (8A.5)",
      data_classification: "internal",
      schema: { name: "statement_units", schema: UNIT_SCHEMA },
      messages: [
        { role: "system", content: PROMPTS[version] },
        {
          role: "user",
          content: JSON.stringify(
            texts.map((text, index) => ({
              index,
              text,
              ...(speakerNotes?.[index] ? { speaker: speakerNotes[index] } : {}),
            })),
          ),
        },
      ],
    });
    const out = (r.output as { units: Array<ClassifiedUnit & { index: number }> }).units;
    const units = texts.map((t, i) => {
      const u = out.find((x) => x.index === i);
      if (!u) return fromRules([t])[0]!;
      return {
        ...u,
        confidence: Math.max(0, Math.min(1, u.confidence)),
        title: u.title || t.slice(0, 80),
      };
    });
    return {
      units,
      route: `intent.classify.${version}`,
      model: r.model,
      model_version: r.model_version,
      adapter_mode: "live",
      latency_ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      units: fromRules(texts),
      route: "fallback.rules",
      model: `rules-${version}`,
      model_version: "1.0.0",
      adapter_mode: "simulated",
      latency_ms: Date.now() - t0,
      error: (e as Error).message,
    };
  }
}

const CONTRA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["contradictions"],
  properties: {
    contradictions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prior_index", "explanation"],
        properties: { prior_index: { type: "integer" }, explanation: { type: "string" } },
      },
    },
  },
};

/** Which prior statements cannot hold together with the new one? Always surfaced, never auto-resolved. */
export async function findContradictions(
  text: string,
  priors: Array<{ text: string }>,
  tier: ContentTier,
  modelMode: string,
): Promise<Array<{ index: number; explanation: string; method: string }>> {
  if (!priors.length) return [];
  const heuristic = priors
    .map((p, index) => ({ index, hit: polarityConflict(text, p.text) }))
    .filter((x) => x.hit)
    .map((x) => ({
      index: x.index,
      explanation: "Same subject, opposite polarity.",
      method: "rules",
    }));
  const gw = gateway();
  if (tier !== "A" || modelMode !== "live" || !gw) return heuristic;
  try {
    const r = await gw.complete({
      route: "challenge.contradiction.v1",
      purpose: "live contradiction check (8A.7.4)",
      data_classification: "internal",
      schema: { name: "contradictions", schema: CONTRA_SCHEMA },
      messages: [
        {
          role: "system",
          content:
            "You are THREAD's Challenge Agent. Given a NEW statement and numbered PRIOR confirmed statements, list only the priors that cannot both hold with the new statement (a genuine conflict, not a refinement or a different topic). Explain each conflict in one short sentence. Return an empty list if none conflict.",
        },
        {
          role: "user",
          content: JSON.stringify({
            new: text,
            prior: priors.map((p, i) => ({ index: i, text: p.text })),
          }),
        },
      ],
    });
    const out = (
      r.output as { contradictions: Array<{ prior_index: number; explanation: string }> }
    ).contradictions
      .filter((c) => c.prior_index >= 0 && c.prior_index < priors.length)
      .map((c) => ({ index: c.prior_index, explanation: c.explanation, method: LIVE_MODEL }));
    const seen = new Set(out.map((o) => o.index));
    return [...out, ...heuristic.filter((h) => !seen.has(h.index))];
  } catch {
    return heuristic;
  }
}

const VLM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["description", "statements"],
  properties: {
    description: { type: "string" },
    statements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "region"],
        properties: {
          text: { type: "string" },
          region: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
          },
        },
      },
    },
  },
};

/** 8A.2 live drawing: a VLM pass producing a structured description; a drawn arrow is a proposed dependency, never confirmed. */
export async function describeDrawing(
  dataUrl: string,
  modelMode: string,
): Promise<{
  description: string;
  statements: Array<{ text: string; region: { x: number; y: number; w: number; h: number } }>;
  model: string;
} | null> {
  const gw = gateway();
  if (modelMode !== "live" || !gw) return null;
  const r = await gw.complete({
    route: "intent.vlm.v1",
    purpose: "whiteboard structured description (8A.2)",
    data_classification: "internal",
    schema: { name: "drawing", schema: VLM_SCHEMA },
    messages: [
      {
        role: "system",
        content:
          "Describe this whiteboard, diagram or screenshot from a business framing session. Return a short structured description (boxes, labels, swimlanes, arrows) and a list of statement units it depicts, one per box or arrow, each with its bounding region as fractions 0..1 of the image (x, y, w, h). Write arrows as 'A depends on B' sentences. Do not invent content that is not drawn.",
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Describe the drawing." },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
  });
  const o = r.output as {
    description: string;
    statements: Array<{ text: string; region: { x: number; y: number; w: number; h: number } }>;
  };
  return { ...o, model: r.model };
}

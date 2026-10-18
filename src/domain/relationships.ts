/**
 * Relationship verbs (Layer B Part 4.2 and Part 8A.7.2), defined as data.
 * The `relationship_verbs` seed is generated from this file
 * (scripts/gen-phase2-seed.ts), so DB and code never drift.
 *
 * Group names used in Part 4.2 that are not object types resolve through
 * TYPE_GROUPS. "*" means any registered type.
 *
 * `impact` says which way a change propagates for Impact / Blast Radius:
 *  - forward: a change to `from` affects `to`
 *  - reverse: a change to `to` affects `from` (the dependent side is `from`)
 *  - both:    symmetric or weak links
 *  - none:    provenance-only links that never propagate change
 * DESIGN DECISION (AGENTS.md): Part 4.2 does not state propagation direction.
 */
import { REGISTRY } from "./registry";

export type Origin = "stated" | "drawn" | "decomposed" | "capability_reference" | "resolved" | "co_occurrence" | "inferred" | "contradiction";
export const ORIGINS: Origin[] = ["stated", "drawn", "decomposed", "capability_reference", "resolved", "co_occurrence", "inferred", "contradiction"];
/** Part 8A.7.3: a dependency carries a kind; a bare "depends on" is insufficient. */
export const DEPENDENCY_KINDS = ["data", "sequence", "authority", "capability", "decision"] as const;

const familyTypes = (family: string) => REGISTRY.filter((r) => r.family === family).map((r) => r.type);

export const TYPE_GROUPS: Record<string, string[]> = {
  Actor: ["Builder", "BusinessCoCreator"],
  Decision: ["ConfirmedDecision", "Decision"],
  DisprovedAssumption: ["Assumption"],
  CaptureSession: ["FramingSession"],
  Evidence: familyTypes("Evidence"),
  Agent: ["ModelRoute"],
};

export type Impact = "forward" | "reverse" | "both" | "none";
export interface VerbSignature { from: string[]; to: string[] }
export interface VerbDef {
  verb: string;
  signatures: VerbSignature[];
  directed: boolean;
  impact: Impact;
  /** Computed by traversal, never stored as an edge (8A.7.2 affected_by_change). */
  computed?: boolean;
  /** Cycles in these verbs are defects (Part 4.5 rule 6, 8A.7.3). */
  acyclic?: boolean;
}

const s = (from: string, to: string): VerbSignature => ({ from: from.split("|"), to: to.split("|") });
const v = (verb: string, impact: Impact, ...signatures: VerbSignature[]): VerbDef => ({ verb, signatures, directed: true, impact });

export const VERBS: VerbDef[] = [
  // Value flow
  v("signals", "forward", s("ValueSignal", "ValueMission")),
  v("promoted_from", "reverse", s("ValueMission", "ValueSignal")),
  v("scoped_to", "reverse", s("ValueMission", "ValueCell")),
  v("operated_by", "reverse", s("ValueCell", "Actor")),
  v("bursts", "forward", s("ValueCell", "ValueBurst")),
  v("produced", "forward", s("ValueBurst", "WorkingCapability|Evidence|Decision|DisprovedAssumption")),
  // Intent
  v("expresses", "forward", s("IntentModel", "ValueMission")),
  v("contains", "forward", s("IntentModel", "BehaviorStatement")),
  v("governed_by_contract", "forward", s("ExecutableOutcomeContract", "IntentModel")),
  v("confirmed_by", "reverse", s("BehaviorStatement", "Decision")),
  v("constrains", "forward", s("Constraint", "BehaviorStatement")),
  v("non_negotiable", "forward", s("NonNegotiableConsequence", "BehaviorStatement")),
  v("raises", "forward", s("OpenQuestion", "BehaviorStatement")),
  v("assumes", "forward", s("Assumption", "BehaviorStatement")),
  v("disproven_by", "reverse", s("Assumption", "Evidence")),
  // Capability
  v("composes", "reverse", s("WorkingCapability", "ComposableCapability")),
  v("implements", "reverse", s("ComposableCapability", "CapabilityContract")),
  {
    ...v("depends_on", "reverse",
      s("ComposableCapability", "ComposableCapability"),
      s("NeedStatement", "NeedStatement"),
      s("BehaviorStatement", "BehaviorStatement")),
    acyclic: true,
  },
  v("evidenced_by", "reverse", s("ComposableCapability", "Evidence")),
  v("stewarded_by", "none", s("ComposableCapability", "Actor")),
  v("superseded_by", "forward", s("ComposableCapability", "ComposableCapability")),
  // Creation lineage
  v("compiled_into", "forward", s("BehaviorStatement", "CreationPrompt")),
  v("used_template", "reverse", s("CreationPrompt", "PromptTemplate")),
  v("governed_by", "reverse", s("CreationPrompt", "Guardrail")),
  v("dispatched_to", "reverse", s("CreationPrompt", "BuildPlatform")),
  v("executed_as", "forward", s("CreationPrompt", "BuildRun")),
  v("produced_artifact", "forward", s("BuildRun", "BuildArtifact")),
  v("skeleton_of", "reverse", s("WorkingSkeleton", "ValueMission")),
  v("iterated_as", "forward", s("BuildRun", "BuildRun")),
  // Evidence
  v("verified_by", "forward", s("BehaviorStatement|ComposableCapability", "TestRun")),
  // Phase 5: ComposableCapability added so the Part 5.1 chain can run on either capability type.
  v("simulated_by", "forward", s("WorkingCapability|ComposableCapability", "SimulationRun")),
  v("challenged_by", "forward", s("WorkingCapability|ComposableCapability", "AdversarialRun")),
  v("evaluated_by", "forward", s("ModelRoute|Agent", "ModelEvaluation")),
  v("shadowed_by", "forward", s("WorkingCapability|ComposableCapability", "ShadowRun")),
  v("discrepancy_in", "reverse", s("ShadowRun", "Discrepancy")),
  v("authorised_by", "forward", s("ExposureAuthorization", "WorkingCapability|ComposableCapability")),
  v("exposed_to", "forward", s("ExposureAuthorization", "ExposurePopulation")),
  v("observed_as", "forward", s("WorkingCapability|ComposableCapability", "ProductionOutcome")),
  v("values", "forward", s("ProductionOutcome", "ValueMeasure")),
  v("caused", "forward", s("ProductionOutcome", "Incident")),
  // DESIGN DECISION (Phase 5): Part 4.2 has no verb for these Part 5.1 chain links.
  v("decided_from", "reverse", s("ConfirmedDecision", "ValueSignal|FramingSession")),
  v("built", "forward", s("BuildRun", "ComposableCapability|WorkingCapability")),
  v("renews", "none", s("ConfirmedDecision", "ExposureAuthorization")),
  // Authority and assurance
  v("authority_granted_by", "reverse", s("*", "AuthorityGrant")),
  v("policy_evaluated_by", "none", s("*", "PolicyEvaluation")),
  v("control_checked_by", "none", s("*", "ControlCheck")),
  v("consent_basis", "reverse", s("CaptureSession", "ConsentRecord")),
  v("permission_basis", "reverse", s("*", "DataUsePermission")),
  // Convergence and learning
  v("lessons", "forward", s("ValueMission", "Lesson")),
  v("contributes", "forward", s("Lesson", "ReusablePrimitive")),
  v("published_as", "forward", s("ReusablePrimitive", "MarketplaceAsset")),
  v("accelerated_by", "none", s("ValueCell", "ValueCell")),
  // Provenance (universal)
  v("cites", "reverse", s("*", "*")),
  v("rendered_as", "forward", s("*", "Rendition")),
  v("flags", "none", s("DetectorFinding", "*")),
  v("reveals", "none", s("DetectorFinding", "AntiPattern")),
  // DESIGN DECISION: Part 4.5 rule 6 names derives_from without listing it in 4.2.
  { ...v("derives_from", "reverse", s("*", "*")), acyclic: true },
  // Part 8A.7.2 framing verbs
  v("articulated_in", "none", s("NeedStatement", "FramingSession")),
  v("extracted_from", "reverse", s("*", "CoCreationArtifact")),
  v("expressed_as", "forward", s("NeedStatement", "BehaviorStatement")),
  v("addresses", "reverse", s("BehaviorStatement", "NeedStatement")),
  v("blocks", "forward", s("*", "*")),
  v("relates_to", "both", s("*", "*")),
  { ...v("contradicts", "both", s("*", "*")), directed: false },
  v("supersedes_understanding_of", "forward", s("NeedStatement", "NeedStatement")),
  v("clarifies", "forward", s("ExtractedStatement", "*")),
  v("supersedes_statement", "forward", s("ExtractedStatement", "ExtractedStatement")),
  v("raises_question", "forward", s("*", "OpenQuestion")),
  v("resolves_question", "forward", s("ConfirmedDecision", "OpenQuestion")),
  v("needs_capability", "reverse", s("NeedStatement", "ComposableCapability")),
  v("references_capability", "reverse", s("*", "ComposableCapability")),
  v("mentioned_by", "none", s("*", "Actor")),
  { ...v("affected_by_change", "none", s("*", "*")), computed: true },
];

export function expandGroup(name: string): string[] {
  if (name === "*") return ["*"];
  return TYPE_GROUPS[name] ?? [name];
}

/** Expanded signatures: every group resolved to concrete registered types. */
export function expandedSignatures(def: VerbDef): Array<{ from: string[]; to: string[] }> {
  return def.signatures.map((sig) => ({ from: sig.from.flatMap(expandGroup), to: sig.to.flatMap(expandGroup) }));
}

/** Mirrors the DB check in thread_create_edge. */
export function edgeAllowed(verb: string, fromType: string, toType: string): boolean {
  const def = VERBS.find((d) => d.verb === verb);
  if (!def || def.computed) return false;
  return expandedSignatures(def).some(
    (sig) => (sig.from.includes("*") || sig.from.includes(fromType)) && (sig.to.includes("*") || sig.to.includes(toType)),
  );
}

/** UI label for an edge origin. Inferred edges are visually distinct (8A.7.3). */
export const ORIGIN_IS_INFERRED = (o: string) => o === "inferred";

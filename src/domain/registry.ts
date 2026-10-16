/**
 * Object Type Registry seed (Layer B Part 4.3, plus the Part 8A.4 framing types).
 * Key fields are copied from Part 4.3. The SQL seed for `object_type_registry`
 * is generated from this file. Type-specific Zod schemas for the depth-priority
 * types live in src/domain/types/.
 */
import type { LifecycleFamily } from "./lifecycle";

export type RegistryFamily =
  | "Canon"
  | "ValueFlow"
  | "Intent"
  | "Capability"
  | "Creation"
  | "Evidence"
  | "Assurance"
  | "People"
  | "Context"
  | "Learning"
  | "ModelRoute"
  | "Detection"
  | "Generation"
  | "Framing";

export interface RegistryEntry {
  type: string;
  family: RegistryFamily;
  ref_prefix: string;
  lifecycle_family: LifecycleFamily;
  key_fields: string[];
  purpose: string;
}

const e = (
  type: string,
  family: RegistryFamily,
  ref_prefix: string,
  lifecycle_family: LifecycleFamily,
  key_fields: string,
  purpose: string,
): RegistryEntry => ({
  type,
  family,
  ref_prefix,
  lifecycle_family,
  key_fields: key_fields.split(",").map((s) => s.trim()).filter(Boolean),
  purpose,
});

export const REGISTRY: RegistryEntry[] = [
  // A. Canon
  e("Concept", "Canon", "CN", "canon", "definition, formal_definition, distinguishing_notes, replaces, operational_implications", "A defined term of the operating model"),
  e("Principle", "Canon", "PR", "canon", "directive, derivation, violation_examples", "A governing principle"),
  e("Rule", "Canon", "RU", "canon", "trigger, rule_statement, conditions, exceptions, machine_evaluable, evaluator_ref", "A machine-evaluable rule"),
  e("Protocol", "Canon", "PT", "canon", "preconditions, steps, decision_points, outputs", "How a recurring operating move happens"),
  e("Guardrail", "Canon", "GR", "canon", "boundary_statement, enforcement_mode, evaluator_ref, severity, risk_tiers, violation_response", "A deterministic or advisory boundary"),
  e("Pattern", "Canon", "PA", "canon", "context, problem, approach, canonical_example, conformance_check_ref", "A reusable approach"),
  e("AntiPattern", "Canon", "AP", "canon", "signature, why_harmful, detector_ref, remediation", "A named failure mode with a detector"),
  e("Metric", "Canon", "ME", "canon", "definition, formula, unit, data_sources, direction, target_shape, rejected", "A value measure definition"),
  e("Authority", "Canon", "AU", "canon", "authority_level, scope, conditions, granted_to, granting_evidence, demotion_triggers", "A scoped authority grant rule"),
  // B. Value
  e("ValueSignal", "ValueFlow", "VS", "value_signal", "observed_condition, affected_population, process_or_journey, evidence, frequency, duration, magnitude, baseline_performance, potential_value, urgency, confidence, possible_causes, consequences_of_inaction, related_signals, candidate_capabilities, recommended_co_creator, recommended_builder, recommended_next_probe, requested_solution_candidates", "An observed condition worth acting on"),
  e("ValueMission", "ValueFlow", "VM", "value_mission", "signal_ref, measurable_condition, baseline, target, affected_population, operating_boundaries, proof_required, value_hypothesis, co_creator, builder, strategic_relevance, opportunity_cost, decision_authority, capital_boundary, available_data_tools_capabilities, risk_classification, policy_constraints, maximum_production_exposure, required_evidence_for_authority, human_intervention_conditions, reversibility_requirements, rollback_requirements, maximum_time, maximum_investment, decision_date, stop_conditions, completion_criteria, status", "A bounded mission to change a measurable condition"),
  e("ValueCell", "ValueFlow", "VC", "canon", "mission_ref, co_creator, builder, agents, authority_boundaries, active_bursts, formed_at, dissolution_condition, contribution_log", "The co-creator, builder and agents operating a mission"),
  e("ValueBurst", "ValueFlow", "VB", "canon", "cell_ref, start, end, intent_compression, experience_generation, live_interaction_evidence, autonomous_challenge_results, refinement, controlled_exposure_ref, decision_ref, material_change_of", "A time-boxed burst that changes capability, evidence or direction"),
  e("OpportunityStreamItem", "ValueFlow", "OS", "opportunity_stream", "expiration_condition, value_estimate, urgency, required_context, candidate_builders, readiness_evidence", "An item in the opportunity stream"),
  // C. Intent
  e("IntentModel", "Intent", "IM", "canon", "mission_ref, desired_outcome, affected_people_and_situations, observable_behaviour, business_rules, exceptions, constraints, non_negotiable_consequences, decisions, rationale, representative_examples, evidence, confidence, assumptions, open_questions, acceptance_history, change_history", "The living intent model of a mission"),
  e("BehaviorStatement", "Intent", "BS", "behavior_statement", "condition, observable_result, operating_constraints, source_decision_ref, confirmation, generates, verification_status", "The traceable unit of intent (UI alias: requirement)"),
  e("ExecutableOutcomeContract", "Intent", "EO", "canon", "desired_outcome, baseline, target, target_users_and_situations, affected_parties, observable_behaviours, rules_and_exceptions, non_negotiables, acceptance_evidence, risk_classification, authority_level, success_value_adoption_health_measures, production_exposure_conditions, reversibility_conditions, expiration_and_retirement_criteria", "Governs an intent model"),
  e("Constraint", "Intent", "CT", "canon", "kind, source, binding_scope", "A binding constraint"),
  e("NonNegotiableConsequence", "Intent", "NN", "canon", "statement, why_non_negotiable, violation_severity, detector_ref", "A consequence that must never happen"),
  e("ConfirmedDecision", "Intent", "CD", "evidence_record", "decision, decided_by, authority_used, context, alternatives, rationale, reversibility, consequences, effective_from", "A decision recorded under stated authority"),
  e("OpenQuestion", "Intent", "OQ", "canon", "question, why_it_matters, blocking, owner, needed_by", "An unresolved question"),
  e("Assumption", "Intent", "AS", "canon", "statement, basis, confidence, verification_method, status", "A held assumption awaiting verification"),
  // D. Capability
  e("ComposableCapability", "Capability", "CC", "composable_capability", "plain_language_purpose, business_outcome, intended_consumers, input_schema, output_schema, preconditions, dependencies, business_rules, exceptions, data_classifications, permitted_uses, authority_level, risk_tier, policy_constraints, security_privacy_accessibility_constraints, confidence_requirements, explainability_audit_behaviour, failure_modes, recovery_behaviour, human_intervention_conditions, test_simulation_evaluation_refs, service_levels, cost_resource_telemetry_ref, version, compatibility, owner_and_stewardship, review_date, minimum_use_threshold, operating_cost_ceiling, retirement_condition, is_machine_discoverable", "A reusable, machine-discoverable capability"),
  e("WorkingCapability", "Capability", "WC", "composable_capability", "mission_ref, capability_refs", "A capability working inside a mission (Part 4.2 verbs)"),
  e("CapabilityContract", "Capability", "CK", "canon", "promised_outcome, refusal_conditions, explanation_obligations, evidence_obligations, authority, cost_model, lifecycle", "The formal intent-and-outcome contract"),
  e("CapabilityDependency", "Capability", "DP", "canon", "from, to, kind, criticality", "A typed capability dependency"),
  e("DataProduct", "Capability", "DA", "canon", "name, steward, schema, quality_measures, classifications, permitted_uses, lineage_refs", "A governed data product"),
  // E. Creation
  e("CreationPrompt", "Creation", "CP", "creation_run", "source_behavior_statements, intent_model_ref, outcome_contract_ref, design_context_refs, guardrail_set_ref, prompt_template_ref, target_platform, expected_risk_tier, estimated_cost, authority_required, compiled_at, compiled_by, diffusion_ref", "A prompt compiled only from typed confirmed fields"),
  e("PromptTemplate", "Creation", "TP", "canon", "platform, stack, version, owner, guardrail_set, evaluation_status, supersedes, change_requires_eval", "A versioned, eval-gated template"),
  e("BuildPlatform", "Creation", "BP", "canon", "name, hosting, permitted_data_classifications, capabilities, integration_surface, auth_model, attestation_ref", "A build platform"),
  e("BuildRun", "Creation", "BR", "creation_run", "prompt_ref, platform, model_route_ref, model_version_pin, guardrail_set_version, template_version, dispatched_at, completed_at, duration, cost, outcome, failure_reason, reproducibility_key, agent_actor, authority_used, log_ref", "A dispatched build with a reproducibility key"),
  e("BuildArtifact", "Creation", "BA", "evidence_record", "run_ref, repository, commit_or_version, image_or_bundle, digest, files_changed, diff_ref, secrets_scan_result, dependency_manifest", "An artifact produced by a run"),
  e("WorkingSkeleton", "Creation", "WS", "canon", "mission_ref, one_real_user_process, minimal_interface, minimal_data_model, one_integration_path, access_control_basis, observable_output, automated_safe_deployment_ref, rollback_ref", "The first thin end-to-end slice"),
  e("Iteration", "Creation", "IT", "evidence_record", "from_run, to_run, trigger, change_class", "A classified change between runs"),
  // F. Evidence
  e("TestSuite", "Evidence", "TS", "evidence_record", "generated_from, provenance, independence_class", "A test suite with independence class"),
  e("TestRun", "Evidence", "TR", "evidence_record", "suite_ref, target_version, environment, executed_at, results, pass_fail, evidence_artifacts", "A test execution"),
  e("SimulationRun", "Evidence", "SR", "evidence_record", "scenario_spec, synthetic_population, conditions_covered, results, findings", "A simulation"),
  e("AdversarialRun", "Evidence", "AR", "evidence_record", "attempts, classes, findings, severity, remediated", "An adversarial challenge"),
  e("ModelEvaluation", "Evidence", "MV", "evidence_record", "model_route, suite, metrics, pass_fail", "A model evaluation"),
  e("ShadowRun", "Evidence", "SH", "evidence_record", "capability_ref, event_source, sample_size, period, shadow_outputs, actual_outcomes, comparison_result, discrepancy_rate, confidence_evidence, risk_evidence, bias_evidence, conditions_requiring_human_judgment", "A shadow comparison"),
  e("Discrepancy", "Evidence", "DS", "evidence_record", "shadow_run_ref, case_ref, shadow_decision, actual_decision, delta, hypothesised_cause, disposition", "A shadow discrepancy"),
  e("ExposureAuthorization", "Evidence", "EA", "evidence_record", "capability_ref, authority_level_granted, exposure_population, conditions, rollback_armed, kill_switch_ref, authorised_by, evidence_bundle_ref, effective_from, effective_to, authority_can_be_withdrawn", "Authority to expose a capability"),
  e("ExposurePopulation", "Evidence", "XP", "evidence_record", "percent, cohort_definition, event_set", "A defined exposure population (Part 4.2 verbs)"),
  e("ProductionOutcome", "Evidence", "PO", "evidence_record", "capability_ref, version, period, events_processed, outcomes, behaviour_observed, failures, incidents, cost, risk_indicators, unintended_consequences", "Observed production behaviour"),
  e("ValueMeasure", "Evidence", "VA", "evidence_record", "mission_ref, measure_ref, value, unit, baseline, delta, confidence, source_evidence, realised_at", "A realised value measurement"),
  e("Incident", "Evidence", "IN", "evidence_record", "capability_ref, severity, description, detection, response, rollback_ref, root_cause, learning_ref", "A production incident"),
  e("Rollback", "Evidence", "RB", "evidence_record", "capability_ref, from_version, to_version, executed_at, executed_by, outcome, duration", "An executed rollback"),
  // G. Assurance
  e("ControlCheck", "Assurance", "CH", "evidence_record", "control_ref, subject_ref, result, evidence, evaluator", "A control check"),
  e("PolicyEvaluation", "Assurance", "PE", "evidence_record", "policy_ref, subject_ref, inputs, decision, conditions, decided_by, deterministic", "A deterministic policy evaluation"),
  e("AccessibilityEvaluation", "Assurance", "AE", "evidence_record", "standard, subject_ref, checks, findings, result", "A WCAG evaluation"),
  e("SecurityScan", "Assurance", "SS", "evidence_record", "kind, subject_ref, findings, severity_summary", "A security scan"),
  e("DataUsePermission", "Assurance", "DU", "canon", "data_product_ref, purpose, permitted, basis, restrictions, expires_at", "A data-use permission"),
  e("ConsentRecord", "Assurance", "CR", "evidence_record", "participant, session_ref, scope, granted_at, withdrawn_at, evidence", "Recorded consent for capture"),
  e("AuthorityGrant", "Assurance", "AG", "evidence_record", "subject_ref, authority_level, scope, evidence_refs, granted_by", "An authority grant (Part 4.2 verbs)"),
  // H. People
  e("Builder", "People", "BU", "canon", "identity, layers, capability_profile_ref, active_cells", "A builder"),
  e("BusinessCoCreator", "People", "BC", "canon", "identity, business_domain, decision_authority, active_missions", "A business co-creator"),
  e("CapabilityProfile", "People", "CF", "canon", "domains_understood, outcomes_delivered, swarms_orchestrated, reusable_capabilities_contributed, risks_safely_managed, systems_simplified_or_retired, value_realised, other_builders_accelerated, consequence_types_navigated, quality_maintained_as_autonomy_increased, derived_from_evidence", "An evidence-derived capability profile, never self-described"),
  e("HumanDecisionRequest", "People", "HD", "evidence_record", "exact_decision_required, reason_ai_cannot_safely_decide, current_evidence_and_confidence, ai_recommendation, viable_alternatives, affected_parties, deadline, cost_of_waiting, reversibility, current_authority_boundary, proposed_next_machine_action", "The only human wait state (Part 6.5)"),
  e("Decision", "People", "DE", "evidence_record", "request_ref, decision, decided_by, authority_used, rationale, effective_from, reversal_of", "A decision answering a decision request"),
  // I. Context
  e("GlossaryTerm", "Context", "GT", "canon", "term, definition", "A canonical glossary term"),
  e("DomainModel", "Context", "DM", "canon", "domain, entities", "A domain model"),
  e("ReferencePattern", "Context", "RP", "canon", "pattern, example", "A reference pattern"),
  e("DesignSystemToken", "Context", "DT", "canon", "token, value", "A design system token"),
  e("EntityExample", "Context", "EX", "canon", "entity, example", "A representative entity example"),
  // J. Learning
  e("Lesson", "Learning", "LE", "canon", "context, what_happened, what_was_learned, generalisable, contributed_to_canon", "A lesson"),
  e("FailurePattern", "Learning", "FP", "canon", "signature, conditions, detection_ref, prevention", "A failure pattern"),
  e("ReusablePrimitive", "Learning", "RX", "canon", "kind, source_mission, publication_state", "A reusable primitive"),
  e("MarketplaceAsset", "Learning", "MA", "canon", "primitive_ref, category, usage_stats_ref, owner", "A marketplace asset"),
  // K. Model and route
  e("ModelRoute", "ModelRoute", "MR", "canon", "provider, endpoint, region, cleared_content_tiers, attestation_ref, attestation_expiry, model_version_pin, cost_profile, eval_status, permitted_task_classes", "A model route"),
  e("ProviderAttestation", "ModelRoute", "PV", "canon", "type, scope, valid_from, valid_to, owner", "A provider attestation"),
  e("EvaluationSuite", "ModelRoute", "ES", "canon", "name, version, golden_set_ref, metrics, pass_thresholds, last_run", "An evaluation suite"),
  // L. Detector
  e("Detector", "Detection", "DR", "canon", "name, failure_mode_ref, detection_method, inputs, threshold, severity, owner_role, remediation_hint", "A detector with an owner"),
  e("DetectorFinding", "Detection", "DF", "detector_finding", "detector_ref, subject_refs, evidence, severity, first_seen, assigned_to, resolution", "A finding with an owner"),
  e("Rendition", "Generation", "RN", "rendition", "source_object_ref, kind, generator, generated_at, expires_when, permission_context", "Generated from canon. Not canon."),
  // Part 8A.4 framing types
  e("FramingSession", "Framing", "FS", "canon", "mission_ref, co_creator, builder, participants, purpose, opened_at, closed_at, consent_ref, content_tier, artifacts, extraction_revision, entry_test_result", "A consented co-creation session"),
  e("CoCreationArtifact", "Framing", "CA", "evidence_record", "session_ref, kind, content_tier, consent_basis, storage_ref", "Captured material. Evidence, not canon"),
  e("ExtractedStatement", "Framing", "XS", "framing_extract", "session_ref, classification, provenance_spans, extractor_version, model_version, confidence", "A classified segment with provenance spans"),
  e("NeedStatement", "Framing", "NS", "framing_extract", "need, affected_people, provenance_spans", "A business need (the COO's named unit)"),
  e("DependencyProposal", "Framing", "DX", "framing_extract", "from_ref, to_ref, verb, source, confidence, provenance_spans", "A proposed relationship awaiting confirmation"),
  e("EvidenceRequirement", "Framing", "ER", "framing_extract", "decision_ref, evidence_needed, provenance_spans", "Evidence required for the next decision"),
  e("Persona", "Framing", "PS", "framing_extract", "description, provenance_spans", "An affected person type"),
  e("Situation", "Framing", "SI", "framing_extract", "description, provenance_spans", "An affected situation"),
];

/** Phrases that may never be an object type (Part 2.4 withdrawn objects, Part 16.2 no document type). */
export const PROHIBITED_TYPE_PATTERN =
  /(document|wiki|project|programme|squad|epic|user.?story|backlog|sprint|test.?phase|design.?review|approval|status.?report|release.?completion|ownership|job.?title|seniority|personal.?output|traceability.?matrix|readiness|sign.?off|requirement)/i;

export function discoveryDescriptor(entry: RegistryEntry) {
  return {
    purpose: entry.purpose,
    family: entry.family,
    lifecycle_family: entry.lifecycle_family,
    ref_format: `${entry.ref_prefix}-YYYY-NNNN`,
    key_fields: entry.key_fields,
    how_to_use: `Read the envelope statement and machine_description; body carries ${entry.type} key fields from Part 4.3.`,
  };
}

export function bodySchema(entry: RegistryEntry) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: entry.type,
    type: "object",
    properties: Object.fromEntries(entry.key_fields.map((f) => [f, {}])),
    additionalProperties: true,
  };
}

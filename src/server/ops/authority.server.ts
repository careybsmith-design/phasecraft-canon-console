import type { EvaluationInput } from "@/domain/authority-input";
import type { AuthorityLevel } from "@/domain/mcp";
import { opErr as err, envelope, type Json, type OpCtx } from "./context";

export async function evaluateActionCore(ctx: OpCtx, data: EvaluationInput, options: { simulateAgent?: boolean; agentCeiling?: AuthorityLevel } = {}) {
    const e = await import("@/server/authority/engine");
    const { classifyContent } = await import("@/domain/content-tier");
    const { data: obj, error } = await ctx.sb.from("objects")
      .select("id,human_ref,type,title,owner_id,steward_id,risk_tier,consequence_class,data_classification,authority_level,expiration_condition,permission,review_date,expires_at,is_tombstone")
      .eq("id", data.object_id).maybeSingle();
    if (error) throw err(error.message);
    if (!obj) throw err("NOT_FOUND: object not visible to you");
    if (obj.is_tombstone || obj.review_date < new Date().toISOString().slice(0, 10) || (obj.expires_at && Date.parse(obj.expires_at) <= Date.now())) throw err("SUBJECT_EXPIRED: current policy evidence requires a current subject");
    const db = ctx.db;
    const now = new Date().toISOString();
    const [{ data: grs, error: guardrailError }, { data: grants, error: grantError }] = await Promise.all([
      db.from("guardrails").select("id,category,evaluator,enforcement,params,version").eq("active", true),
      db.from("objects").select("id,body").eq("type", "AuthorityGrant").eq("is_tombstone", false).eq("body->>subject_ref", obj.id).order("created_at", { ascending: false }).limit(1),
    ]);
    if (guardrailError || grantError) throw err("POLICY_CONTEXT_UNAVAILABLE: guardrails or authority grants could not be read");
    const rawGrant = grants?.[0]?.body as Json | undefined;
    // An object-scoped grant is not an actor/action authorization. Missing scope fails closed.
    const g = rawGrant && (rawGrant["actor_ref"] === ctx.userId || rawGrant["agent_ref"] === ctx.actor.agent_id)
      && (rawGrant["action"] === data.action || (Array.isArray(rawGrant["actions"]) && rawGrant["actions"].includes(data.action))) ? rawGrant : undefined;
    const tierIn = classifyContent(data.content_text ?? "");
    const evidenceIds = [...new Set(Object.values(data.dimensions).flatMap((d) => d.evidence_refs))];
    if (evidenceIds.length) {
      const evidence = await ctx.sb.from("objects").select("id,body,review_date,expires_at,is_tombstone,lifecycle_state").in("id", evidenceIds);
      if (evidence.error || evidence.data?.length !== evidenceIds.length) throw err("EVIDENCE_NOT_PERMITTED: every confidence reference must exist and be readable");
      for (const item of evidence.data) {
        const body = item.body as Json;
        const provenance = body["provenance"] as Json | null;
        if (item.is_tombstone || item.review_date < now.slice(0, 10) || (item.expires_at && item.expires_at <= now) || ["draft", "proposed", "superseded", "retired", "failed"].includes(item.lifecycle_state) || body["adapter_mode"] === "simulated" || provenance?.["simulated"] === true || body["results"] === "not_executed") throw err("CURRENT_EVIDENCE_REQUIRED: confidence cannot use expired, draft or simulated evidence");
      }
    }
    // 6.1: risk is computed first and stored with its inputs; it never lowers the stored tier.
    const risk = e.assessRisk({
      consequence: obj.consequence_class as never, sensitivity: data.risk.sensitivity ?? (obj.data_classification as never),
      autonomy: data.risk.autonomy, reversibility: data.risk.reversibility, exposure: data.risk.exposure, novelty: data.risk.novelty,
      evidence: Object.values(data.dimensions).filter((d) => d.evidence_refs.length).length / e.CONFIDENCE_DIMENSIONS.length,
    }, now);
    const tier = Math.max(Number(obj.risk_tier), risk.computed_tier) as 1 | 2 | 3 | 4;
    const actionContext = {
      action: data.action, now,
      object: { id: obj.id, type: obj.type, owner_id: obj.owner_id, steward_id: obj.steward_id, risk_tier: tier, consequence_class: obj.consequence_class as never, data_classification: obj.data_classification as never, has_expiration: !!obj.expiration_condition },
      actor: ctx.actor.kind === "agent" ? { kind: "agent" as const, id: ctx.userId, authority: options.agentCeiling ?? "observe" } : options.simulateAgent ? { kind: "agent" as const, id: `agent-for:${obj.id}`, authority: obj.authority_level as never } : { kind: "human" as const, id: ctx.userId, authority: obj.authority_level as never },
      grant: g ? { level: g["authority_level"] as never, effective_to: (g["effective_to"] as string) ?? null, attestation_expires_at: (g["attestation_expires_at"] as string) ?? null } : null,
      ...(data.content_text ? { content_text: data.content_text } : {}), flags: data.flags,
    };
    const bundle = { ...data.dimensions, owner_confidence: data.owner_confidence !== undefined ? { value: data.owner_confidence } : undefined };
    const out = e.evaluateAuthority(actionContext, bundle as never, (grs ?? []) as never);
    const actor = ctx.actor;
    const recordedRisk = await db.rpc("thread_record_risk", { p_actor: actor, p_id: obj.id, p: { inputs: { ...risk, reasons: undefined }, computed_tier: String(risk.computed_tier), treatment: risk.treatment, reasons: risk.reasons, computed_by: risk.computed_by } } as never);
    if (recordedRisk.error) throw err("RISK_RECORDING_FAILED: policy evaluation was not completed");
    // Raw text is never stored: only the tier and the reasons.
    const inputs = { action: data.action, risk_tier: tier, consequence_class: obj.consequence_class, content_tier: tierIn.tier, content_reasons: tierIn.reasons,
      dimensions: data.dimensions, flags: data.flags, grant_ref: grants?.[0]?.id ?? null, authority_level: obj.authority_level };
    const pe = await db.rpc("thread_create_object", {
      p_actor: actor,
      p: envelope("PolicyEvaluation", `${out.treatment.replaceAll("_", " ")}: ${data.action} on ${obj.human_ref}`, out.explanation, {
        policy_ref: out.rule_ids, subject_ref: obj.id, inputs, decision: out.policy_decision, conditions: out.conditions,
        decided_by: out.engine, deterministic: true, treatment: out.treatment, engine_decision: out.decision,
        guardrail_results: out.guardrails, prohibited: out.prohibited, confidence: out.confidence, confidence_rule: e.CONFIDENCE_RULE.version,
      }, ctx.userId, { evidence_refs: evidenceIds, permission: obj.permission, data_classification: obj.data_classification, derived_from: [obj.id] }) as never,
    });
    if (pe.error) throw err(pe.error.message);
    const peRow = pe.data as { id: string; human_ref: string };
    let hdr: { id: string; human_ref: string } | null = null;
    if (out.decision === "escalate_human_decision") {
      const body = {
        exact_decision_required: `May "${data.action}" proceed on ${obj.human_ref} (${obj.title})?`,
        reason_ai_cannot_safely_decide: out.explanation,
        current_evidence_and_confidence: peRow.id,
        ai_recommendation: out.confidence.band === "high" ? "Proceed under limited exposure with rollback armed" : "Do not proceed until evidence improves",
        viable_alternatives: [
          { option: "Proceed", consequences: `Acts with ${obj.consequence_class} consequence`, affected_parties: ["consequence owner"] },
          { option: "Proceed with limited exposure", consequences: "Smaller population, enhanced observation", affected_parties: ["limited population"] },
          { option: "Do not proceed", consequences: "Value is delayed; no new risk", affected_parties: ["mission"] },
        ],
        affected_parties: ["consequence owner", "affected population"],
        deadline: new Date(Date.now() + 3 * 864e5).toISOString(),
        cost_of_waiting: "The action does not happen until a human decides.",
        reversibility: obj.consequence_class,
        current_authority_boundary: { object_id: obj.id, level: obj.authority_level, grant_ref: grants?.[0]?.id ?? null, independent_judgment_required: out.independent },
        proposed_next_machine_action: `Run "${data.action}" as decided, then record the outcome`,
      };
      const h = await db.rpc("thread_create_object", { p_actor: actor, p: envelope("HumanDecisionRequest", `Decide: ${data.action} on ${obj.human_ref}`, body.exact_decision_required, body, obj.owner_id ?? ctx.userId, { risk_tier: String(tier), permission: obj.permission, data_classification: obj.data_classification, derived_from: [obj.id], evidence_refs: [peRow.id] }) as never });
      if (h.error) throw err(h.error.message);
      hdr = h.data as { id: string; human_ref: string };
    }
    return { outcome: out, risk, policy_evaluation: peRow, decision_request: hdr };
}

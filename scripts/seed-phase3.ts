/**
 * Phase 3 seed: the published confidence rule (as a steward-owned Rule object + confidence_rules row)
 * and the six guardrail categories (Part 6.6). Generated from src/server/authority/engine.ts so the two agree.
 * Run once: bun scripts/seed-phase3.ts (needs SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL).
 */
import { createClient } from "@supabase/supabase-js";
import { CONFIDENCE_RULE, PROMOTION_THRESHOLDS, ENGINE_ID } from "../src/server/authority/engine";

const url = process.env["VITE_SUPABASE_URL"]!;
const db = createClient(url, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
  auth: { persistSession: false },
});

export const GUARDRAILS = [
  {
    category: "ai_principles_ethical_standards",
    evaluator: "principle_conformance",
    enforcement: "advisory",
    params: {},
  },
  {
    category: "policies_standards_procedures",
    evaluator: "policy_rule",
    enforcement: "enforcing",
    params: { rule: "consequential action has a named owner" },
  },
  {
    category: "risk_appetite_acceptable_use",
    evaluator: "risk_appetite",
    enforcement: "enforcing",
    params: { max_autonomous_tier: 3 },
  },
  {
    category: "model_data_governance",
    evaluator: "model_data_governance",
    enforcement: "enforcing",
    params: {},
  },
  {
    category: "human_oversight",
    evaluator: "human_oversight",
    enforcement: "enforcing",
    params: { promotion_thresholds: PROMOTION_THRESHOLDS, provisional: true },
  },
  {
    category: "transparency_fairness_accountability",
    evaluator: "transparency_citation",
    enforcement: "advisory",
    params: {},
  },
] as const;

async function main() {
  const { data: steward } = await db
    .from("user_roles")
    .select("user_id")
    .eq("role", "steward")
    .limit(1)
    .single();
  if (!steward) throw new Error("no steward");
  const actor = { kind: "human", id: steward.user_id, authority_used: "observe" };
  const { data: existing } = await db
    .from("confidence_rules")
    .select("version")
    .eq("version", CONFIDENCE_RULE.version);
  if (!existing?.length) {
    const { data: rule, error } = await db.rpc("thread_create_object", {
      p_actor: actor,
      p: {
        type: "Rule",
        title: `Confidence overall rule ${CONFIDENCE_RULE.version}`,
        statement: CONFIDENCE_RULE.text,
        machine_description:
          "Published, versioned, readable rule that computes ConfidenceBundle.overall (Part 6.3). Never learned.",
        body: {
          trigger: "confidence bundle computed",
          rule_statement: CONFIDENCE_RULE.text,
          conditions: CONFIDENCE_RULE.required,
          exceptions: [],
          machine_evaluable: true,
          evaluator_ref: `${ENGINE_ID}#computeOverall`,
        },
        review_date: new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10),
        expiration_condition: { kind: "review_date_passes" },
        retirement_path: { mode: "supersede" },
        risk_tier: "3",
        consequence_class: "costly_reversible",
        steward_id: steward.user_id,
        permission: { roles: [], purpose: "authority engine" },
        data_classification: "internal",
        rationale:
          "Phase 3: Part 6.3 requires the overall rule to be a Rule object with a steward and history",
      } as never,
    });
    if (error) throw error;
    const r = rule as { id: string; version: number };
    const t = await db.rpc("thread_transition_object", {
      p_actor: actor,
      p_id: r.id,
      p_expected_version: r.version,
      p_to_state: "active",
      p_rationale: "published",
    } as never);
    if (t.error) throw t.error;
    const ins = await db.from("confidence_rules").insert({
      version: CONFIDENCE_RULE.version,
      published_at: new Date().toISOString(),
      definition: {
        rule_object_id: r.id,
        text: CONFIDENCE_RULE.text,
        required: CONFIDENCE_RULE.required,
        bands: CONFIDENCE_RULE.bands,
        evaluator: `${ENGINE_ID}#computeOverall`,
      },
    });
    if (ins.error) throw ins.error;
    console.log("rule", r.id);
  }
  const { count } = await db
    .from("guardrails")
    .select("*", { count: "exact", head: true })
    .eq("active", true);
  if (!count) {
    const g = await db.from("guardrails").insert(
      GUARDRAILS.map((x) => ({
        id: crypto.randomUUID(),
        version: "1.0.0",
        active: true,
        proposed_by: "human",
        ...x,
      })),
    );
    if (g.error) throw g.error;
  }
  console.log("ok");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

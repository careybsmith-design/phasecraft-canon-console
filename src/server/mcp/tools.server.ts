/**
 * Tool implementations for the MCP gateway. Reads use ctx.sb (the agent's own identity, so permissions apply at
 * retrieval); writes go through thread_* functions with the agent as actor. Shared cores live in src/server/ops.
 */
import { opErr as err, envelope, type Json, type OpCtx } from "@/server/ops/context";
import { PROHIBITED_TYPE_PATTERN } from "@/domain/registry";
import { APPROVAL_STATE_PATTERN } from "@/domain/lifecycle";
import {
  detectChangeClass,
  scopeSmuggled,
  GOVERNANCE,
  type IterationDiff,
} from "@/domain/creation";
import { prohibitedInference, type RenditionKind } from "@/domain/generation";
import { EvalInput } from "@/domain/authority-input";
import { scanForInjection } from "@/domain/mcp";
import { ObjectLookupInput, GraphSearchInput } from "@/domain/object-read";

export type AgentCtx = OpCtx & {
  agentId: string;
  ownerId: string;
  authorityCeiling?: import("@/domain/mcp").AuthorityLevel;
};
type Handler = (ctx: AgentCtx, a: Json) => Promise<unknown>;

async function call<T = unknown>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await q;
  if (error) throw err(error.message);
  return data as T;
}
const S = (v: unknown) => String(v ?? "");
const create = (
  ctx: AgentCtx,
  type: string,
  title: string,
  statement: string,
  body: Json,
  extra: Json = {},
) =>
  call<{ id: string; human_ref: string; lifecycle_state?: string }>(
    ctx.db.rpc("thread_create_object", {
      p_actor: ctx.actor,
      p: envelope(type, title, statement, body, ctx.userId, {
        machine_description: `${type} recorded by agent ${ctx.agentId} through MCP`,
        ...extra,
      }),
    } as never),
  );
const OBJ =
  "id,human_ref,type,title,statement,machine_description,body,version,lifecycle_state,risk_tier,authority_level,data_classification,review_date,owner_id,content_hash,is_tombstone";

async function visible(ctx: AgentCtx, id: string, cols = OBJ) {
  const { data, error } = await ctx.sb.from("objects").select(cols).eq("id", id).maybeSingle();
  if (error) throw err(error.message);
  if (!data) throw err("NOT_FOUND: not visible to this agent");
  return data as unknown as Json;
}

async function generate(ctx: AgentCtx, kind: RenditionKind, a: Json) {
  const { generateRenditionCore } = await import("@/server/ops/generation.server");
  return generateRenditionCore(ctx, {
    kind,
    purpose: S(a["purpose"]),
    request_text: S(a["focus"]),
    source_ids: a["source_ids"] as string[],
  });
}

export const HANDLERS: Record<string, Handler> = {
  async record_value_signal(ctx, a) {
    const { recordSignalCore } = await import("@/server/ops/signal-intake.server");
    return recordSignalCore(
      ctx,
      a as never,
      ctx.actor.kind === "agent" ? "agent_sensor" : "human_expertise",
    );
  },
  async extract_signal_from_artifact(ctx, a) {
    const { extractSignalCore } = await import("@/server/ops/signal-intake.server");
    return extractSignalCore(ctx, a as never);
  },
  async start_signal_capture(ctx, a) {
    const { startCaptureCore } = await import("@/server/ops/signal-intake.server");
    return startCaptureCore(
      ctx,
      a as { modalities: string[]; purpose: string; consent_confirmed: true },
    );
  },
  async complete_signal_capture(ctx, a) {
    const { completeCaptureCore } = await import("@/server/ops/signal-intake.server");
    return completeCaptureCore(ctx, a as { capture_id: string; transcript: string });
  },
  async promote_signal(ctx, a) {
    const { promoteSignalCore } = await import("@/server/ops/signal-intake.server");
    return promoteSignalCore(ctx, { signal_id: S(a["signal_id"]), rationale: S(a["rationale"]) });
  },
  async link_signal_to_mission(ctx, a) {
    const { linkSignalCore } = await import("@/server/ops/signal-intake.server");
    return linkSignalCore(ctx, {
      signal_id: S(a["signal_id"]),
      mission_id: S(a["mission_id"]),
      rationale: S(a["rationale"]),
    });
  },
  async detect_value_signal(ctx, a) {
    const cond = S(a["observed_condition"]);
    return create(
      ctx,
      "ValueSignal",
      S(a["title"]) || `Signal: ${cond.slice(0, 120)}`,
      cond,
      {
        observed_condition: cond,
        affected_population: a["affected_population"] ?? null,
        evidence: a["evidence_refs"],
        requested_solution_candidates: a["requested_solution_candidates"],
        detected_by: { kind: "agent", agent_id: ctx.agentId },
      },
      { evidence_refs: a["evidence_refs"] },
    );
  },
  async score_value_signal(ctx, a) {
    const o = await visible(ctx, S(a["signal_id"]));
    if (o["type"] !== "ValueSignal") throw err("NOT_A_SIGNAL");
    const b = (o["body"] ?? {}) as Json;
    const num = (k: string) => (typeof b[k] === "number" ? (b[k] as number) : null);
    const ev = Array.isArray(b["evidence"]) ? (b["evidence"] as unknown[]).length : 0;
    // DESIGN DECISION: scores are read from the signal's typed fields; a missing field stays unscored rather than guessed.
    return {
      signal: o["human_ref"],
      magnitude: num("magnitude"),
      urgency: num("urgency"),
      value: num("potential_value"),
      confidence_bundle: {
        evidence_count: ev,
        band: ev >= 3 ? "medium" : "low",
        basis: "evidence references on the signal",
      },
      unscored: ["magnitude", "urgency", "potential_value"].filter((k) => num(k) === null),
    };
  },
  async find_related_missions(ctx, a) {
    const q = S(a["condition"]);
    const lim = Number(a["limit"] ?? 10);
    const run = (type: string) =>
      ctx.sb
        .from("objects")
        .select("id,human_ref,type,title,lifecycle_state")
        .eq("type", type)
        .eq("is_tombstone", false)
        .textSearch("search", q, { type: "websearch" })
        .limit(lim);
    const [m, c] = await Promise.all([run("ValueMission"), run("ComposableCapability")]);
    if (m.error) throw err(m.error.message);
    if (c.error) throw err(c.error.message);
    return { missions: m.data ?? [], capabilities: c.data ?? [] };
  },
  async create_value_mission(ctx, a) {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    return humanOperation(ctx, "mission", a);
  },
  async recommend_value_cell(ctx, a) {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    return humanOperation(ctx, "cell", a);
  },
  async start_value_burst(ctx, a) {
    const { humanOperation } = await import("@/server/ops/human-surfaces.server");
    return humanOperation(ctx, "burst", a);
  },
  async search_capability_fabric(ctx, a) {
    const { searchFabricCore } = await import("@/server/ops/fabric.server");
    return searchFabricCore(ctx, a as never);
  },
  async request_exposure_authority(ctx, a) {
    const cap = await visible(ctx, S(a["capability_id"]));
    const body = {
      exact_decision_required: `May ${cap["human_ref"]} be exposed to ${a["population_pct"]}% of its population?`,
      reason_ai_cannot_safely_decide:
        "Productive exposure is authorised by a person (Part 6); an agent may only request it.",
      current_evidence_and_confidence: S(a["reason"]),
      ai_recommendation: `Expose to ${a["population_pct"]}% with the kill switch armed`,
      viable_alternatives: [
        {
          option: "Authorise",
          consequences: "Exposure proceeds",
          affected_parties: ["exposed population"],
        },
        { option: "Decline", consequences: "No exposure", affected_parties: ["mission"] },
      ],
      affected_parties: ["exposed population"],
      deadline: new Date(Date.now() + 3 * 864e5).toISOString(),
      cost_of_waiting: "Value is delayed until a person decides.",
      reversibility: "assisted",
      current_authority_boundary: { object_id: cap["id"], level: cap["authority_level"] },
      proposed_next_machine_action: "Record exposure only after the decision",
    };
    return create(
      ctx,
      "HumanDecisionRequest",
      `Decide: exposure of ${cap["human_ref"]}`,
      body.exact_decision_required,
      body,
      { owner_id: cap["owner_id"] ?? ctx.ownerId },
    );
  },
  async monitor_outcome_evidence(ctx, a) {
    const cap = await visible(ctx, S(a["capability_id"]), "id,human_ref");
    const all = await call<Array<{ type: string }>>(
      ctx.sb
        .from("objects")
        .select("id,human_ref,type,title,statement,lifecycle_state,body,created_at")
        .in("type", ["ProductionOutcome", "ValueMeasure", "Incident"])
        .eq("is_tombstone", false)
        .contains("body", { capability_ref: cap["id"] })
        .limit(100),
    );
    return {
      capability: cap["human_ref"],
      production_outcomes: all.filter((r) => r.type === "ProductionOutcome"),
      value_measures: all.filter((r) => r.type === "ValueMeasure"),
      incidents: all.filter((r) => r.type === "Incident"),
    };
  },
  async publish_reusable_capability(ctx, a) {
    return call(
      ctx.db.rpc("thread_publish_capability", {
        p_actor: ctx.actor,
        p_id: S(a["capability_id"]),
        p_contract_id: S(a["contract_id"]),
      } as never),
    );
  },
  async detect_legacy_behavior(_ctx, a) {
    const t = S(a["text"]);
    const matches: Array<{ pattern: string; match: string }> = [];
    const m1 = t.match(new RegExp(PROHIBITED_TYPE_PATTERN.source, "gi"));
    if (m1) for (const x of m1) matches.push({ pattern: "withdrawn_object (Part 2.4)", match: x });
    const m2 = t.match(new RegExp(APPROVAL_STATE_PATTERN.source, "gi"));
    if (m2)
      for (const x of m2) matches.push({ pattern: "approval_wait_state (Part 4.4)", match: x });
    const pi = prohibitedInference(t);
    if (pi)
      matches.push({ pattern: `prohibited_inference (Part 14.3): ${pi.key}`, match: pi.reason });
    return { legacy: matches.length > 0, matches };
  },

  async get_object(ctx, a) {
    const { lookupObjectCore } = await import("@/server/ops/object-read.server");
    return lookupObjectCore(ctx.sb, ObjectLookupInput.parse(a));
  },
  async search_graph(ctx, a) {
    const { searchGraphCore } = await import("@/server/ops/object-read.server");
    return searchGraphCore(ctx.sb, GraphSearchInput.parse(a));
  },
  async traverse_graph(ctx, a) {
    return call(
      ctx.sb.rpc("graph_neighbourhood", {
        p_root: S(a["root"]),
        p_depth: Number(a["depth"] ?? 2),
        p_edge_budget: 300,
        p_verbs: (a["verbs"] as string[] | undefined) ?? null,
      } as never),
    );
  },
  async get_rendition(ctx, a) {
    return call(
      ctx.db.rpc("thread_serve_rendition", {
        p_actor: ctx.actor,
        p_id: S(a["id"]),
        p_purpose: S(a["purpose"]),
      }),
    );
  },
  async list_renditions(ctx) {
    return call(
      ctx.sb
        .from("renditions")
        .select("id,human_ref,kind,state,generated_at,expires_at,permission_context")
        .order("generated_at", { ascending: false })
        .limit(50),
    );
  },
  async propose_canon_change(ctx, a) {
    return call(
      ctx.db.rpc("thread_propose_canon_change", {
        p_actor: ctx.actor,
        p: {
          object_id: a["object_id"],
          patch: a["patch"],
          rationale: a["rationale"],
          evidence_refs: a["evidence_refs"],
        },
      } as never),
    );
  },
  async challenge_canon(ctx, a) {
    return call(
      ctx.db.rpc("thread_add_canon_challenge", {
        p_actor: ctx.actor,
        p_change_id: S(a["change_id"]),
        p_argument: S(a["argument"]),
        p_evidence_refs: a["evidence_refs"],
      } as never),
    );
  },
  async get_canon_history(ctx, a) {
    const id = S(a["object_id"]);
    await visible(ctx, id, "id");
    const [v, l] = await Promise.all([
      ctx.sb
        .from("object_versions")
        .select("version,title,statement,lifecycle_state,content_hash,updated_at")
        .eq("id", id)
        .order("version", { ascending: false }),
      ctx.sb
        .from("ledger")
        .select("seq,occurred_at,action,object_version,hash")
        .eq("object_id", id)
        .order("seq", { ascending: false })
        .limit(100),
    ]);
    if (v.error) throw err(v.error.message);
    if (l.error) throw err(l.error.message);
    return { versions: v.data ?? [], ledger: l.data ?? [] };
  },

  async add_behavior_statement(ctx, a) {
    return create(
      ctx,
      "BehaviorStatement",
      S(a["title"]) || `When ${S(a["condition"]).slice(0, 80)}`,
      `When ${S(a["condition"])}, ${S(a["observable_result"])}`,
      {
        condition: a["condition"],
        observable_result: a["observable_result"],
        operating_constraints: a["operating_constraints"],
        source_decision_ref: a["source_decision_ref"] ?? null,
      },
    );
  },
  async confirm_behavior_statement(ctx, a) {
    return call(
      ctx.db.rpc("thread_transition_object", {
        p_actor: ctx.actor,
        p_id: S(a["id"]),
        p_expected_version: Number(a["expected_version"]),
        p_to_state: "confirmed",
        p_rationale: S(a["rationale"]),
      }),
    );
  },
  async record_decision(ctx, a) {
    return create(
      ctx,
      "ConfirmedDecision",
      `Decision: ${S(a["decision"]).slice(0, 150)}`,
      S(a["decision"]),
      {
        decision: a["decision"],
        decided_by: { kind: "agent", agent_id: ctx.agentId },
        authority_used: ctx.actor.authority_used,
        context: a["context"],
        alternatives: a["alternatives"],
        rationale: a["rationale"],
        reversibility: a["reversibility"],
        effective_from: new Date().toISOString(),
      },
    );
  },
  async raise_open_question(ctx, a) {
    return create(ctx, "OpenQuestion", S(a["question"]).slice(0, 200), S(a["question"]), {
      question: a["question"],
      why_it_matters: a["why_it_matters"],
      blocking: a["blocking"],
      owner: ctx.ownerId,
    });
  },
  async record_assumption(ctx, a) {
    return create(ctx, "Assumption", S(a["statement"]).slice(0, 200), S(a["statement"]), {
      statement: a["statement"],
      basis: a["basis"],
      verification_method: a["verification_method"],
      status: "held",
    });
  },
  async disprove_assumption(ctx, a) {
    const o = await visible(ctx, S(a["id"]));
    if (o["type"] !== "Assumption") throw err("NOT_AN_ASSUMPTION");
    return call(
      ctx.db.rpc("thread_tombstone_object", {
        p_actor: ctx.actor,
        p_id: S(a["id"]),
        p_expected_version: Number(a["expected_version"]),
        p_reason: `Disproved: ${S(a["rationale"])} (evidence ${(a["evidence_refs"] as string[]).join(", ")})`,
      }),
    );
  },
  async update_intent_model(ctx, a) {
    return call(
      ctx.db.rpc("thread_revise_object", {
        p_actor: ctx.actor,
        p_id: S(a["id"]),
        p_expected_version: Number(a["expected_version"]),
        p_patch: a["patch"],
        p_rationale: S(a["rationale"]),
      } as never),
    );
  },

  async explain_capability(ctx, a) {
    return call(
      ctx.sb.rpc("explain_capability", {
        p_id: S(a["capability_id"]),
        p_question: S(a["question"]),
      }),
    );
  },
  async trace_chain(ctx, a) {
    return call(ctx.sb.rpc("trace_full_chain", { p_id: S(a["capability_id"]) }));
  },
  async blast_radius(ctx, a) {
    return call(ctx.sb.rpc("trace_blast_radius", { p_behavior: S(a["behavior_id"]) }));
  },
  async find_gaps(ctx, a) {
    return call(ctx.sb.rpc("chain_completeness", { p_id: S(a["capability_id"]) }));
  },
  async find_orphans(ctx, a) {
    return call(ctx.sb.rpc("graph_orphans", { p_limit: Number(a["limit"] ?? 50) }));
  },
  async find_unowned(ctx) {
    return call(ctx.sb.rpc("trace_value_without_owner" as never));
  },

  async record_reuse_check(ctx, a) {
    const { reuseCheckCore } = await import("@/server/ops/fabric.server");
    return reuseCheckCore(ctx, a as never);
  },
  async compile_creation_prompt(ctx, a) {
    const { compilePromptCore } = await import("@/server/ops/creation.server");
    return compilePromptCore(ctx, a as never);
  },
  async dispatch_build(ctx, a) {
    const { dispatchCore } = await import("@/server/ops/creation.server");
    return dispatchCore(ctx, {
      prompt_id: S(a["prompt_id"]),
      platform: a["platform"] as never,
      cost_ceiling: Number(a["cost_ceiling"]),
      estimated_cost: Number(a["estimated_cost"] ?? 0),
    });
  },
  async record_build_run(ctx, a) {
    const run = await visible(ctx, S(a["run_id"]), "id,human_ref,lifecycle_state");
    const data = await call(
      ctx.sb.from("build_runs").select("*").eq("object_id", S(a["run_id"])).maybeSingle(),
    );
    return { ...run, run: data };
  },
  async record_iteration(ctx, a) {
    return call(ctx.db.rpc("thread_record_iteration", { p_actor: ctx.actor, p: a } as never));
  },
  async classify_change(_ctx, a) {
    const d = a as unknown as IterationDiff;
    const c = detectChangeClass(d);
    return {
      detected_class: c,
      governance: GOVERNANCE[c],
      scope_smuggled_if_declared_cosmetic: scopeSmuggled("cosmetic", d),
    };
  },

  async evaluate_authority(ctx, a) {
    const { evaluateActionCore } = await import("@/server/ops/authority.server");
    return evaluateActionCore(ctx, EvalInput.parse({ ...a, agent: true }), {
      agentCeiling: ctx.authorityCeiling ?? "observe",
    });
  },
  async request_human_decision(ctx, a) {
    const subj = await visible(ctx, S(a["subject_id"]), "id,human_ref,owner_id,authority_level");
    const body = {
      exact_decision_required: a["exact_decision_required"],
      reason_ai_cannot_safely_decide: a["reason_ai_cannot_safely_decide"],
      current_evidence_and_confidence: subj["id"],
      ai_recommendation: a["ai_recommendation"],
      viable_alternatives: (a["viable_alternatives"] as string[]).map((o) => ({
        option: o,
        consequences: "stated by the requesting agent",
        affected_parties: ["consequence owner"],
      })),
      affected_parties: ["consequence owner"],
      deadline: new Date(S(a["deadline"])).toISOString(),
      cost_of_waiting: a["cost_of_waiting"],
      reversibility: a["reversibility"],
      current_authority_boundary: { object_id: subj["id"], level: subj["authority_level"] },
      proposed_next_machine_action: "Act only as the person decides",
    };
    return create(
      ctx,
      "HumanDecisionRequest",
      `Decide: ${S(a["exact_decision_required"]).slice(0, 150)}`,
      S(a["exact_decision_required"]),
      body,
      { owner_id: subj["owner_id"] ?? ctx.ownerId },
    );
  },
  async grant_exposure_authority(ctx, a) {
    return call(
      ctx.db.rpc("thread_authorize_exposure", {
        p_actor: ctx.actor,
        p_capability: S(a["capability_id"]),
        p: { population_pct: a["population_pct"], rationale: a["rationale"] },
      } as never),
    );
  },
  async withdraw_authority(ctx, a) {
    await visible(ctx, S(a["object_id"]), "id");
    const evidence = (a["evidence_refs"] as string[] | undefined) ?? [];
    for (const ref of evidence) await visible(ctx, ref, "id");
    return call(
      ctx.db.rpc("thread_set_authority", {
        p_actor: ctx.actor,
        p_id: S(a["object_id"]),
        p_to: "observe",
        p_cause: "withdrawal",
        p_trigger: S(a["reason"]),
        p_evidence: evidence,
        p_conditions: {},
      } as never),
    );
  },
  async evaluate_policy(ctx, a) {
    await visible(ctx, S(a["object_id"]), "id");
    const [g, pe] = await Promise.all([
      ctx.sb
        .from("guardrails")
        .select("id,category,evaluator,enforcement,version")
        .eq("active", true),
      ctx.sb
        .from("objects")
        .select("id,human_ref,title,body,created_at")
        .eq("type", "PolicyEvaluation")
        .contains("body", { subject_ref: S(a["object_id"]) })
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (g.error) throw err(g.error.message);
    if (pe.error) throw err(pe.error.message);
    return { guardrails: g.data ?? [], evaluations: pe.data ?? [] };
  },
  async check_guardrails(_ctx, a) {
    const t = S(a["text"]);
    return { injection: scanForInjection(t), prohibited_inference: prohibitedInference(t) };
  },

  async start_shadow(ctx, a) {
    return call(
      ctx.db.rpc("thread_record_shadow_run", {
        p_actor: ctx.actor,
        p_capability: S(a["capability_id"]),
        p: { sample_size: a["sample_size"], cases: a["cases"] },
      } as never),
    );
  },
  async record_production_outcome(ctx, a) {
    return call(
      ctx.db.rpc("thread_record_production_outcome", {
        p_actor: ctx.actor,
        p_capability: S(a["capability_id"]),
        p: a,
      } as never),
    );
  },
  async record_value_measure(ctx, a) {
    return call(
      ctx.db.rpc("thread_record_value_measure", {
        p_actor: ctx.actor,
        p_mission: S(a["mission_id"]),
        p: a,
      } as never),
    );
  },
  async raise_incident(ctx, a) {
    return call(
      ctx.db.rpc("thread_record_incident", {
        p_actor: ctx.actor,
        p_capability: S(a["capability_id"]),
        p: a,
      } as never),
    );
  },
  async execute_rollback(ctx, a) {
    return call(
      ctx.db.rpc("thread_record_rollback", {
        p_actor: ctx.actor,
        p_capability: S(a["capability_id"]),
        p: { reason: a["reason"] },
      } as never),
    );
  },
  async arm_kill_switch(ctx, a) {
    return call(
      ctx.db.rpc("thread_kill_switch", {
        p_actor: ctx.actor,
        p_capability: S(a["capability_id"]),
        p: { reason: a["reason"], requested_at: new Date().toISOString() },
      } as never),
    );
  },
  async check_data_use_permission(ctx, a) {
    await visible(ctx, S(a["object_id"]), "id");
    return call(
      ctx.sb
        .from("objects")
        .select("id,human_ref,title,statement,body")
        .eq("type", "DataUsePermission")
        .eq("is_tombstone", false)
        .limit(50),
    );
  },

  async get_capability_contract(ctx, a) {
    const cap = await visible(ctx, S(a["capability_id"]));
    const data = await call(
      ctx.sb
        .from("objects")
        .select(OBJ)
        .eq("type", "CapabilityContract")
        .contains("body", { capability_ref: cap["id"] })
        .limit(5),
    );
    return { capability: cap, contracts: data ?? [] };
  },
  async compose_capabilities(ctx, a) {
    return call(
      ctx.db.rpc("thread_compose_capabilities", {
        p_actor: ctx.actor,
        p_ids: a["ids"],
        p_title: S(a["title"]),
        p_scenario: S(a["scenario"]),
      } as never),
    );
  },
  async propose_capability(ctx, a) {
    return create(
      ctx,
      "ComposableCapability",
      S(a["title"]),
      S(a["statement"]),
      { plain_language_purpose: a["statement"], reuse_check_ref: a["reuse_check_id"] },
      {
        data_classification: a["data_classification"],
        ...(a["machine_description"] ? { machine_description: a["machine_description"] } : {}),
        ...(a["review_date"] ? { review_date: a["review_date"] } : {}),
      },
    );
  },
  async retire_capability(ctx, a) {
    return call(
      ctx.db.rpc("thread_transition_object", {
        p_actor: ctx.actor,
        p_id: S(a["capability_id"]),
        p_expected_version: Number(a["expected_version"]),
        p_to_state: "retired",
        p_rationale: S(a["reason"]),
      }),
    );
  },
  async check_capability_usage(ctx, a) {
    await visible(ctx, S(a["capability_id"]), "id");
    const data = await call(
      ctx.sb
        .from("capability_usage")
        .select("*")
        .eq("capability_id", S(a["capability_id"]))
        .limit(200),
    );
    const rows = (data ?? []) as Json[];
    return {
      uses: rows.length,
      consumers: new Set(rows.map((r) => S(r["consumer_ref"] ?? r["consumer"]))).size,
      note: "aggregate only (Part 14.3)",
    };
  },
  async list_detector_findings(ctx, a) {
    let q = ctx.sb
      .from("detector_findings")
      .select("id,detector_key,object_id,severity,state,created_at")
      .eq("state", "open")
      .order("created_at", { ascending: false })
      .limit(Number(a["limit"] ?? 50));
    if (a["detector_key"]) q = q.eq("detector_key", S(a["detector_key"]));
    return call(q);
  },
  async resolve_finding(ctx, a) {
    const f = await call<Json | null>(
      ctx.sb
        .from("detector_findings")
        .select("id,owner_id")
        .eq("id", S(a["finding_id"]))
        .maybeSingle(),
    );
    if (!f || f["owner_id"] !== ctx.userId) throw err("FINDING_OWNER_REQUIRED");
    return call(
      ctx.db.rpc("thread_resolve_finding", {
        p_actor: ctx.actor,
        p_finding: S(a["finding_id"]),
        p_resolution: S(a["resolution"]),
      }),
    );
  },
  async measure_flow(ctx, a) {
    if (prohibitedInference(S(a["scope"]))) throw err("PROHIBITED_INFERENCE");
    const s = await call<Json>(ctx.sb.rpc("phase10_measurements_extended"));
    return s["flow"];
  },
  async measure_value(ctx, a) {
    if (prohibitedInference(S(a["scope"]))) throw err("PROHIBITED_INFERENCE");
    const s = await call<Json>(ctx.sb.rpc("phase10_measurements_extended"));
    return s["value"];
  },
  async measure_community(ctx, a) {
    if (prohibitedInference(S(a["scope"]))) throw err("PROHIBITED_INFERENCE");
    const s = await call<Json>(ctx.sb.rpc("phase10_measurements_extended"));
    return s["community"];
  },
  async measure_capability_health(ctx, a) {
    await visible(ctx, S(a["capability_id"]), "id");
    const s = await call<Json>(ctx.sb.rpc("phase10_measurements_extended"));
    return (Array.isArray(s["capability"]) ? (s["capability"] as Json[]) : []).filter(
      (c) => c["id"] === a["capability_id"],
    );
  },
  async get_intent_to_value_time(ctx, a) {
    return call(ctx.sb.rpc("get_intent_to_value_time", { p_capability: S(a["capability_id"]) }));
  },

  async generate_briefing(ctx) {
    return call(ctx.db.rpc("thread_generate_morning_brief", { p_user: ctx.userId }));
  },
  async generate_explanation(ctx, a) {
    return generate(ctx, "capability_explanation", a);
  },
  async generate_scenario(ctx, a) {
    return generate(ctx, "role_specific_scenario", a);
  },
  async generate_decision_tree(ctx, a) {
    return generate(ctx, "decision_tree", a);
  },

  async log_need(ctx, a) {
    return create(ctx, "NeedStatement", S(a["statement"]).slice(0, 200), S(a["statement"]), {
      statement: a["statement"],
      observed_condition: a["observed_condition"],
    });
  },
  async log_behavior_statement(ctx, a) {
    const handler = HANDLERS["add_behavior_statement"];
    if (!handler) throw err("TOOL_UNAVAILABLE");
    return handler(ctx, {
      condition: a["condition"],
      observable_result: a["observable_result"],
      operating_constraints: a["constraints"],
    });
  },
  async link_need_to_behavior(ctx, a) {
    return call(
      ctx.db.rpc("thread_create_edge", {
        p_actor: ctx.actor,
        p: {
          from_id: a["behavior_id"],
          to_id: a["need_id"],
          verb: "satisfies",
          origin: "stated",
          rationale: "linked by agent through MCP",
        },
      } as never),
    );
  },
  async propose_dependency(ctx, a) {
    return call(
      ctx.db.rpc("thread_create_edge", {
        p_actor: ctx.actor,
        p: {
          from_id: a["from_id"],
          to_id: a["to_id"],
          verb: "depends_on",
          origin: "inferred",
          properties: { kind: a["kind"] },
          rationale: "proposed by agent; inferred until a person confirms",
        },
      } as never),
    );
  },
  async confirm_object(ctx, a) {
    return call(
      ctx.db.rpc("thread_transition_object", {
        p_actor: ctx.actor,
        p_id: S(a["object_id"]),
        p_expected_version: Number(a["expected_version"]),
        p_to_state: S(a["to_state"]),
        p_rationale: S(a["rationale"]),
      }),
    );
  },
  async surface_prior_objects(ctx, a) {
    const run = (types: string[]) =>
      ctx.sb
        .from("objects")
        .select("id,human_ref,type,title")
        .in("type", types)
        .eq("is_tombstone", false)
        .textSearch("search", S(a["statement"]), { type: "websearch" })
        .limit(10);
    const [n, d, c] = await Promise.all([
      run(["NeedStatement"]),
      run(["ConfirmedDecision", "Decision"]),
      run(["ComposableCapability"]),
    ]);
    if (n.error) throw err(n.error.message);
    if (d.error) throw err(d.error.message);
    if (c.error) throw err(c.error.message);
    return { needs: n.data ?? [], decisions: d.data ?? [], capabilities: c.data ?? [] };
  },
  async find_contradictions(ctx) {
    return call(ctx.sb.rpc("graph_contradictions"));
  },
  async render_need_web(ctx, a) {
    return call(
      ctx.sb.rpc("graph_neighbourhood", {
        p_root: S(a["root_id"]),
        p_depth: Number(a["depth"] ?? 2),
        p_edge_budget: 300,
        p_verbs: ["satisfies", "serves", "addresses"],
      } as never),
    );
  },
  async render_dependency_web(ctx, a) {
    return call(
      ctx.sb.rpc("graph_neighbourhood", {
        p_root: S(a["root_id"]),
        p_depth: Number(a["depth"] ?? 2),
        p_edge_budget: 300,
        p_verbs: ["depends_on"],
      } as never),
    );
  },
  async render_unresolved_frontier(ctx, a) {
    await visible(ctx, S(a["mission_ref"]), "id");
    return call(
      ctx.sb
        .from("objects")
        .select("id,human_ref,type,title,lifecycle_state")
        .in("type", ["OpenQuestion", "Assumption"])
        .eq("is_tombstone", false)
        .limit(100),
    );
  },

  async list_notifications(ctx, a) {
    return call(
      ctx.db.rpc("thread_mcp_take_notifications", {
        p_agent: ctx.agentId,
        p_limit: Number(a["limit"] ?? 50),
      }),
    );
  },
  async send_agent_message(ctx, a) {
    for (const r of (a["object_refs"] as string[]) ?? []) await visible(ctx, r, "id");
    const seq = await call<number>(
      ctx.db.rpc("thread_a2a_message", {
        p_from: ctx.agentId,
        p_to: S(a["to_agent_id"]),
        p: { intent: a["intent"], object_refs: a["object_refs"] },
      } as never),
    );
    return { ledger_seq: seq };
  },
};

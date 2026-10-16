# THREAD — Build Prompt for Lovable

**The ValueOS Enterprise Operating Graph, Evidence Graph and Generation Fabric**
Prepared for: Carey Smith, COO, MASA Global · Source: *THREAD Build Plan, ValueOS-Native Edition, Revision 1.1 (15 October 2026)* · Prompt date: 15 October 2026

---

## How to use this prompt (read first, Lovable)

This file is one build specification. It has two layers:

- **Layer A: the Lovable build directives (Sections 1–19).** This layer tells you *how* to build THREAD on this platform: stack mapping, concrete Postgres DDL, server functions, the MCP endpoint, adapter contracts, and the order of capability slices. When this layer and the source differ on technology, this layer wins, and each such case is labelled **DESIGN DECISION (Lovable adaptation)**.
- **Layer B: the canonical specification (Appendix C).** This is the full source build plan, Parts 1–23, reproduced verbatim. It is normative. Every schema, rule, state, detector, query, budget and test in Layer B must be implemented exactly as written. Layer A never weakens Layer B; it only maps it onto Lovable's stack.

Work through the capability slices in Section 16 in order. Each slice is finished when its **exit evidence** exists and its acceptance tests pass, not when a date passes. Before each slice, re-read Section 2 (constraints) and the Layer B parts that slice cites. Do not ask the user to confirm standard work. Ask only about the items in Appendix B (OPEN) or when a credential is needed.

Markers used throughout (from the source, Part 0.3):

| Marker | Meaning |
|---|---|
| **NON-NEGOTIABLE** | Must appear in the build, be enforced in code, and be covered by an acceptance test |
| **PROHIBITED** | Must not exist anywhere in the system; its absence is testable |
| **SOURCE** | Derived directly from the MASA AI Strategy, the ValueOS operating model, or Carey's direction |
| **DESIGN DECISION** | A choice made where the sources were silent; may be challenged |
| **OPEN** | An unresolved decision requiring Carey's confirmation |

---

## 1. Objective

THREAD is MASA Global's canonical, machine-readable, versioned Enterprise Operating Graph, plus the evidence graph that connects every Value Signal to every decision, creation, authority grant, production outcome and value result. It is exposed as agent-executable MCP tools and as human-facing surfaces that are generated, stamped and set to expire. In plain words, it is the enterprise's living memory of what it intended, decided, built, was permitted to do, proved and gained, plus the machinery that lets people and AI agents act on that memory directly instead of reading about it. **THREAD is a place people and agents act through, never a place people go to read.** The single largest risk is that THREAD becomes a very well-organised wiki. Every slice must be checked against that risk, and the anti-wiki acceptance suite (Section 17, test group AW) proves it has not happened.

---

## 2. Non-negotiable constraints

### 2.1 Absolute prohibitions (carry into code, schema, UI and tests)

1. **PROHIBITED:** THREAD is not an intranet, wiki, knowledge base, project-management tool, delivery methodology, status reporting system, documentation portal, approval workflow engine, certification platform, chatbot, social feed, LMS, or a content site. (Part 2.3)
2. **PROHIBITED, withdrawn objects (Part 2.4):** none of the following may appear as an object type, table, column, enum value, screen, report, metric or field: project request, project/programme, delivery team/squad, requirement as an administrative work object, epic, user story, backlog, sprint, test phase, design review, approval board, status report, release completion, application ownership, job title/seniority, personal output, requirement traceability matrix, requirement readiness gate, prompt approval policy, gate readiness scorecard/sign-off, coverage percentage as a success metric, documentation production as a task. Implement the ValueOS replacement listed in Part 2.4 for each one.
3. **NON-NEGOTIABLE, the requirement alias (Part 2.5, confirmed by the COO 15 Oct 2026):** the traceable unit is a `BehaviorStatement` inside a Living Intent Model, governed by an `ExecutableOutcomeContract`. "Requirement" may appear **only** as a human-facing label alias in the UI and in the `legacy_alias` registry for imported legacy identifiers. It must never have its own lifecycle, completion metric or readiness gate. "Requirements completed" must never be a measure.
4. **NON-NEGOTIABLE (Part 4.4):** no object type may have a state named or meaning "awaiting approval", "pending sign-off", "submitted for review" or "in QA phase". The only human wait state is a `HumanDecisionRequest` in the Human Decision Queue, with exactly the fields in Part 6.5.
5. **PROHIBITED (Part 15.3):** the rejected measures must be absent from the schema, the API responses and every surface. A schema test and a live detector enforce this.
6. **PROHIBITED (Part 14.3):** the surveillance inferences listed in Part 14.3. Any rendition or query requesting individual activity metrics is refused at generation time.
7. **PROHIBITED (Part 8A.6):** any measure that counts draft objects as progress.
8. **NON-NEGOTIABLE (Part 13.4):** the creation prompt must contain no raw captured text. Prompts are compiled only from typed, confirmed fields.
9. **NON-NEGOTIABLE (P11, Part 7.4):** no creation may begin until the fabric has been searched and the result recorded (`ReuseCheck`). This is enforced by a database constraint and by server logic, not by convention.
10. No administrative ceremony: no approval workflows for standard work, no sign-off queues, no review boards, no stage gates with committees, no status reporting. Where a checkpoint seems needed, add an **evidence condition** instead.

### 2.2 Governing principles P1–P15 (Part 3), all NON-NEGOTIABLE

Each principle below must be enforced in code and have at least one named acceptance test (Section 17 maps tests to principles).

| # | Principle | Lovable enforcement point |
|---|---|---|
| P1 | Canon is separate from generated | `renditions` table is separate from `objects`; no FK, trigger or function writes a rendition into `objects`; a DB trigger rejects any `objects` write whose `derived_from` includes a rendition id |
| P2 | Authority is separate from confidence | Separate columns `authority_level` and `confidence_bundle`, with separate history tables `authority_history` and `confidence_history` |
| P3 | Intent is separate from the requested solution | `body.observed_condition` and `body.requested_solution_candidates[]` on ValueSignal; detector `RequestedSolutionWithoutCondition` |
| P4 | Expiration everywhere | `review_date`, `expiration_condition` and a retirement path are `NOT NULL` on every live object (CHECK constraint) |
| P5 | Machine-discoverable and agent-executable | Every type in `object_type_registry` has a `discovery_descriptor`; every operation has a `tool_contracts` row |
| P6 | No approval queues for standard work | Enum audit test (AW-2) |
| P7–P8 | See Layer B Part 3 | Implement as written |
| P9 | Complete provenance | Append-only `ledger` with hash chain; a trigger rejects consequential writes that lack `provenance_chain_id` |
| P10 | Anti-pattern detection is a product capability | `detectors` registry with an owner on every detector |
| P11 | Reuse before creating | FK `creation_prompts.reuse_check_id NOT NULL` → `reuse_checks` |
| P12 | Measured by value, not output | Rejected-measure schema test plus a language detector |
| P13 | Consent and surveillance boundaries | `consent_records` gate every capture insert (RLS + trigger) |
| P14 | Open protocols | MCP endpoint, A2A cards, provider-agnostic model router, canon export |
| P15 | The model can challenge itself | Canon change = new version + evidence + challenge window + recorded `ConfirmedDecision` |

All remaining NON-NEGOTIABLE and PROHIBITED statements from the source are listed verbatim, with their location, in **Appendix A**. Every one of them is binding.

---

## 3. Architecture

### 3.1 Five kernels plus two supporting services (Part 2.2, DESIGN DECISION in source)

```text
                 Human surfaces (generated, stamped, expiring)          External agents
                 Companion · Mission Runtime · Explorer · Evidence ·    (Claude Code, Codex,
                 Decision Queue · Feed · Fabric · Capture · Sim ·        Cursor, Grok bots, A2A)
                 Canon console · Framing Session                                |
                          |                                                     |
                   TanStack server functions                           /api/public/mcp  (K5)
                          |                                                     |
   +------------------------------------------------------------------------------------+
   | K3 Authority & Guardrail Engine (deterministic, pure TS, no model in the decision)   |
   +------------------------------------------------------------------------------------+
   | K1 Operating Graph  | K2 Evidence Graph  | K4 Generation Layer | Detectors (cross)   |
   +------------------------------------------------------------------------------------+
   | Capability Fabric (reuse-first gate)    | Creation-Loop Recorder (prompt→run→artifact)|
   +------------------------------------------------------------------------------------+
   | Lovable Cloud Postgres: objects · edges · ledger · vectors · renditions · storage    |
   +------------------------------------------------------------------------------------+
                          |  Adapter boundary (real contracts, simulated until connected)
   AI Factory: model gateway · transcription · build platforms · CI/CD · telemetry · IdP
```

### 3.2 Creation loop (Part 8.1)

```text
ValueSignal -> (promote) ValueMission -> ValueCell -> ValueBurst -> FramingSession
  -> ExtractedStatement (draft) -> confirm -> BehaviorStatement + ExecutableOutcomeContract
  -> ReuseCheck (search_capability_fabric)  [hard block if absent]
  -> CreationPrompt (compiled from typed fields only) -> BuildRun (reproducibility key)
  -> BuildArtifact -> Simulation / Adversarial / Tests -> ShadowRun -> ExposureAuthorization
  -> ProductionOutcome -> ValueMeasure -> (iteration: classify_change) -> next version
```

### 3.3 Lovable stack mapping (DESIGN DECISION, Lovable adaptation)

| Concern | Source recommendation (Part 16/17) | Lovable implementation |
|---|---|---|
| Framework | Services per Part 17.1 | TanStack Start v1 app; each source "service" becomes a server module `src/server/<service>/*.server.ts`, called through `createServerFn` wrappers in `src/server/<service>/*.functions.ts` |
| Object store | PostgreSQL + JSONB | Lovable Cloud Postgres, table `objects` (typed envelope columns + `body jsonb`) and `object_versions` |
| Graph | Apache AGE (alt. Neo4j) | **Not available on Lovable.** Table `edges` plus recursive CTE functions (`graph_traverse`, `graph_paths`, `graph_closure`, `graph_cycles`, `graph_orphans`) written in SQL. Depth caps and edge budgets per Part 16.4–16.5 |
| Semantic discovery | pgvector | pgvector, `object_embeddings` (general) and `object_embeddings_restricted` (separate table, separate RLS, never merged) |
| Evidence/audit ledger | Append-only, hash-chained | `ledger` table; `REVOKE UPDATE, DELETE`; BEFORE trigger computes `hash = sha256(prev_hash ‖ canonical_json(row))`; nightly verifier |
| Artifacts and renditions | S3-compatible, versioned | Lovable Cloud storage buckets `artifacts` (immutable, private) and `renditions` (private, lifecycle by expiry) |
| Search | Postgres FTS / OpenSearch | Postgres FTS (`tsvector` generated column) + trigram for identifiers |
| Models | AI Factory gateway | `ModelGateway` adapter. The default implementation calls the Lovable AI Gateway; the production implementation targets the MASA Factory gateway. All calls are logged per Part 13.3 |
| Agent surface | MCP gateway | Server route `src/routes/api/public/mcp.ts` (JSON-RPC MCP over Streamable HTTP). It verifies an agent bearer token against `agents` inside the handler |
| Auth / identity | Factory IdP (Entra, etc.) | Lovable Cloud auth (email + Google) now; `IdentityProvider` adapter for SSO later. Roles in a separate `user_roles` table with a `has_role()` security-definer function, never on the profile |
| Scheduled sweeps | Scheduler | `/api/public/cron/*` server routes, protected by a shared secret, triggered by pg_cron + pg_net |
| Runtime | Cloud-agnostic | Edge (Worker) runtime: no Node-only libraries in server code; use Web Crypto for hashing |

### 3.4 AI Factory boundary: real interfaces with simulated adapters (DESIGN DECISION)

THREAD must not rebuild the AI Factory (Part 13.1). Define each integration as a TypeScript interface in `src/server/adapters/<name>/contract.ts`, with two implementations: `simulated.ts` (deterministic, seeded) and `live.ts` (a real HTTP client, enabled when its secret exists). The adapter in use is chosen per environment through the `adapter_bindings` table.

**NON-NEGOTIABLE (Lovable adaptation):** every object or evidence record produced through a simulated adapter carries `body.provenance.simulated = true` and the ledger entry `adapter_mode = 'simulated'`. Simulated evidence can never count toward authority promotion, exposure authorisation, or any value measure. A test asserts this.

| Adapter | Contract (core methods) |
|---|---|
| `ModelGateway` | `complete({route, messages, schema?, purpose, data_classification}) → {output, model, model_version, route_id, tokens, cost, latency_ms}` ; `embed({texts, classification})` |
| `Transcription` | `startStream(sessionId, consentIds) → streamId` ; `pushAudio(streamId, chunk)` ; `onSegment(cb: {speaker_id, t_start, t_end, text, confidence})` ; `finalize(streamId)` |
| `BuildPlatform` (×5: lovable, claude_code, codex, cursor, grok) | `dispatch({prompt_id, compiled_prompt, repro_key, cost_ceiling}) → {external_run_id}` ; `status(id)` ; `fetchArtifacts(id) → [{kind, uri, hash}]` ; webhook `/api/public/hooks/build/:platform` verified by HMAC |
| `CICD` | `getPipelineRun(ref)`, `getTestResults(ref)`, `getScanResults(ref)` |
| `Telemetry` | `subscribe(capability_id, filters)` ; shadow tap `tap({read_only:true})` ; `metrics(query)` |
| `FeatureFlags` | `setExposure(capability_id, population_pct, segments)` ; `killSwitch(capability_id) → {stopped_at}` |
| `IdentityProvider` | `resolveActor(token) → Actor` ; `attributes(actorId)` |
| `ContentClassifier` | `classify(text) → {tier, phi:bool, pan:bool, spans}`. The simulated version uses deterministic regex and Luhn rules, and PHI/PAN hard blocks apply in every mode |

---

## 4. Object model

Implement **exactly** the schemas in Layer B Part 4: the universal envelope (4.1), the ConfidenceBundle (4.1.1), the relationship verbs (4.2), the Object Type Registry with every family (4.3), lifecycle states (4.4) and graph integrity rules (4.5). Also implement the framing-session types from Part 8A.4 (`FramingSession`, `CoCreationArtifact`, `ExtractedStatement`, `NeedStatement`, `DependencyProposal`, and the others listed there). Do not invent parallel structures.

**Depth priority (Part 25.2).** Build these first and in full detail, with Zod schemas in `src/domain/types/` and per-type JSON Schema stored in `object_type_registry.body_schema`: envelope, `ConfidenceBundle`, `ValueSignal`, `ValueMission`, `BehaviorStatement`, `ExecutableOutcomeContract`, `CreationPrompt`, `BuildRun`, `ExposureAuthorization`, `ValueMeasure`, `Rendition`, `Detector`.

**Lifecycle state machines** are defined in `src/domain/lifecycle.ts` as data (family → allowed transitions) and mirrored in the DB function `assert_transition(type, from, to)`, which is called by a BEFORE UPDATE trigger. Transitions not in Part 4.4 are rejected.

**`ConfidenceBundle.overall`** must be computed by a published, versioned rule (`confidence_rules` table, pure function `computeOverall(bundle, ruleVersion)`). It is never learned and never model-generated. The rule version is stored with every computation.

**Human references** (`human_ref`, e.g. `VS-2026-0417`) come from a per-type prefix and a per-year sequence (`ref_sequences`). `id` is a UUIDv7, never reused and never renumbered.

**Legacy alias registry:** the `legacy_aliases(alias, source_system, object_id)` table is a migration aid only. It has no status column.

---

## 5. Authority and guardrail engine (K3)

Implement Layer B Part 6 as a **pure, deterministic TypeScript module** `src/server/authority/engine.ts` with no I/O and no model calls inside the decision. The same module runs in server functions and in tests.

- `assessRisk(object, context) → {tier:1..4, reasons[]}` per Part 6.1.
- `evaluateAuthority({actor, action, object, bundle, consequence_class, guardrail_results}) → {decision: 'proceed'|'proceed_with_confirmation'|'escalate_human_decision'|'block', rule_ids[], explanation}`, using the decision pattern in Part 6.4. Every evaluation writes a `PolicyEvaluation` object and a ledger entry.
- **Authority ladder (Part 6.2):** `observe → recommend → act_with_confirmation → act_bounded → autonomous_with_exception`. Promotion is automatic when the evidence thresholds are met (only non-simulated evidence counts). Demotion is automatic on every trigger listed in Part 6.2. Both are written to `authority_history`.
- **Guardrails-as-code (Part 6.6):** the `guardrails` table stores versioned rules (`category`, `evaluator` key, `params jsonb`). The evaluators are registered TS functions. The six source categories map to evaluators exactly as in the Part 6.6 table.
- **Prohibited conditions (Part 6.7):** checked before everything else. They return `block` regardless of confidence or authority.
- **Human Decision Queue (Part 6.5):** `HumanDecisionRequest` carries exactly the fields in Part 6.5. Governance acts as escalation (Part 6.8): `escalate_to_council` produces a recorded decision, never an approval state.
- **Content tiers:** PHI/PAN detection by `ContentClassifier` is a hard block on capture persistence, extraction, prompt compilation and renditions.

---

## 6. Framing sessions and the co-creation extraction pipeline (Part 8A)

Implement Layer B Part 8A in full, including 8A.1–8A.15. Lovable specifics:

- **Consent first.** A `FramingSession` cannot move to `capturing` until a `ConsentRecord` exists for every participant and every modality (Part 8A.13, P13). This is enforced by a trigger.
- **Capture.** Audio goes through the `Transcription` adapter. Typed chat, uploaded artifacts (whiteboard images, documents, prototype screenshots) and pasted text go to the `artifacts` bucket as `CoCreationArtifact`s on one **common session timeline** (`session_events(session_id, t_offset_ms, kind, ref)`).
- **Segmentation and classification.** Each segment becomes an `ExtractedStatement` with the **six-way classification** from Part 8A.5, made **speaker-authority-aware**: a statement from a participant without decision authority for the domain can never be classified as a decision. It is classified as a suggestion, and the mismatch is surfaced. Classification uses `ModelGateway.complete` with a strict JSON schema, then deterministic post-rules.
- **Typed extraction with mandatory provenance spans.** Every extracted object stores `provenance_spans[] = {artifact_id|segment_id, start, end, speaker_id}`. A CHECK constraint rejects an empty spans array. Everything enters in **draft** state.
- **Draft vs confirmed.** Draft objects cannot reach creation: `compile_creation_prompt` rejects any source whose state is draft, and a DB constraint does the same. Material items need confirmation by the actor with authority (Part 8A.10). Confirmation is a recorded decision, not an approval queue.
- **Re-extraction safety.** Re-running with a changed extractor version never overwrites a confirmed object. It creates proposals linked by `supersedes` candidates, and every prior confirmation is preserved.
- **Connection (Part 8A.7).** Dependency derivation follows the relationship-source confidence ordering in 8A.7 and produces `DependencyProposal`s.
- **Live surfacing.** While a session runs, look up contradictions with prior confirmed objects, related prior objects (vector search) and reusable capabilities, within the latency budgets in Part 8A.13. Push results with Supabase Realtime.
- **Views (Part 8A.8):** Need Web, Dependency Web, Decomposition Tree, Contradiction Map, Unresolved Frontier, and the other two views named in 8A.8. Render them with a WebGL graph library (for example `@cosmograph/cosmos` or `sigma.js`) loaded client-only (lazy import behind `ClientOnly`).
- **Framing session surface (Part 8A.9):** the live extraction pane with one-click re-classification, the timeline, the entry test tracker, and the confirmation panel.
- **MCP tools (Part 8A.11)** and **the sixteen detectors (Part 8A.12):** implement all of them, named exactly as in the source.
- **Quality publication:** extraction precision and recall are computed per classification and per object type against a labelled set (`extraction_eval_items`) and published as a generated rendition.

---

## 7. Evidence graph (K2)

Implement Layer B Part 5: the eight-link chain (5.1), the creation rule and enforcement of each link (5.2), the nine `explain_capability` questions (5.3: authority, decision, evidence, version, tests, exposure, outcome, value, justification), and the ten traceability queries (5.4). Each query is a SQL function (`trace_*`) with an index plan that meets the Part 16.4 budgets, exposed both as an MCP tool and as an Evidence Graph view panel. `chain_completeness(capability_id)` returns the missing links. A capability with no `ConfirmedDecision` ancestor cannot reach creation; this is enforced in `compile_creation_prompt`.

---

## 8. Capability Fabric

Implement Layer B Part 7: the capability contract (7.2), the required characteristics (7.3), intent-shaped discovery (7.4, vector + FTS + contract-shape match), and the **reuse-first gate as a hard block** (the `ReuseCheck` record with `intent_shape`, results and decision, exactly as in the 7.4 schema). Also implement composition with effective-authority inheritance (7.5) and lifecycle/retirement with review dates, minimum-use thresholds, cost ceilings, expiry and automated retirement that keeps data and audit continuity (7.6).

---

## 9. Creation loop

Implement Layer B Part 8. `compile_creation_prompt` builds a `CreationPrompt` **only** from typed fields of confirmed `BehaviorStatement`s, the `ExecutableOutcomeContract`, the referenced `PromptTemplate` (versioned, eval-gated), guardrail refs and capability refs. A unit test feeds raw transcript text into the source objects and asserts that it is absent from the compiled output (Part 13.4). Each `BuildRun` stores the **reproducibility key** (prompt version + platform + model route + model version + guardrail set version + template version), its artifacts, its cost against the ceiling (enforced at dispatch, Part 13.5), and its iteration classification (Part 8.5) with the scope-change detector. Dispatch goes through the `BuildPlatform` adapter for all five platforms. Replays either reproduce an equivalent artifact or are honestly marked `best_effort`.

---

## 10. Generation layer (K4)

Implement Layer B Part 10. Each `Rendition` row stores `generated_from[] (object id + version + content_hash)`, `generated_at`, `generator {model, route, template_version}`, `permission_context {actor, purpose}`, `expires_at`, `state live|stale|deleted`, and the visible marker "Generated from canon. Not canon." When a source's `content_hash` changes, every dependent rendition is marked `stale` (via trigger plus queue). Deletion is scheduled. Generated guidance without canon citations cannot be produced (the generator rejects output whose citation list is empty). Prohibited-inference renditions are refused. The **morning intelligence brief** (Part 10.4) is a scheduled rendition generated per user.

---

## 11. MCP surface (K5)

Implement Layer B Part 12. That means the **twelve ValueOS tools with exactly these names**: `detect_value_signal`, `score_value_signal`, `find_related_missions`, `create_value_mission`, `recommend_value_cell`, `start_value_burst`, `search_capability_fabric`, `run_adversarial_simulation`, `request_exposure_authority`, `monitor_outcome_evidence`, `publish_reusable_capability`, `detect_legacy_behavior`. Add the full extended set listed in Part 12.2 and the Part 8A.11 tools.

- Each tool has a `ToolContract` (Part 12.3) stored in `tool_contracts` and generated from the same Zod schema used by the server function, so the human API and the agent API share one implementation.
- Resources, prompts and notifications (Part 12.4) are filtered by permission. A2A agent cards are served at `/api/public/a2a/.well-known/agent.json` (Part 12.5).
- Every call is wrapped in provenance (agent id, authority used, input hash, output hash) and checked against quotas and cost caps.
- **Injection defence layers 1–5 (Part 12.6):** captured or retrieved text is treated as data and never as instructions. Tool outputs carry content-origin tags. High-consequence tools require a structured confirmation token produced by K3, never one inferred from text.

---

## 12. Surfaces

Implement every surface in Layer B Part 11 (11.1–11.12) and the framing session surface (8A.9), following the design language in Part 18. Routes (TanStack file routes, all under `_authenticated`):

| Surface | Route |
|---|---|
| Value Companion (11.1) | `/companion` (a docked panel available on every route) |
| Value Mission Runtime (11.2) | `/missions/$missionId` |
| Operating Graph Explorer (11.3: Nebula, Focus, Path, Impact) | `/graph` |
| Evidence Graph view (11.4) | `/evidence/$capabilityId` |
| Human Decision Queue (11.5) | `/decisions` |
| Live Enterprise Value Feed (11.6) | `/` (home is the Feed, so the first screen is a place to act) |
| Capability Fabric / Marketplace (11.7) | `/fabric` |
| Semantic capture console (11.8) | `/capture` |
| Detector surface (11.9) | `/detectors` |
| Simulation Studio (11.10) | `/simulate` |
| Canon stewardship console (11.11) | `/canon` |
| MCP gateway surface (11.12) | `/agents` |
| Framing session (8A.9) | `/sessions/$sessionId` |

Surface rules: every screen leads with an **action**. The Mission Runtime is generated around the current decision and contains no backlog, story, sprint, task list or status report. The Feed's primary action is reuse-or-remix and it has no engagement mechanics (no likes, streaks or follower counts). Every generated panel shows the canon-vs-generated marker. Accessibility follows WCAG 2.2 AA (Part 18.3). There is no light/dark toggle unless Part 18 asks for one. Use semantic design tokens in `src/styles.css` only.

---

## 13. Compliance, consent and surveillance boundaries

Implement Layer B Part 14 (14.1–14.7): inherit Factory controls instead of reinventing them, the regulatory mapping (GDPR, HIPAA, SOC 2), the **prohibited inferences (14.3)**, consent records, retention, deletion and tombstones (14.5, with tombstones that keep the provenance chain intact), and the assurance requirements (14.6). The "honest limitation" statement from Part 14.7 must be shown in the product where the source says to show it. Row-level security is enabled on every table. Restricted-classification content is stored only in tables with stricter policies.

---

## 14. Measurement

Implement Layer B Part 15. The primary measure (15.1) and the four measure families (15.2) are computed from the graph, never entered by hand. Intent-to-value time is computed by `get_intent_to_value_time`. **PROHIBITED:** the rejected measures (15.3) must be absent from the schema, the API and the UI. Test AW-4 scans `information_schema`, the OpenAPI/tool output schemas and the rendered UI text, and a live detector flags rejected-measure language in human input. Reporting rules follow Part 15.4.

---

## 15. Non-functional requirements

Implement Layer B Parts 16.3–16.5 and 19 exactly, including every performance budget, the scale assumptions (validated in the pilot), the Nebula rendering strategy (20,000 nodes interactive, honest edge budgets), security, auditability and accessibility. On the edge runtime, any query that cannot meet its budget must be pre-computed into a materialised table refreshed by an event or schedule. Record each such case as a DESIGN DECISION in `AGENTS.md`.

---

## 16. Build sequence: capability slices with evidence-based exit gates

**NON-NEGOTIABLE (Part 20):** this is a sequence of capability slices with evidence-based exit gates, not a phased project plan. It has no dates and no milestones. A slice ends when its exit evidence exists. The slices and their exit evidence are exactly as in Layer B Part 20. Run them in this order on Lovable:

1. **Phase 1, Canon and envelope.** Enable Lovable Cloud, create the core DDL (Section 18), the ledger hash chain, tombstoning, the lifecycle triggers and the type registry seed. *Exit evidence: Part 20 Phase 1, plus a test proving a provenance gap cannot be created.*
2. **Phase 2, Operating Graph core**, including the Explorer views.
3. **Phase 2B, Framing session capture and extraction** (Part 8A), using the simulated `Transcription` adapter, with real model classification through `ModelGateway`.
4. **Phase 3, Authority, guardrails and decisions.**
5. **Phase 4, Capability Fabric.**
6. **Phase 5, Evidence graph.**
7. **Phase 6, Creation loop and platform integration** (five `BuildPlatform` adapters, simulated until credentials exist).
8. **Phase 7, Shadow, exposure and production outcome** (`Telemetry` and `FeatureFlags` adapters).
9. **Phase 8, Generation layer.**
10. **Phase 9, Agent-executable surface** (MCP endpoint, all tools).
11. **Phase 10, Detection and measurement** (the 15 ValueOS failure-mode detectors, the THREAD-specific detectors and the 16 framing detectors).
12. **Phase 11, Human surfaces** (built partly in parallel from Phase 2).
13. **Phase 12, Hardening, assurance and scale.**

**Dogfooding (Part 21, NON-NEGOTIABLE):** from Phase 2B onward, THREAD's own build is recorded inside THREAD as signals, a mission, a cell, bursts, behaviour statements, prompts, runs and evidence.

**Exit evidence that depends on real external systems** (live builds on five platforms, a real framing session, a penetration test, DR timing) is recorded as `pending_live_adapter` with the simulated evidence attached. It counts as met only when the live adapter produces it. List these items to the user at the end of each slice.

---

## 17. Test and assurance strategy

Use Vitest for unit, domain and DB tests (against a test schema), and Playwright for surface tests. Implement every category in Layer B Part 21.1, the authority test matrix (21.2: risk × confidence × consequence), verification independence (21.3: the test generator and the code generator must be different model routes, and this is recorded), and operating-model tests (21.5).

**Anti-wiki / anti-legacy acceptance suite (Part 21.4), all 15 tests, IDs AW-1 to AW-15.** Every release must pass them, and a regression is a release blocker:

| ID | Test | Implementation |
|---|---|---|
| AW-1 | No document object type | Registry and `information_schema` scan |
| AW-2 | No approval state | Scan of all enums, lifecycle definitions and rendered UI text for approval, sign-off, gate, pending-review or awaiting |
| AW-3 | No backlog, story, sprint or task list | Schema + UI text scan; Playwright screenshot of Mission Runtime with OCR check |
| AW-4 | No rejected measure | Schema + API response + UI scan for all eleven rejected measures (Part 15.3) |
| AW-5 | Action ratio | **OPEN, see Appendix B.** Telemetry computes `% sessions with ≥1 graph-mutating action` and `% read-only sessions`. Thresholds are read from canon setting `anti_wiki.action_ratio` |
| AW-6 | No awareness notifications | Every notification row has a non-null `trigger_event_id` or `decision_id` |
| AW-7 | Reuse gate enforced | Insert a `CreationPrompt` without a `ReuseCheck` → rejected by the DB |
| AW-8 | Citations mandatory | The generator refuses uncited guidance |
| AW-9 | Surveillance refusal | Request an individual activity metric rendition → refused |
| AW-10 | Canon supremacy | No code path or trigger writes from `renditions` to `objects`; static import-graph check plus DB test |
| AW-11 | Orphan-free | Orphan-rate metric with an owner; zero orphans among non-draft objects |
| AW-12 | Expiration everywhere | Every live object has `review_date` and `expiration_condition` |
| AW-13 | Executability | Every core verb in Part 12 is invocable through MCP in the test harness |
| AW-14 | Compression realised | Intent-to-first-evidence time is measured and published as a rendition |
| AW-15 | No document prepared for handoff | `DocumentPreparedForHandoff` detector has zero unaddressed findings above threshold |

Also required: one test per principle P1–P15, one test per lifecycle transition rule, one test per detector (induce the failure, then assert a finding with an owner), PHI/PAN recall measured on a labelled corpus, and a test that simulated evidence never promotes authority.

---

## 18. Data model (Postgres DDL, Lovable Cloud)

The following is the core DDL. Every `public` table must get `GRANT`s, then `ENABLE ROW LEVEL SECURITY`, then policies, in the same migration. Type-specific bodies are validated in the server layer against `object_type_registry.body_schema`, and the critical invariants are also enforced by triggers.

```sql
create extension if not exists vector;
create extension if not exists pg_trgm;

create type risk_tier as enum ('1','2','3','4');
create type authority_level as enum ('observe','recommend','act_with_confirmation','act_bounded','autonomous_with_exception');
create type consequence_class as enum ('none','reversible','costly_reversible','irreversible','rights_affecting','safety','lifeline');
create type data_classification as enum ('public','internal','confidential','restricted','prohibited');
create type actor_kind as enum ('human','agent','system');

-- Registry (4.3)
create table public.object_type_registry (
  type text primary key,                    -- e.g. 'ValueSignal'
  family text not null,                     -- Canon | ValueFlow | Intent | Creation | Evidence | Authority | Fabric | Framing | Detection | Generation
  ref_prefix text not null unique,          -- 'VS','VM','BS',...
  lifecycle_family text not null,           -- key into lifecycle_transitions
  body_schema jsonb not null,
  discovery_descriptor jsonb not null,      -- P5
  schema_version text not null
);

create table public.lifecycle_transitions (
  lifecycle_family text not null, from_state text not null, to_state text not null,
  primary key (lifecycle_family, from_state, to_state),
  constraint no_approval_states check (
    to_state !~* '(approv|sign.?off|pending.?review|submitted.?for.?review|awaiting|qa.?phase|gate)')
);

-- Universal envelope (4.1)
create table public.objects (
  id uuid primary key,                       -- uuidv7, never reused
  human_ref text not null unique,
  type text not null references public.object_type_registry(type),
  schema_version text not null,
  title text not null,
  statement text not null,
  body jsonb not null default '{}',
  machine_description text not null,
  version int not null default 1,
  supersedes uuid[] not null default '{}',
  superseded_by uuid[] not null default '{}',
  derived_from uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by jsonb not null,                 -- Actor {kind,id,authority_used}
  updated_at timestamptz not null default now(),
  updated_by jsonb not null,
  lifecycle_state text not null,
  effective_from timestamptz not null default now(),
  review_date date not null,                 -- P4
  expiration_condition jsonb not null,       -- P4, machine-evaluable
  expires_at timestamptz,
  retired_at timestamptz,
  retirement_reason text,
  retirement_path jsonb not null,            -- P4
  owner_id uuid not null,
  co_creator_id uuid, builder_id uuid, steward_id uuid,
  risk_tier risk_tier not null,
  authority_level authority_level not null default 'observe',
  confidence_bundle jsonb,                   -- P2: separate from authority
  consequence_class consequence_class not null default 'none',
  permission jsonb not null,                 -- PermissionSpec
  data_classification data_classification not null,
  permitted_uses text[] not null default '{}',
  evidence_refs uuid[] not null default '{}',
  citations jsonb not null default '[]',
  open_questions uuid[] not null default '{}',
  content_hash text not null,
  provenance_chain_id uuid not null,         -- P9
  is_tombstone boolean not null default false,
  search tsvector generated always as (to_tsvector('english', coalesce(title,'')||' '||coalesce(statement,''))) stored
);
create index on public.objects using gin (search);
create index on public.objects (type, lifecycle_state);
create index on public.objects using gin (human_ref gin_trgm_ops);

create table public.object_versions (like public.objects including defaults);  -- full immutable snapshot per version (no unique/generated copies)
alter table public.object_versions add primary key (id, version);

-- Typed edges (4.2)
create table public.relationship_verbs (
  verb text primary key, from_types text[] not null, to_types text[] not null, directed boolean not null default true
);
create table public.edges (
  id uuid primary key,
  verb text not null references public.relationship_verbs(verb),
  from_id uuid not null references public.objects(id),
  to_id uuid not null references public.objects(id),
  confidence numeric check (confidence between 0 and 1),
  source text not null,                      -- 8A.7 relationship source (explicit|confirmed|derived|proposed...)
  authority_used authority_level not null,
  evidence_refs uuid[] not null default '{}',
  created_by jsonb not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);
create index on public.edges (from_id, verb); create index on public.edges (to_id, verb);

-- Append-only hash-chained ledger (P9, 16.1)
create table public.ledger (
  seq bigserial primary key,
  provenance_chain_id uuid not null,
  occurred_at timestamptz not null default now(),
  actor jsonb not null, authority_used authority_level,
  action text not null, object_id uuid, object_version int,
  evidence_refs uuid[] not null default '{}',
  adapter_mode text not null default 'none' check (adapter_mode in ('none','simulated','live')),
  payload jsonb not null,
  prev_hash text not null, hash text not null unique
);
-- grants: INSERT/SELECT only. UPDATE and DELETE are revoked from every role, including service_role writes through API

-- Authority & confidence histories (P2)
create table public.confidence_rules (version text primary key, definition jsonb not null, published_at timestamptz not null);
create table public.authority_history (id bigserial primary key, object_id uuid not null references public.objects(id),
  from_level authority_level, to_level authority_level not null, cause text not null check (cause in ('promotion','demotion','grant','withdrawal')),
  trigger_ref uuid, evidence_refs uuid[] not null, at timestamptz not null default now());
create table public.confidence_history (id bigserial primary key, object_id uuid not null references public.objects(id),
  bundle jsonb not null, overall numeric not null, rule_version text not null references public.confidence_rules(version),
  computed_by text not null, at timestamptz not null default now());

-- Reuse-first gate (P11, 7.4)
create table public.reuse_checks (
  id uuid primary key, intent_shape jsonb not null, query_text text not null,
  results jsonb not null, decision text not null check (decision in ('reuse','compose','extend','create_new_no_match')),
  rationale text not null, checked_by jsonb not null, checked_at timestamptz not null default now());
create table public.creation_prompts (
  object_id uuid primary key references public.objects(id),
  reuse_check_id uuid not null references public.reuse_checks(id),       -- hard block
  source_behavior_ids uuid[] not null check (cardinality(source_behavior_ids) > 0),
  template_id uuid not null, template_version text not null,
  compiled_text text not null, compiled_hash text not null);
create table public.build_runs (
  object_id uuid primary key references public.objects(id),
  prompt_id uuid not null references public.creation_prompts(object_id),
  platform text not null check (platform in ('lovable','claude_code','codex','cursor','grok')),
  repro_key jsonb not null,          -- prompt_version, platform, model_route, model_version, guardrail_set_version, template_version
  external_run_id text, cost_ceiling numeric not null, cost_actual numeric,
  replay_mode text check (replay_mode in ('deterministic','best_effort')),
  adapter_mode text not null check (adapter_mode in ('simulated','live')));

-- Generation layer (K4, P1)
create table public.renditions (
  id uuid primary key, kind text not null,
  generated_from jsonb not null check (jsonb_array_length(generated_from) > 0), -- [{id,version,content_hash}]
  citations jsonb not null check (jsonb_array_length(citations) > 0),           -- AW-8
  generator jsonb not null, permission_context jsonb not null,
  generated_at timestamptz not null default now(), expires_at timestamptz not null,
  state text not null default 'live' check (state in ('live','stale','deleted')),
  storage_path text, body jsonb);

-- Semantic discovery (16.1)
create table public.object_embeddings (object_id uuid primary key references public.objects(id), embedding vector(1536) not null, model text not null);
create table public.object_embeddings_restricted (object_id uuid primary key references public.objects(id), embedding vector(1536) not null, model text not null); -- separate RLS, never merged

-- Framing (8A) capture tables
create table public.consent_records (id uuid primary key, session_id uuid not null, participant_id uuid not null,
  modalities text[] not null, granted_at timestamptz not null, withdrawn_at timestamptz);
create table public.session_events (id bigserial primary key, session_id uuid not null, t_offset_ms bigint not null,
  kind text not null, speaker_id uuid, ref uuid, payload jsonb not null);
create table public.extraction_spans (object_id uuid not null references public.objects(id), source_ref uuid not null,
  start_ms bigint, end_ms bigint, char_start int, char_end int, speaker_id uuid);
-- trigger: an Extracted*/Framing-derived object cannot leave 'draft' unless it has >=1 extraction_spans row

-- Detectors, decisions, agents, adapters, alias, settings
create table public.detectors (key text primary key, family text not null, owner_id uuid not null, schedule text, event_triggers text[], params jsonb not null, version text not null);
create table public.detector_findings (id uuid primary key, detector_key text not null references public.detectors(key), object_id uuid,
  severity text not null, owner_id uuid not null, state text not null check (state in ('open','resolved','accepted_risk')),
  accepted_by uuid, accepted_until timestamptz, evidence jsonb not null, created_at timestamptz not null default now());
create table public.agents (id uuid primary key, name text not null, token_hash text not null, authority_ceiling authority_level not null,
  quota jsonb not null, cost_cap numeric not null, a2a_card jsonb);
create table public.tool_contracts (name text primary key, contract jsonb not null, version text not null);
create table public.adapter_bindings (adapter text not null, environment text not null, mode text not null check (mode in ('simulated','live')), primary key(adapter, environment));
create table public.legacy_aliases (alias text not null, source_system text not null, object_id uuid not null references public.objects(id), primary key(alias, source_system));
create table public.canon_settings (key text primary key, value jsonb, status text not null check (status in ('set','open')), decided_by uuid, decision_id uuid);
create table public.guardrails (id uuid primary key, category text not null, evaluator text not null, params jsonb not null, version text not null, active boolean not null default true);
create table public.ref_sequences (prefix text not null, year int not null, next int not null, primary key(prefix, year));
create table public.notifications (id uuid primary key, recipient_id uuid not null, trigger_event_id bigint, decision_id uuid,
  body jsonb not null, created_at timestamptz not null default now(),
  constraint decision_or_event check (trigger_event_id is not null or decision_id is not null)); -- AW-6
create table public.usage_sessions (id uuid primary key, actor_id uuid not null, started_at timestamptz not null, ended_at timestamptz,
  mutating_actions int not null default 0, reads int not null default 0);  -- AW-5; aggregate-only renditions, never individual (14.3)

-- Roles (separate table, never on profile)
create type app_role as enum ('steward','co_creator','builder','member','compliance');
create table public.user_roles (user_id uuid not null references auth.users(id) on delete cascade, role app_role not null, primary key (user_id, role));
create or replace function public.has_role(_uid uuid, _role app_role) returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _uid and role = _role) $$;
```

Graph functions to implement in SQL (recursive CTEs with depth caps): `graph_traverse(root uuid, verbs text[], depth int)`, `graph_paths(a uuid, b uuid, max_depth int)`, `graph_closure(root uuid, verb text)`, `graph_cycles(verbs text[])`, `graph_orphans()`, `blast_radius(id uuid)`, `trace_chain(capability uuid)`, `chain_completeness(capability uuid)`, and the ten `trace_*` queries of Part 5.4.

Required triggers: `assert_transition`, `enforce_provenance` (rejects writes without a ledger entry in the same transaction), `ledger_hash`, `snapshot_version`, `rendition_stale_on_source_change`, `consent_gate`, `draft_cannot_reach_creation`, `simulated_cannot_promote`, `phi_pan_block`.

---

## 19. API surface

Human surfaces use TanStack `createServerFn` functions with `requireSupabaseAuth` middleware. Agents use MCP at `/api/public/mcp` (bearer agent token, verified inside the handler). External webhooks use `/api/public/hooks/*` (HMAC-verified). One Zod schema per operation drives both surfaces, and the `ToolContract` is generated from that schema.

```ts
// Operating Graph
getObject({ id | human_ref, version? }) -> Envelope
searchGraph({ q, types?, states?, limit }) -> Envelope[]
traverseGraph({ root, verbs?, depth }) -> { nodes, edges, truncated, edge_budget }
proposeCanonChange({ object_id, patch, evidence_refs, rationale }) -> { change_id, challenge_window_ends }
challengeCanon({ object_id, argument, evidence_refs }) -> ChallengeRef

// Value flow
detectValueSignal({ observed_condition, evidence_refs, requested_solution_candidates? }) -> ValueSignal
scoreValueSignal({ signal_id }) -> { magnitude, urgency, value, confidence_bundle }
createValueMission({ signal_id, co_creator_id, outcome, bounds:{evidence,time,risk,authority} }) -> ValueMission
recommendValueCell({ mission_id }) -> { co_creator, builder, agents[] }
startValueBurst({ cell_id, phases }) -> ValueBurst

// Framing (8A)
startFramingSession({ burst_id, participants[], modalities[] }) -> FramingSession   // blocked until consent
recordConsent({ session_id, participant_id, modalities[] }) -> ConsentRecord
ingestArtifact({ session_id, kind, storage_path | text }) -> CoCreationArtifact
reclassifyStatement({ statement_id, classification, reason }) -> ExtractedStatement
confirmMaterialItems({ session_id, item_ids[] }) -> ConfirmedDecision            // authority-checked
reextractSession({ session_id, extractor_version }) -> { proposals[], preserved_confirmations }

// Intent
addBehaviorStatement({ mission_id, condition, observable_result, operating_constraints, provenance_spans }) -> BehaviorStatement
confirmBehaviorStatement({ id }) -> BehaviorStatement
recordDecision({ question, decision, decided_by, evidence_refs }) -> ConfirmedDecision

// Fabric
searchCapabilityFabric({ intent_shape:{outcome,inputs,outputs,domain} }) -> { results[], reuse_check_id }
publishReusableCapability({ capability_id, contract }) -> ComposableCapability
composeCapabilities({ ids[] }) -> { composition_id, effective_authority }

// Creation loop
compileCreationPrompt({ behavior_ids[], contract_id, template_id, reuse_check_id }) -> CreationPrompt
dispatchBuild({ prompt_id, platform, cost_ceiling }) -> BuildRun
recordIteration({ run_id, diff_ref }) -> { classification, scope_change_flag }

// Authority
evaluateAuthority({ action, object_id }) -> { decision, rule_ids, explanation }
requestExposureAuthority({ capability_id, population, segments }) -> ExposureAuthorization | HumanDecisionRequest
requestHumanDecision({ ... exactly Part 6.5 fields }) -> HumanDecisionRequest
withdrawAuthority({ object_id, reason, evidence_refs }) -> AuthorityChange

// Evidence & measurement
explainCapability({ capability_id, question: 'authority'|'decision'|'evidence'|'version'|'tests'|'exposure'|'outcome'|'value'|'justification' }) -> Answer & {citations}
monitorOutcomeEvidence({ capability_id, window }) -> { outcomes[], value_measures[] }
getIntentToValueTime({ mission_id | capability_id }) -> { hours, path[] }
detectLegacyBehavior({ text | object_id }) -> DetectorFinding[]

// Generation
generateBriefing({ for_actor, purpose }) -> Rendition       // refuses prohibited inferences
```

Error model: `{ code: 'BLOCKED_PROHIBITED'|'REUSE_CHECK_REQUIRED'|'DRAFT_NOT_CREATABLE'|'CONSENT_REQUIRED'|'AUTHORITY_INSUFFICIENT'|'PHI_PAN_BLOCK'|'PROVENANCE_REQUIRED'|'UNCITED_GENERATION', rule_ids[], explanation }`.

---

## Appendix A: Verbatim index of NON-NEGOTIABLE and PROHIBITED statements

Each entry below is quoted from the source and binds the build. The location shows the nearest section heading.

**A1. [1.3.9]**

```text
1.3.9 What ValueOS must not become (verbatim list — treat as PROHIBITED)
Another intranet · a large searchable wiki · a renamed project-management platform · a static AI playbook · a library of
recorded webinars · a traditional certification program · a chatbot that only answers questions · a social feed optimised for
reactions · a digital-adoption layer filled with pop-ups · a central content team that manually updates everything · surveillance
disguised as behavioural coaching · multiple agents with conflicting definitions · a knowledge base that cannot initiate action.
```

**A2. [1.3.12]**

```text
1.3.12 Measures to reject (verbatim — PROHIBITED in THREAD's schema)
Story points · sprint velocity · requirements completed · features shipped without outcome evidence · lines of code · prompt
count · agent-call count · utilisation as a proxy for value · meetings held · documents produced · training modules completed.
```

**A3. [2.3]**

```text
2.3 THREAD is not (PROHIBITED — absence is testable)
```

**A4. [PART 3]**

```text
These are derived from the ValueOS source and are NON-NEGOTIABLE. Each must be enforced in code and covered by an
acceptance test.
```

**A5. [4.1]**

```text
NON-NEGOTIABLE: every operating object in THREAD carries this envelope. No exceptions, including generated renditions
and evidence objects.
ObjectEnvelope:
 # Identity
 id: string # stable, opaque, never reused, never renumbered
 human_ref: string # display reference, e.g. VS-2026-0417, BM-2026-0031
 type: enum # from the Object Type Registry (4.3)
 schema_version: semver # the schema this object was written against
```

**A6. [4.1.1]**

```text
# Integrity
 content_hash: string
 provenance_chain_id:string # links to the append-only ledger
4.1.1 ConfidenceBundle (replaces any single confidence score)
NON-NEGOTIABLE: confidence is a transparent evidence bundle, never an unexplainable model score.
```

**A7. [4.4]**

```text
NON-NEGOTIABLE: no object type may have a state named or meaning "awaiting approval", "pending sign-off", "submitted
for review" or "in QA phase".
```

**A8. [5.1]**

```text
NON-NEGOTIABLE: THREAD must be able to render and query this chain end to end:
```

**A9. [6.1]**

```text
NON-NEGOTIABLE: Tier is a computed property, stored with its inputs, recomputable, and never manually overridden
downward. Upward override is permitted with a recorded rationale; downward override is PROHIBITED.
```

**A10. [6.2]**

```text
5. Operates continuously; routes only Sustained production performance; discrepancy rate below
 autonomous_with_exception ambiguous or consequential cases to threshold; no critical incidents in period; risk tier ≤ 3; explicit
 humans human grant
NON-NEGOTIABLE demotion rules. Authority decreases automatically, without human action, when any of: discrepancy rate
exceeds threshold; a critical or repeated incident occurs; policy or guardrail changes; the capability version changes materially;
the data distribution shifts beyond bounds; the model route or model version changes; the authority's effective_to passes
without renewal; the steward becomes unassigned; or a value review shows underperformance.
```

**A11. [6.2]**

```text
PROHIBITED: Tier 4 autonomous operation without independently-authorised human judgment on each authorisation, and
without continuous monitoring and an armed kill switch.
```

**A12. [6.3]**

```text
NON-NEGOTIABLE: machine confidence is a transparent evidence bundle connected to the Intent Model, tests, policies,
authority, production behaviour and reversibility. It is not an unexplainable model score. The ConfidenceBundle schema is in
Part 4.1.1. Its overall value is computed by a published, versioned, readable rule — never by a learned model — and the
rule itself is a Rule object in the graph with a steward and history.
```

**A13. [6.4]**

```text
NON-NEGOTIABLE decision matrix:
```

**A14. [6.5]**

```text
The only human wait state in the entire system. PROHIBITED: any other queue, inbox, approval list, sign-off tray, review board
or gate.
```

**A15. [6.5]**

```text
NON-NEGOTIABLE — a decision request contains exactly these fields and nothing more:
```

**A16. [6.6]**

```text
NON-NEGOTIABLE: guardrail evaluation is deterministic where determinable. An LLM may propose a guardrail; only a
deterministic evaluator may enforce one. Advisory and enforcing guardrails are distinct fields and must never be conflated.
```

**A17. [PART 7]**

```text
PROHIBITED: a "pending approval" state anywhere in the model.
 PROHIBITED: any workflow that blocks standard work awaiting a committee.
 The AI Governance Council receives escalations — high-risk, high-impact, novel or ambiguous matters — and returns
 guidance and decisions, not approvals. THREAD records council engagements as ConfirmedDecision objects with
 source: governance_council , and never as gates.
 Routine work inside guardrails must flow without any human touch. A measurable target: ≥80% of consequential
 actions are resolved by the authority engine with no human wait.
PART 7 — The Capability Fabric
```

**A18. [7.3]**

```text
NON-NEGOTIABLE. A published capability must be, and must be testably:
```

**A19. [7.4]**

```text
NON-NEGOTIABLE (P11): no creation may begin until the fabric has been searched and the result recorded.
 ReuseCheck:
 intent_shape: {outcome, inputs, outputs, domain}
 results: [{capability_id, match_score, reuse_mode: use_as_is|compose|extend, gaps[]}]
 decision: reuse_as_is|compose_existing|create_new
 rationale: text
 searched_by: Actor
 searched_at: timestamp
 # create_new requires: results is empty OR every result has recorded gaps,
 # AND a human or agent rationale is present.
```

**A20. [7.6]**

```text
NON-NEGOTIABLE. Every capability receives, at creation: a value hypothesis; a designated owner; a review date; an operating-
cost ceiling; a minimum-use threshold; performance and risk thresholds; an expiration condition; and an automated retirement
path.
```

**A21. [8.2]**

```text
Prompt compiled CreationPrompt , ReuseCheck , Raw captured text is PROHIBITED in the prompt. Guardrails applied
 GuardrailSet ref, PromptTemplate ref are enumerated on the prompt object
```

**A22. [8.3]**

```text
Lovable Vendor SaaS — the only external build NON-NEGOTIABLE: only content classes cleared for external processing;
 platform. Dispatch via its API restricted/prohibited classes must never be routed here. The platform registry
 records this per-platform
```

**A23. [PART 8A]**

```text
NON-NEGOTIABLE: scope changes may not be smuggled through iteration. A detector flags iterations whose diff content
indicates a scope change classified as cosmetic or behavioural.
PART 8A — Framing Sessions and the Co-Creation Extraction
Pipeline
```

**A24. [8A.2]**

```text
NON-NEGOTIABLE. The pipeline must handle every one of these. They arrive simultaneously, in different modalities, and each
carries different evidence weight.
```

**A25. [8A.2]**

```text
Every artifact becomes a CoCreationArtifact object with its own envelope, its content-tier classification, its consent basis,
and its provenance. Artifacts are evidence, not canon. PROHIBITED: treating any artifact as authoritative content in its own
right.
```

**A26. [8A.4]**

```text
NON-NEGOTIABLE. Every extracted object carries: the source CoCreationArtifact id; a provenance span (speaker +
timestamp range, or character range, or a bounding region on a drawing, or an interaction-log offset); the extractor and model
version; a confidence; and a draft state. An extracted object with no provenance span is discarded before it reaches the
graph — not flagged, discarded.
```

**A27. [8A.5]**

```text
NON-NEGOTIABLE — authority-aware classification. The pipeline knows who is speaking and whether that person holds the
authority to make the claim. If a participant without decision authority states a rule as fact, it is logged as a suggestion , not a
decision, and the mismatch is surfaced: "Recorded as a suggestion — the decision authority for this belongs to the Claims
Operations Lead." This is the single most valuable use of speaker-identification, and it prevents the most common failure in
framing sessions: an offhand remark by someone without authority being treated as a requirement.
```

**A28. [8A.5]**

```text
PROHIBITED. Any path by which a context or question unit can become a BehaviorStatement without an explicit
classification change by a human. A detector ( RawSpeechTreatedAsAuthority ) watches for it.
```

**A29. [8A.6]**

```text
NON-NEGOTIABLE — no silent materiality. Where the classifier is uncertain whether a statement is a rule, decision or
consequence, it must ask in the session, not guess and not defer. "That sounds like a rule — should I record it as one?" A single
in-session question is cheaper than a wrong object in the graph forever.
8A.6 Logging — how objects enter the graph
```

**A30. [8A.6]**

```text
FramingSession:
 id, human_ref # FS-2026-0184
 mission_ref # nullable — a session may precede a mission
 co_creator: Actor # required
 builder: Actor # required
 participants: [{actor, role, authority_held: ref}]
 purpose: text
 opened_at, closed_at
 consent_ref: ConsentRecord # NON-NEGOTIABLE: required before capture opens
 content_tier: A|B|C # computed; gates all downstream processing
 artifacts: [CoCreationArtifact]
 extraction_revision: integer
 objects_proposed: count
 objects_confirmed: count
 material_items_awaiting_confirmation: count
 contradictions_surfaced: [DetectorFinding]
 prior_objects_surfaced: [object_id]
 entry_test_result: {completed: bool, sentence: text|null}
```

**A31. [8A.7]**

```text
Draft visibility rule. Draft objects are visible, searchable and traceable immediately — so nothing is lost — but they: cannot
reach creation; cannot be counted in any value or coverage measure; and are rendered with a visible draft marker.
PROHIBITED: any measure that counts draft objects as progress.
8A.7 Connection — how dependencies and relationships are derived
```

**A32. [8A.7.1]**

```text
NON-NEGOTIABLE. Every proposed relationship carries its source, its confidence, and its provenance span, and appears in the
session review queue. Nothing below "explicit statement" is auto-confirmed into canon. A wrongly-auto-linked
dependency silently corrupts every downstream impact analysis, and it is very hard to notice — which makes it the most
dangerous automated action in this part.
```

**A33. [8A.7.4]**

```text
NON-NEGOTIABLE: this surfacing happens live, in the session, not in a report afterwards. A post-session summary is too late
— the decision has already been made out loud.
```

**A34. [8A.9]**

```text
NON-NEGOTIABLE — the tool must show, live, what it is capturing. The Co-Creator must be able to correct the machine's
understanding while the context is alive. This is the show-react-refine loop applied to capture itself, and it is the difference
between a session that produces a trustworthy model and one that produces a transcript.
```

**A35. [8A.9]**

```text
No minutes, no action PROHIBITED. The session produces objects, not a document
 items
```

**A36. [8A.10]**

```text
NON-NEGOTIABLE — material items require explicit human confirmation. Material means: rules, exceptions, non-
negotiable consequences, decisions, and confirmed behaviour. Non-material items (context, suggestions, assumptions,
questions) are logged without blocking.
```

**A37. [8A.10]**

```text
NON-NEGOTIABLE: a session may close with unresolved items, but never with unrecorded unresolved items. Explicit deferral
is a legitimate outcome and is recorded as such; silence is not.
```

**A38. [8A.11]**

```text
Confirmation is captured on the object ( confirmed state, actor, authority used, timestamp) — the same mechanism as any
other ValueOS confirmation. There is no separate sign-off workflow, no approval record, and no gate. PROHIBITED: a session
approval state.
8A.11 New MCP tools
```

**A39. [8A.14]**

```text
F7 Surveillance drift — session Critical Participation analysis is PROHIBITED; no individual activity metrics derived from
 analysis used to evaluate sessions; refusal at generation time; explicit board-level policy
 participants
```

**A40. [10.1]**

```text
NON-NEGOTIABLE (P1). The Operating Graph is the only authority. Every human-facing artifact — explanation, briefing,
interface, diagram, simulation, walkthrough, export, audio, video, role-specific scenario, decision tree — is a rendition,
generated from canon, for a specific person and moment.
```

**A41. [10.4]**

```text
Generated overnight, per Builder, from the graph. Contains only what requires judgment: decisions requiring input,
anomalies, opportunities, and stop recommendations. Not a status report. PROHIBITED: any generated artifact whose
primary content is progress-against-plan, task list, or activity summary.
```

**A42. [PART 11]**

```text
NON-NEGOTIABLE (P15). Canon objects may be changed only through a recorded path: proposed change → evidence →
challenge window (counter-arguments invited; Challenge Agent actively produces them) → decision by the steward under
stated authority → new version with the old version preserved → dependent renditions marked stale → dependent capabilities
notified.
PROHIBITED: silent drift of canonical definitions, authority rules or consequential guardrails. The system must detect and
report canon drift as a live metric.
PART 11 — Surfaces
```

**A43. [PART 11]**

```text
Each surface is a generated interface appropriate to the moment, not a fixed set of permanent screens. NON-NEGOTIABLE for
all surfaces: permission-aware at retrieval (P8); keyboard navigable; WCAG 2.2 AA; no decorative chrome; every number is drill-
through to its evidence.
```

**A44. [11.2]**

```text
PROHIBITED: this surface must not resemble a project-management tool or a backlog with renamed fields. Absence is testable
(Part 21.4).
```

**A45. [11.5]**

```text
Only the fields in Part 6.5. Time-boxed; shows cost of waiting; supports decide, one clarification, reduce authority, or stop.
PROHIBITED: bulk approve.
```

**A46. [11.6]**

```text
PROHIBITED: engagement optimisation, reaction counts, streaks, or any mechanic that rewards visibility over value. A detector
must exist for ValueFeedDriftingTowardEngagement .
```

**A47. [11.10]**

```text
NON-NEGOTIABLE: new-employee onboarding culminates in a real, low-risk Value Mission, not course completion.
PROHIBITED: multiple-choice certification, completion percentages as a measure.
```

**A48. [12.3]**

```text
NON-NEGOTIABLE. Every tool declares, and THREAD enforces:
```

**A49. [12.5]**

```text
NON-NEGOTIABLE: THREAD must support A2A so specialised agents can discover one another and collaborate across
platforms, using open contracts. THREAD's role: register agent identities, capabilities and mandates in the graph; enforce
authority per agent; record every inter-agent interaction in the provenance chain; and prevent multiple agents with
conflicting definitions — one canon, many agents (a named failure mode).
```

**A50. [13.1]**

```text
NON-NEGOTIABLE. The AI Factory already provides unified model access, orchestration, MCP servers, connectors,
observability, CI/CD, and the six capability domains. THREAD consumes those and owns canon, evidence, authority and
generation. Duplicating Factory capability is a named anti-pattern and a design failure.
```

**A51. [13.2]**

```text
Two hard routing gates (NON-NEGOTIABLE):
```

**A52. [13.3]**

```text
NON-NEGOTIABLE. Prompt/response invocation logging must be off for Tier A/B routes, or routed to the same access
controls, retention class and audit as the source object. Debug logging that captures prompts recreates exactly the exposure
the perimeter exists to prevent. This is a named check in Part 21.
```

**A53. [13.4]**

```text
NON-NEGOTIABLE. The CreationPrompt is assembled from typed fields: the confirmed Behaviour Statement, the Executable
Outcome Contract, linked design context (glossary terms, patterns, design tokens, prior capability contracts), the guardrail set,
the prompt template and approved reference examples. Captured transcripts, uploaded documents and tool outputs are never
concatenated into it. Where verbatim content is genuinely required, it enters as a bounded, length-capped, explicitly-quoted
field in a designated non-instruction region, and the template must instruct the model to treat it as untrusted data.
```

**A54. [13.5]**

```text
Per-build, per-mission and per-cell cost ceilings enforced at dispatch.
 A FinOps view aligning to the strategy's cost-optimisation promise: routing efficiency, usage visibility, shadow-AI
 elimination.
 PROHIBITED as measures: prompt count, agent-call count, token volume as a productivity proxy. Cost is measured for
 control, never for performance.
```

**A55. [14.3]**

```text
14.3 Surveillance boundaries — PROHIBITED inferences
```

**A56. [14.3]**

```text
NON-NEGOTIABLE. The system must expose mission evidence while protecting people. THREAD must not:
```

**A57. [15.3]**

```text
15.3 Rejected measures — PROHIBITED
```

**A58. [15.3]**

```text
NON-NEGOTIABLE test: a schema-level test asserts that no field, table, view or API response contains any rejected measure. A
detector flags rejected-measure language. This is one of the tests that proves THREAD has not become a legacy tool (Part 21.5).
```

**A59. [PART 16]**

```text
Every measure is drill-through to the evidence that produced it. A number without evidence is PROHIBITED.
 No manual status reporting. Live evidence replaces status reporting — "anyone with permission can inspect the evidence
 without asking another person for an update."
 Transparency must not become surveillance (Part 14.3).
 Board/Audit Committee reporting is a generated rendition, expiring, sourced from the graph.
PART 16 — Data model and storage
```

**A60. [16.2]**

```text
NON-NEGOTIABLE. There is no "document" object type in THREAD. Content is either an operating object (with envelope,
authority, evidence, expiration), an evidence object, or a rendition (generated, stamped, expiring). A free-floating document is
exactly the legacy artifact ValueOS removes — "a document prepared for a handoff."
```

**A61. [18.1]**

```text
No portal PROHIBITED: hero banners, marketing copy, welcome dashboards, card grids of links, "quick links", news carousels
 aesthetics
```

**A62. [18.3]**

```text
NON-NEGOTIABLE. WCAG 2.2 AA from the first release, not retrofitted. Keyboard navigation for every interaction including
graph traversal; a non-visual equivalent for every graph view (the adjacency and evidence lists are the accessible path); colour-
blind-safe palettes; screen-reader announcements for generated content and for live state changes; reduced-motion support.
```

**A63. [PART 20]**

```text
NON-NEGOTIABLE framing. This is a sequence of capability slices with evidence-based exit gates, not a phased project
plan. Do not convert it into milestones and a schedule in the build prompt. Each phase ends when its exit evidence exists — not
when a date passes.
```

**A64. [PART 21]**

```text
NON-NEGOTIABLE: THREAD must be built the ValueOS way. Dogfooding is a requirement, not a virtue signal. THREAD's
own build runs through the same loop it implements: signals, a mission, a cell, bursts, behaviour statements, prompts, runs,
evidence, shadow, progressive exposure, value measurement. If the build of THREAD cannot be conducted through ValueOS,
then ValueOS does not work and that is the most important possible finding.
```

**A65. [21.3]**

```text
NON-NEGOTIABLE. A model that writes both the capability and its tests produces weak evidence: "all tests pass" becomes
close to a tautology, and a green suite is exactly the evidence that makes reviewers feel safe while proving little.
```


---

## Appendix B: Design decisions and OPEN items

**DESIGN DECISIONS carried from the source (Part 24, may be challenged):** the five-kernel decomposition; service boundaries and storage roles; graph technology; scale estimates; performance budgets; the build-phase sequence including Phase 2B; the "visualization tomorrow" reconciliation with the daily pattern (Part 8.4); the framing pipeline design (object types, six-way classification, the authority-aware rule, the relationship-source ordering, cross-session surfacing and its latency budgets, and the 16 detectors); the seven framing views; the design language (Part 18.1).

**DESIGN DECISIONS added for Lovable:**
1. Postgres tables plus recursive CTEs replace Apache AGE/Neo4j, because AGE is not available on Lovable Cloud.
2. Services are implemented as server modules inside one TanStack Start app, not as separate deployables.
3. Lovable AI Gateway is the default `ModelGateway` implementation, and the MASA Factory gateway is the live target.
4. Every external system sits behind a contract with simulated and live adapters. Simulated evidence never earns authority.
5. Scheduled sweeps run through pg_cron calling protected server routes.
6. The Feed is the home screen.

**OPEN, for Carey Smith (do not resolve in code):**
- **AW-5 action-ratio threshold (Part 21.4, test 5).** The source proposes ≥60% of sessions with at least one graph-mutating action and ≤25% read-only sessions, but this is not confirmed. Implement the detection method in full and store the thresholds in `canon_settings('anti_wiki.action_ratio')` with `status = 'open'` and **no default value**. While the status is open, AW-5 reports the measured ratios and fails with `THRESHOLD_UNSET`. Setting the value is a recorded `ConfirmedDecision` by Carey.

---


---

## Appendix C: Canonical specification, source Parts 1–23 reproduced verbatim (normative, Layer B)

This text was extracted from *THREAD Build Plan Rev 1.1*, keeping the source layout. Part 23 is the canonical glossary: use its terms exactly and do not invent vocabulary. Source Part 0 (instructions for the prompt author), Part 24 (sources) and Part 25 (generation rules) are already applied above and are left out.

```text
PART 1 — Context you must hold

This part makes the document self-contained. It summarises the enterprise, the strategy and the operating model, so that the
build prompt can be generated without access to the original source decks and documents.


1.1 The enterprise

MASA Global ("MASA") is a benefits and membership organisation providing travel and emergency medical services, claims
administration, and related member benefits. It operates with a direct-to-consumer and a group/broker channel. It is preparing
for a future private-equity exit.

The failure that created the mandate. MASA spent approximately two years and $8M on a technology programme and, in
the words of the strategy deck, "delivered nothing. Oh, the one thing we delivered, half-baked Dynamics capabilities, don't
even work — they went into production broken."

This is the reason the operating model, and not merely the technology, is being replaced. Any design that reintroduces the
structures that produced that outcome will be rejected regardless of technical merit.


1.2 The MASA Enterprise AI Strategy — three components

The strategy positions AI not as cost-cutting IT but as a growth, workforce and valuation engine. Its operating model has three
interlocking components.


Component 1 — The AI Factory (the foundational technology ecosystem)
The infrastructure, security, data, connectors, skills and agentic harness on which MASA builds AI-powered initiatives. Explicitly
framed as "Not a pilot or POC. A production-grade environment delivering measurable value at every phase."

Architecture, three layers:

 Layer                     Contents

 Unified Model Access      Frontier and open models behind one governed gateway — ChatGPT, Claude, Gemini, Grok, Perplexity, plus Bring-
                           Your-Own-Model (Qwen, Kimi, DeepSeek). Intelligent routing selects the most cost-effective model per task

 Orchestration &           APIs & SDKs; MCP servers; connectors; data sources (S3, databases); enterprise apps; observability; CI/CD &
 Integration               DevOps

 Governance, Security &    Security & privacy; safety guardrails; monitoring & observability; audit, compliance & policy
 Guardrails


The perimeter rule: "All layers sit inside the MASA-controlled perimeter — models are accessed via API, so proprietary data
never leaves and is never used for training."

Six required technology capability domains (these exist in the Factory — THREAD must integrate with them and must NOT
rebuild them):

 Domain                    Contents (abbreviated as listed in the strategy)

 Co-creation Workspace     Secure meeting transcription; speaker identification; requirements and decision extraction; real-time clarification
                           prompts; shared prototype preview; business-owner approval interface

 AI Development            Agentic coding; repository-aware generation; UI and workflow generation; database and API creation; code
 Environment               explanation; refactoring and migration; automated documentation

 Enterprise Context        Business glossary; policies and standards; reusable domain models; approved reference architectures; design
 Layer                     system; API and integration catalog; data catalog; prior solution patterns

 Testing & Assurance       Requirements-to-test generation; automated execution; traceability; security scanning; dependency validation;
 Layer                     privacy checks; accessibility validation; regression management; AI-output evaluation
 Domain                     Contents (abbreviated as listed in the strategy)

 Deployment &               Version control; controlled environments; CI/CD; feature flags; observability; audit logging; rollback; incident
 Operations Layer           management; production-value telemetry

 Builder Marketplace        Prompts; agents; components; connectors; interfaces; process patterns; test suites; security controls; deployment
                            templates


Reference deployments. AWS: Amazon Bedrock (foundation models, agents, Knowledge Bases/RAG, Guardrails); NVIDIA NIM
inference (SageMaker/EKS/ECS GPU); locally hosted Qwen, Kimi, DeepSeek; MCP Tool Gateway; API Gateway + Lambda/ECS;
Secrets Manager; CloudWatch/CloudTrail; VPC endpoints with no public internet path. Azure: Microsoft Foundry (model
catalog, agents, Prompt Flow, evaluations); NVIDIA NIM on AKS/Azure ML/GPU VMs; locally hosted Qwen, Kimi, DeepSeek;
Azure AI Studio orchestration; Entra ID, Key Vault, Purview; Private Link/VNet isolation.

Claimed outcomes: production-grade environment; data connected via API, MCP, RAG; first AI solutions shipping; Tier 1–4
governance guardrails active; full observability; and "technology is no longer the bottleneck — builders go from idea to
deployed solution in days, not months."


Component 2 — AI Governance (the guardrails)
Governance is explicitly framed as the enabler, not a gatekeeper. Three functions:

 1. Sets AI guardrails — principles and ethical standards; policies, standards and procedures; risk appetite and acceptable use;
    model and data governance standards; human oversight requirements; transparency, fairness and accountability.
 2. Acts as an escalation council, not an approval body — clarifies risk and impact; challenges assumptions; provides
    guidance and direction; recommends actions; communicates decisions, not approvals; enables speed with accountability.
 3. Ensures adherence to policies and controls — security and cybersecurity; privacy and data protection; enterprise risk
    management; legal and contractual obligations; regulatory compliance; audit, monitoring and assurance.

Risk framework: Tier 1 (Low) through Tier 4 (Critical) — the same tiers used inside ValueOS (Part 6).

Compliance posture claim: "Because governance is embedded in the AI Factory, every AI interaction is logged, audited and
policy-enforced — meeting GDPR, HIPAA and SOC 2 requirements with zero custom compliance work."

Reporting: regular updates to the Board / Audit Committee on AI strategy, risks, incidents and KPIs.


Component 3 — The AI Builder Community (where building happens)
A federated, enterprise-wide, cross-silo, self-managed community operating within guardrails. Explicitly not a "team" and not
a "Center of Excellence." No hierarchical structure. Members pick their own tools and AI solutions to leverage, build well-worn
paths, use a marketplace of tools and capabilities, and adhere to the governance model.

Four interlocking layers:

 Layer                 Description

 AI Factory Liaison    Central enablement: architecture, orchestration, LLM infrastructure, governance tooling, shared AI services,
                       observability, AI FinOps. On-demand specialists

 FDE — Dedicated       Full-time AI-native development engineering innovators embedded in business domains — prototyping, workflow
 Builders              development, agent creation, automation, adoption

 Citizen Developers    The force multiplier: business SMEs and product owners from across the enterprise with deep subject-matter expertise,
                       equipped with safe tooling, sandboxes, templates and low-code/no-code AI builders

 FDE — AI Fellows      Young, ambitious, AI-native creators. Recent CS graduates. Rotational cohorts of 12–24 months. Cost-effective capacity,
                       cultural energy, talent pipeline


The community's unit of delivery is the cross-functional Value Cell. The strategy deck lists seven roles that blend into a cell:
business owner, AI builder, data specialist, automation engineer, process SME, citizen developer(s), AI Factory liaison. (Note:
ValueOS later simplifies this to the two-human Value Cell — see Part 2.5 for the reconciliation.)

The Enterprise AI Marketplace is the reuse engine. It holds AI agents, workflows, automations, prompt libraries, APIs and
connectors, skills, templates, knowledge packs, analytics components and decisioning logic. Six standard reusable skill
categories: Copilot AI, Autonomous Agents, Workflow Automation, Decision Intelligence, Voice AI, Knowledge Intelligence.

Culture rituals: monthly AI Demo Days; quarterly hackathons; builder certifications (Explorer → Builder → Architect → Agentic
Specialist → Automation Leader); an AI Innovation Fund.

Five guiding principles of the community: AI is democratised; IT enables and does not gatekeep; reuse before rebuild;
measurable enterprise value; speed over perfection.


1.3 ValueOS — the operating system

ValueOS is the proposed operating system for a Zero-Translation Enterprise: an enterprise in which business intent is
converted directly into measurable, production value without passing through analysts, requirements writers, architects, project
managers, scrum masters, testers, or other translation layers.

Core operating principle (verbatim from the source):

  "Business intent must never be translated, handed off, decomposed into administrative work objects, or reconstructed by
  people who were not part of the original problem."

The operating equation:

  Business Intent → Live Co-Creation → Working Capability → Production Evidence → Measurable Value

The continuous value loop (not a lifecycle):

  Sense → Frame → Compose → Expose → Observe → Improve → Compound

Several elements operate simultaneously. AI continues observing, simulating and preparing while humans are absent.


1.3.1 The Value Cell
The atomic operating unit. Composition: one Business Co-Creator + one AI Builder + an autonomous AI workforce. Two
required human participants.

   Business Co-Creator — the person closest to the business condition, empowered to make the necessary business
   decisions. Contributes domain knowledge, operating context, desired outcomes, rules, exceptions, priorities, tradeoffs,
   consequences, and real-time acceptance. Does not prepare requirements and hand them over. Remains inside the creation
   loop from opportunity through production evidence.
   AI Builder — converts intent into functioning enterprise capability by directing an autonomous AI workforce. Frames the
   problem with the Co-Creator, composes existing capabilities, creates what is missing, recognises weak AI reasoning, makes
   product and technical tradeoffs, controls production exposure, and remains accountable for the coherence, quality, safety
   and value of the creation system.

The autonomous AI workforce — twelve agent functions:

 Agent               Mandate

 Intent Agent        Understand conversation; maintain the Intent Model; distinguish questions, suggestions, assumptions, decisions and
                     confirmed behaviour

 Challenge Agent     Expose contradictions, missing actors, weak evidence, exceptions, unstated consequences

 Creation Agent      Generate experiences, services, rules, data structures, integrations, implementation changes

 Simulation Agent    Create synthetic users, transactions, environments and operating conditions

 Adversarial Agent   Attempt to break, manipulate, misuse, exploit or confuse the capability

 Trust Agent         Enforce security, privacy, accessibility, reliability, ethical and regulatory boundaries

 Coherence Agent     Apply approved patterns; maintain fit with the enterprise system
 Agent              Mandate

 Value Agent        Connect adoption and behaviour to financial, experience, workforce, operating and risk measures

 Release Agent      Manage evidence, exposure, deployment, rollback and authorisation state

 Observation        Monitor production performance; recommend expansion, change, reversal or retirement
 Agent

 Memory Agent       Maintain decisions, rules, provenance, traceability and mission memory

 Reuse Agent        Find existing capabilities; publish new primitives, patterns, tests, failures and guardrails



1.3.2 The five foundational primitives

 Primitive                     Primary question                                                      What it replaces

 Value Signal                  Why might the enterprise act now?                                     Demand intake, project request

 Value Mission                 What measurable condition must change?                                Project charter, epic

 Value Cell                    Who can turn the intent directly into value?                          Delivery team, squad

 Value Burst                   What can be learned or changed now?                                   Sprint, workshop, test cycle

 Composable Capability         What reusable business ability can perform the work?                  Fixed application or feature silo

 Production Evidence           What happened in reality?                                             Status, sign-off, completion declaration


Value Signal — evidence that an opportunity, problem, risk or unmet need may be valuable enough for the enterprise to
address. It is an observable indication, not a solution request. A complete signal contains: observed condition; affected
population/process; quantitative and qualitative evidence; frequency, duration and magnitude; baseline performance; potential
financial/customer/workforce/risk/strategic value; urgency and time sensitivity; confidence and evidence quality; possible
causes separated from confirmed causes; consequences of taking no action; related signals, missions, capabilities and prior
decisions; candidate reusable capabilities; recommended Co-Creator and Builder; and a recommended next probe — not a
predetermined solution.

States: Detected → Enriched → Monitoring → Merged → Promoted / Rejected / Expired.

Value Mission — a temporary, outcome-centred mandate to change a measurable business condition.

Mission formula (verbatim):

  Change [measurable condition] from [baseline] to [target] for [affected population] within [operating boundaries], proven by
  [production evidence].

Mission lifecycle states: Accepted, Activated, Probing, Advancing, Exposed, Proven, Embedded, Closed/Redirected. Status
language replaces "not started / on track / done" with: Exploring, Proving, Producing value, Underperforming, Retired.

A mission excludes predetermined feature lists, detailed requirements packages, user-story backlogs, fixed technical
architecture, prescribed application design, resource plans organised by specialist role, long delivery schedules, and
commitment to a particular solution.

Value Burst — the Value Cell's smallest useful unit of forward movement. Must produce at least one of: a working capability;
new production evidence; a consequential decision; or elimination of an invalid assumption or solution. If it produces only
discussion, documentation, status or task assignments, it was not a Value Burst.

Reference 60–180 minute structure:

 Time               Activity                              Evidence produced

 0–10 min           Intent compression                    Outcome, evidence, constraints, non-negotiable consequences

 10–30 min          Experience generation                 Working interpretation or intervention
 Time                 Activity                              Evidence produced

 30–60 min            Live interaction                      Business reactions, rules, exceptions, acceptance evidence

 60–90 min            Autonomous challenge                  Simulation, adversarial, policy, failure, misuse results

 90–120 min           Refinement                            Corrected capability, updated Intent Model

 120–150 min          Controlled exposure                   Shadow or limited-production evidence

 150–180 min          Observe and decide                    Advance, revise, continue, reverse or discard decision


Composable Capability — a complete, reusable, discoverable, governed business ability that can be invoked by a person, AI
agent, workflow, application or another capability to produce a defined outcome. Not merely code, an API or a microservice. It
packages everything required to perform a business action safely and observably. Examples: identify member; validate
coverage; read document; verify insurer payment; calculate benefit; route exception; explain decision; obtain approval; issue
payment; record audit event.

Composable capability vs microservice (verbatim table):

 Dimension            Traditional microservice                         Composable capability

 Primary question     How should software be divided?                  What should the enterprise be able to do?

 Unit of design       Technical or domain service                      Executable business ability

 Typical consumer     Developer or another service                     Business user, Builder, AI agent, workflow or system

 Composition          Primarily during application development         At design time or dynamically at runtime

 Contents             Code, API, logic, data access                    Logic, data, AI, workflow, policy, control, experience, evidence, telemetry

 Interface            API or event contract                            Business-intent and outcome contract

 Reuse                Often inside one system or domain                Designed for enterprise reuse across products and journeys

 Governance           Deployment, security, reliability                Authority, business policy, risk, explainability, cost, outcome quality

 User experience      Usually requires an application around it        Can generate or directly participate in the experience



1.3.3 The three governing separations
 1. Separate intent from requested solution. An employee may request a portal, application, workflow, feature, dashboard or
    agent. ValueOS first recovers the measurable condition that must change. The requested solution becomes one hypothesis
    among others.
 2. Separate authority from confidence. An AI-generated capability may appear correct without having sufficient authority to
    act. Authority is earned through risk classification, simulation, evidence, reversibility and observed production performance.
 3. Separate canonical operating truth from generated explanation. ValueOS maintains a machine-readable, versioned
    Operating Graph as its authoritative source. Human-facing explanations, simulations, briefings, interfaces and temporary
    documents are generated from that source for the current person and moment. A generated rendering never becomes
    the canonical model.


1.3.4 The Live Build Loop (eight stages)

  Frame → Route → Skeleton → Co-Create → Evidence → Test → Release → Value


 Stage                           Substance

 1 — Frame the outcome           30–90 minute conversation. Entry test: "For [specific person or situation], we will improve [measurable outcome]
                                 by enabling [new business ability], proven by [observable production evidence." If the Cell cannot complete this
                                 sentence, it is not ready to expose capability

 2 — Route by risk, not          Assign risk tier; apply proportional governance
 bureaucracy
 Stage                               Substance

 3 — Create the walking              One real user process; minimal interface; minimal data model; one integration path; basic access control;
 skeleton                            observable output; automated safe deployment and rollback

 4 — Co-create through               Show the capability; observe the reaction; change it while the context is still alive
 show-react-refine loops

 5 — Convert conversation            Distinguish needs, rules, exceptions, roles, data needs, constraints, decisions, questions, assumptions,
 into structured, confirmed          acceptance, changes and reversals. Material decisions receive lightweight human confirmation
 evidence

 6 — Generate tests                  Unit, integration, API/capability-contract, workflow, business-rule, regression, security, privacy, accessibility, data-
 continuously from intent            quality, performance, resilience, negative and misuse paths, business acceptance scenarios, agent and model
                                     evaluations. Every accepted rule links to its source decision, product behaviour, tests, results, deployed version
                                     and production evidence

 7 — Release based on                See Part 6
 evidence

 8 — Begin the value-                Named business owner; adoption measure; business-value measure; technical-health measure; risk indicators;
 validation cycle                    feedback and challenge channel; telemetry; review date; retirement criteria



1.3.5 Delivery shift — traditional versus ValueOS
The strategy's comparison material establishes the baseline being replaced. Measured from the source graphics:

 Traditional model           Structure                                                      Failure signature

 Traditional Business        7 sequential stages: Business Need → Idea → Product            Many stakeholders; many approval gates; annual planning
 Planning & Approval         Portfolio → CBA/Business Case → Business                       cycles limit agility; longer journey to funding
 Model                       Prioritization → Annual Capital Planning → EPMO
                             Portfolio Management → Funded Portfolio

 Traditional Linear          11 sequential stages from Functional Business                  Many roles; many handoffs; serial flow; longer path to value
 Delivery Model              Requirements through Deployment, with named
                             specialist roles stacked on every stage

 Traditional End-to-         18 sequential stages from Business Need to                     Multiple stakeholders and specialised roles across the
 End Technology              Deployment, with a stakeholder layer above each                lifecycle; frequent approvals, reviews and handoffs; linear,
 Investment Lifecycle        stage                                                          annualised flow limits agility; increased time, complexity and
                                                                                            coordination cost; longer journey to business value


The ValueOS replacement, as depicted: one multi-disciplinary Value Cell (Business Co-creators, AI Builders, AI Agents)
operating in the AI Builder Community, running a four-stage flow:

  Business Need → 1 Co-Create & Frame → 2 Instant Prototype → 3 Live Build, Evaluate, Iterate → 4 Deploy & Adopt →
  Business Value

Footer benefits: one multi-disciplinary Value Cell; continuous co-creation with no translation layers; AI accelerated prototyping
and build; fewer handoffs and lower coordination cost; faster journey to business value.

The compression, stated plainly: eighteen sequential stages with stacked specialist roles become four continuous
stages executed by one cell. Roughly 18 → 4 stages, many handoffs → none, annual funding cycles → continuous bounded
bets, months-to-value → days.


1.3.6 Risk tiers and progressive authority

 Tier                   Characteristics                                                Minimum operating treatment

 Tier 1 — Low           Reversible, internal, non-sensitive, low consequence           Automated checks, Builder accountability, rapid exposure

 Tier 2 —               Workflow or integration impact, limited sensitive data,        Targeted controls, limited exposure, enhanced observation
 Moderate               bounded consequence
 Tier               Characteristics                                          Minimum operating treatment

 Tier 3 — High      Customer-facing, regulated, sensitive data, material     Consequence-owner confirmation, adversarial evaluation,
                    decisions                                                Shadow evidence, strict rollback

 Tier 4 —           Rights-, safety-, financial-, legal- or life-affecting   Formal assurance, independent human judgment, strict least
 Critical           autonomous behaviour                                     authority, continuous monitoring


Progressive authority ladder: Observe → Recommend → Act with confirmation → Act within bounded limits → Autonomous
with exception. Authority can decrease at any time when performance, context, policy, risk or confidence changes.


1.3.7 The evidence graph (the chain THREAD exists to hold)

   Source Signal → Confirmed Decision → Intended Behavior → Implement → Test + Simulate → Release Authority →
   Production Outcome → Value

It must answer: Why does this capability exist? Which business decision authorised it? What evidence supported the decision?
Which version implemented the behaviour? Which tests and simulations evaluated it? Who or what authorised exposure? What
happened in production? What value, cost, risk or harm emerged? Is continued operation still justified?


1.3.8 ValueOS as a living work environment
The source is emphatic that ValueOS must not become content to be consumed. It must be a headless, machine-readable,
agent-executable environment. Its authoritative source has no fixed human format — it is an Enterprise Operating Graph of
atomic, connected operating objects. Object types listed in the source:

Concepts · Principles · Rules · Protocols · Guardrails · Patterns · Anti-patterns · Capabilities · Examples · Decisions · Evidence ·
Metrics · Authority

Each object includes: identity, definition, relationships, applicability, schema, explanation, examples, evidence, provenance,
owner, effective date, version, permission, expiration and associated tools.

   "The graph is the canonical truth. Every explanation, interface, simulation, briefing and agent response is generated from it."

Agent-executable operating model — tools named in the source: detect_value_signal · score_value_signal ·
find_related_missions · create_value_mission · recommend_value_cell · start_value_burst ·
search_capability_fabric · run_adversarial_simulation · request_exposure_authority ·
monitor_outcome_evidence · publish_reusable_capability · detect_legacy_behavior

The source specifies that ValueOS should use open contracts — Model Context Protocol for resources, prompts, executable
tools and real-time notifications; Agent-to-Agent protocols for specialised agents to discover one another and collaborate
across platforms — so the operating system is not bound to one AI vendor.


1.3.9 What ValueOS must not become (verbatim list — treat as PROHIBITED)
Another intranet · a large searchable wiki · a renamed project-management platform · a static AI playbook · a library of
recorded webinars · a traditional certification program · a chatbot that only answers questions · a social feed optimised for
reactions · a digital-adoption layer filled with pop-ups · a central content team that manually updates everything · surveillance
disguised as behavioural coaching · multiple agents with conflicting definitions · a knowledge base that cannot initiate action.


1.3.10 Non-negotiable safeguards (verbatim — carry into the build prompt)
   Clear separation between official canon and generated interpretation
   Evidence and citations for consequential guidance
   Versioned definitions and guardrails
   Role-, attribute-, context- and purpose-based permissions
   Consent for conversation and ambient capture
   Strong boundaries against employee surveillance
   Human confirmation for irreversible or high-impact action
   Complete decision, tool, agent, data and action provenance
   Open protocols to reduce platform lock-in
   Mechanisms for challenging the operating model itself
   Automatic expiration of stale generated material
   Transparent confidence and authority state
   Kill, rollback and recovery controls


1.3.11 Systemic failure modes ValueOS must actively detect (verbatim — implement as detectors)
   A requested solution with no measurable condition
   A mission with no empowered Co-Creator
   A document prepared for a handoff
   A recurring meeting that exists only for awareness
   A long queue awaiting standard approval
   A capability created without registry search
   A large batch that could be exposed incrementally
   Human monitoring that AI could perform
   Autonomous action without sufficient evidence
   A capability with no owner, telemetry or expiration
   An application team protecting local scope over enterprise value
   A Builder manually performing work that agents could execute
   A generated answer that cannot cite authoritative operating objects
   A high-impact tool call without deterministic policy and provenance
   A Value Feed drifting toward social engagement rather than value


1.3.12 Measures to reject (verbatim — PROHIBITED in THREAD's schema)
Story points · sprint velocity · requirements completed · features shipped without outcome evidence · lines of code · prompt
count · agent-call count · utilisation as a proxy for value · meetings held · documents produced · training modules completed.

Primary measure: median time from confirmed business intent to measurable production value.


1.4 The AI build platforms

Build execution happens on:

 Platform        Hosting                                Notes for integration

 Lovable         Vendor SaaS (the one exception to      Prompt-to-application generation; requires the strictest data-classification routing
                 internal hosting)                      since it is outside the perimeter

 Claude Code     Self-hosted internally                 Agentic repository-aware coding, CLI/agent harness

 Codex           Self-hosted internally                 Agentic coding

 Cursor          Self-hosted internally                 IDE-integrated agentic coding

 Grok / Grok     Self-hosted internally                 Agent and bot execution
 Bots


DESIGN DECISION. THREAD does not itself generate code as its primary function. THREAD compiles intent into creation
prompts, dispatches them to these platforms, and captures the complete lineage of what they produced and under
what authority. The platforms own execution; THREAD owns the thread. See Part 8.
1.5 Where THREAD fits, and why it exists at all

ValueOS's Operating Graph has to live somewhere. Something must hold the canonical objects, enforce the authority model,
capture the evidence, serve the agents, generate the human-facing renderings, and detect the anti-patterns. Nothing in the AI
Factory or the Governance model does that — the Factory supplies the environment, Governance supplies the boundaries, the
Community supplies the humans and the agents.

THREAD is the missing component: the operating graph, the evidence graph and the generation fabric that ValueOS
runs on.
PART 2 — What THREAD is, and what it must never become

2.1 Definition

  THREAD is the canonical, machine-readable, versioned Enterprise Operating Graph of MASA — together with the
  evidence graph that connects every signal to every decision, creation, authority, production outcome and value
  result — exposed as agent-executable tools and human-facing generated surfaces.

Stated for a non-technical reader: THREAD is the enterprise's living memory of what it intended, decided, built, was permitted to
do, proved, and gained — and the machinery that lets people and AI agents act on that memory directly rather than reading
about it.


2.2 The five kernels

 Kernel                      Responsibility                                             Failure mode if absent

 K1 — Operating Graph        Canonical, versioned, permissioned operating objects       Agents hold conflicting definitions; the enterprise
                             and their relationships                                    loses its single truth

 K2 — Evidence Graph         The eight-step chain from signal to value, fully           Nobody can answer "why does this exist?"; authority
                             inspectable                                                cannot be earned or withdrawn

 K3 — Authority &            Deterministic policy evaluation deciding what may          Either universal friction or uncontrolled speed
 Guardrail Engine            proceed automatically

 K4 — Generation Layer       Every human-facing rendering, generated from canon,        Generated material hardens into false authority
                             stamped, expiring, never canonical

 K5 — Agent-Executable       MCP tools, resources, prompts and A2A contracts            "A knowledge base that cannot initiate action" — a
 Surface                     exposing the model as actions                              named prohibited outcome


Two supporting services sit beneath these: the Capability Fabric (Part 7) and the Creation-Loop Recorder (Part 8). Detection
of legacy behaviour (Part 11.9) is a first-class capability across all kernels.


2.3 THREAD is not (PROHIBITED — absence is testable)

THREAD is not an intranet, wiki, knowledge base, project-management tool, delivery methodology, status reporting system,
documentation portal, approval workflow engine, certification platform, chatbot, social feed, LMS, or a content site. It is not a
place people go to read. It is an environment people and agents act through.

The single largest risk to this project is that THREAD becomes a very well-organised wiki. Every design review must test
against this. Part 21 specifies the acceptance tests that prove it has not happened.


2.4 Withdrawn objects from earlier planning

Earlier THREAD drafts were written against a conventional delivery model. The following are withdrawn and must not appear
in the build prompt as objects, screens, reports, metrics or fields.

 Withdrawn legacy object or behaviour                         ValueOS replacement THREAD must implement instead

 Project request                                              Evidence-backed Value Signal

 Project or programme                                         Temporary Value Mission

 Delivery team or squad                                       Dynamic Value Cell

 Requirement (as an administrative work object)               Living Intent Model and confirmed behaviour
 Withdrawn legacy object or behaviour                    ValueOS replacement THREAD must implement instead

 Epic and user story                                     Behavior Statement and executable Outcome Contract

 Backlog                                                 Expiring Opportunity Stream

 Sprint                                                  Value Burst

 Test phase                                              Continuous simulation plus Production Shadow

 Design review                                           Pattern conformance plus evidence-triggered exception judgment

 Approval board                                          Encoded authority plus human decision for consequences

 Status report                                           Live evidence and Value Signal

 Release completion                                      Controlled exposure and observed value

 Application ownership                                   Outcome and composable-capability stewardship

 Job title and seniority                                 Dynamic Capability Profile based on evidence

 Personal output                                         Builder-to-Agent use and business value per human hour

 Requirement traceability matrix (RTM)                   Evidence graph with the eight-step chain

 Requirement readiness gate                              Mission framing entry test; intent-vs-solution separation

 Prompt approval policy                                  Risk-tiered encoded authority and consequence judgment

 Gate readiness scorecard / sign-off                     Confidence bundle and exposure authorisation

 Coverage percentage as a success metric                 Value realised per exposure; reuse rate; intent-to-value time

 Documentation production as a task                      Synchronised generation from the Operating Graph



2.5 The one tension that must be resolved explicitly

The tension. Carey's direction to THREAD states: "THREAD owns the traceability of requirements within the THREAD system,
requirement → prompt → build → artifact → visualization → review → feedback → next version" and "this new platform owns the
requirements ... this is the system of records for requirements and traceability." ValueOS states: no requirements — use a living
Intent Model, and lists "requirements completed" among the measures to reject.

RESOLVED — CONFIRMED by the COO, 15 October 2026. The COO confirmed: the traceable unit is an object — a Behavior
Statement inside a Living Intent Model; "requirement" survives only as a human-facing label alias so that people with a
legacy mindset can follow. The original use of the word "wiki" referred to the concept of collecting co-creation and build
artifacts and connecting behaviour statements — not to a document repository.

Both are satisfied by separating the capability from the object and from the word:

 1. The capability is preserved and strengthened. End-to-end traceability from a business condition to a production value
    result is exactly the evidence graph, and it is THREAD's central purpose. Nothing is lost.
 2. The object changes. The traceable unit is a Behavior Statement inside a living Intent Model, governed by an Executable
    Outcome Contract — not a requirement record. A Behavior Statement is machine-readable and directly generates
    implementation, tests, simulation, observability and traceability ( Condition → observable result → operating
    constraints ).
 3. The word is retained only as a label and as a legacy alias. "Requirement" may appear as a human-facing synonym for a
    Behaviour Statement, and as an alias for imported legacy material. It must never become an administrative work object
    with its own lifecycle, completion metric, or readiness gate — because that is precisely what ValueOS exists to remove.
 4. requirements completed never becomes a measure. Completion is replaced by evidence-based states: Exploring,
   Proving, Producing value, Underperforming, Retired.

Why this matters more than it looks. If THREAD ships a requirement object with a status field and a completion percentage,
the enterprise will rebuild the translation layer on top of the new platform within two quarters — and it will feel like progress
the whole way. The object model is the operating model.

Legacy alias registry (retained, reframed). The alias registry concept from earlier planning is retained solely to map imported
legacy identifiers (old requirement IDs, spreadsheet rows, document section numbers) onto canonical THREAD objects, so
historical references still resolve. It is a migration aid, not an identity system for a live requirements process.
PART 3 — Governing architecture principles

These are derived from the ValueOS source and are NON-NEGOTIABLE. Each must be enforced in code and covered by an
acceptance test.

 #     Principle                                             Concrete enforcement

 P1    Canon is separate from generated. The graph           Rendition records carry generated_from , generated_at , generator , and
       is the only authority. Every human-facing             an expiration. No rendition may be edited into canon; no service may read a
       artifact is a rendition.                              rendition as truth

 P2    Authority is separate from confidence. Two             confidence_bundle and authority_level are separate, separately-
       independent fields; neither implies the other.        updated fields with separate histories

 P3    Intent is separate from requested solution. A         Objects distinguish observed_condition from
       solution request is a hypothesis.                     requested_solution_candidates[] ; a signal that begins with a solution
                                                             raises the RequestedSolutionWithoutCondition finding

 P4    Expiration everywhere. Every object carries a         Enforced at the schema level; no object type may omit these fields
       review date, an expiration condition and a
       retirement path.

 P5    Machine-discoverable and agent-executable.            Every object type has a discovery descriptor; every operation has a tool contract
       Every object and verb is exposed as an MCP            (Part 12)
       resource or tool.

 P6    No approval queues for standard work.                 No object type may have a "pending approval" state. The only human wait state is
       Encoded authority decides; humans decide              HumanDecisionRequest (Part 6.4)
       exceptions and consequences.

 P7    Proportional governance. Treatment scales             Every gate is parameterised by risk tier; nothing is uniformly gated
       with risk tier, consequence, reversibility, novelty
       and evidence.

 P8    Permission-aware at retrieval, never at               Access predicates are pushed into every query, including vector and graph search.
       render.                                               Post-filtering is a defect

 P9    Complete provenance. Every consequential              Append-only audit ledger; a consequential action without provenance is rejected at
       behaviour records actor (human or agent),             write time
       authority under which it acted, evidence, time
       and version.

 P10   Anti-pattern detection is a product                   The fifteen failure modes in Part 1.3.11 are implemented as live detectors with
       capability.                                           owners and notifications

 P11   Reuse before creating. Creation is blocked            search_capability_fabric must be called and its result recorded before any
       until the Capability Fabric has been searched         creation object may be created
       and a no-match recorded.

 P12   Measured by value, not output. Rejected               A schema test asserts that no rejected-measure field exists; a detector flags
       measures must be absent from the schema.              rejected-measure language in human input

 P13   Consent and surveillance boundaries.                  Consent records gate ambient capture; a set of inferences is prohibited outright
                                                             (Part 14.3)

 P14   Open protocols. No single-vendor lock.                MCP and A2A; provider-agnostic model routing; exportable canon

 P15   The model can challenge itself.                       Canon changes require versioning, evidence, a challenge window and a recorded
                                                             decision
PART 4 — The Operating Graph object model

This is the most important part of the document. Build from these schemas directly.


4.1 The universal object envelope

NON-NEGOTIABLE: every operating object in THREAD carries this envelope. No exceptions, including generated renditions
and evidence objects.
ObjectEnvelope:
  # Identity
  id:                 string           # stable, opaque, never reused, never renumbered
  human_ref:          string           # display reference, e.g. VS-2026-0417, BM-2026-0031
  type:               enum             # from the Object Type Registry (4.3)
  schema_version:     semver           # the schema this object was written against

  # Content
  title:              string           # short human label
  statement:          text             # the canonical assertion, in plain language
  body:               object           # type-specific structured payload
  machine_description: text            # how an agent should understand and use this object

  # Versioning and lineage
  version:            integer
  supersedes:         [object_id]
  superseded_by:      [object_id]
  derived_from:       [object_id]      # provenance: what produced this object
  created_at:         timestamp
  created_by:         Actor            # {kind: human|agent|system, id, authority_used}
  updated_at:         timestamp
  updated_by:         Actor

  # Lifecycle
  lifecycle_state:    enum             # type-specific; see 4.4
  effective_from:     timestamp
  review_date:        date
  expiration_condition: object         # machine-evaluable
  expires_at:         timestamp|null
  retired_at:         timestamp|null
  retirement_reason: text|null

  # Accountability
  owner:              Actor            # the accountable human
  co_creator:         Actor|null       # for mission-scoped objects
  builder:            Actor|null
  steward:            Actor|null       # for canon objects

  # Risk, authority, confidence
  risk_tier:          1|2|3|4
  authority_level:    enum            #
observe|recommend|act_with_confirmation|act_bounded|autonomous_with_exception
  confidence_bundle: ConfidenceBundle # see 6.3 — NOT a single opaque score
  consequence_class: enum             #
none|reversible|costly_reversible|irreversible|rights_affecting|safety|lifeline

  # Access and data
  permission:         PermissionSpec   # roles, attributes, context, purpose, data classification
  data_classification:enum             # public|internal|confidential|restricted|prohibited
  permitted_uses:     [enum]

  # Relationships
  relationships:      [Edge]           # see 4.5

  # Evidence and derivation
  evidence_refs:      [object_id]
  citations:          [Citation]
  rendition_ids:      [object_id]      # generated material produced from this object

  # Challenge
  challenges:         [ChallengeRef]   # counter-arguments, disproved assumptions
  open_questions:     [object_id]

  # Integrity
  content_hash:       string
  provenance_chain_id:string           # links to the append-only ledger
4.1.1 ConfidenceBundle (replaces any single confidence score)
NON-NEGOTIABLE: confidence is a transparent evidence bundle, never an unexplainable model score.

  ConfidenceBundle:
    intent_alignment:        {value: 0..1, method, evidence_refs}
    simulation_performance: {value, runs, pass_rate, evidence_refs}
    adversarial_results:     {value, attempts, failures_found, evidence_refs}
    security_privacy_evidence:{value, scans, findings, evidence_refs}
    accessibility_reliability:{value, checks, findings, evidence_refs}
    capability_pattern_conformance:{value, patterns_matched, deviations, evidence_refs}
    reversibility_rollback: {value, rollback_verified, blast_radius, evidence_refs}
    impact_assessment:       {value, affected_population, evidence_refs}
    shadow_results:          {value, sample_size, discrepancy_rate, evidence_refs}
    risk_tier:               1|2|3|4
    owner_confidence:        {value, actor, rationale}
    data_quality_lineage:    {value, sources, gaps, evidence_refs}
    model_agent_evaluations: [{model, suite, result, evidence_refs}]
    computed_at:             timestamp
    computed_by:             agent_id
    overall:                 derived      # MUST be computed by the published rule, not learned



4.2 Relationship verbs

Every edge is typed, directed where meaningful, and carries its own envelope fields ( confidence , authority_used ,
 evidence_refs , created_by , created_at ).
# Value flow
signals            ValueSignal        -> ValueMission
promoted_from      ValueMission       -> ValueSignal
scoped_to          ValueMission       -> ValueCell
operated_by        ValueCell          -> Actor
bursts             ValueCell          -> ValueBurst
produced           ValueBurst         -> {WorkingCapability | Evidence | Decision | DisprovedAssumption}

# Intent
expresses          IntentModel      -> ValueMission
contains           IntentModel      -> BehaviorStatement
governed_by_contract ExecutableOutcomeContract -> IntentModel
confirmed_by       BehaviorStatement -> Decision
constrains         Constraint       -> BehaviorStatement
non_negotiable     NonNegotiableConsequence -> BehaviorStatement
raises             OpenQuestion     -> BehaviorStatement
assumes            Assumption       -> BehaviorStatement
disproven_by       Assumption       -> Evidence

# Capability
composes           WorkingCapability -> ComposableCapability
implements         ComposableCapability -> CapabilityContract
depends_on         ComposableCapability -> ComposableCapability
evidenced_by       ComposableCapability -> Evidence
stewarded_by       ComposableCapability -> Actor
superseded_by      ComposableCapability -> ComposableCapability

# Creation lineage (THREAD's traceability mandate)
compiled_into      BehaviorStatement -> CreationPrompt
used_template      CreationPrompt   -> PromptTemplate
governed_by        CreationPrompt   -> Guardrail
dispatched_to      CreationPrompt   -> BuildPlatform
executed_as        CreationPrompt   -> BuildRun
produced_artifact BuildRun          -> BuildArtifact
skeleton_of        WorkingSkeleton -> ValueMission
iterated_as        BuildRun         -> BuildRun

# Evidence
verified_by        {BehaviorStatement|ComposableCapability} -> TestRun
simulated_by       WorkingCapability -> SimulationRun
challenged_by      WorkingCapability -> AdversarialRun
evaluated_by       {ModelRoute|Agent} -> ModelEvaluation
shadowed_by        WorkingCapability -> ShadowRun
discrepancy_in     ShadowRun        -> Discrepancy
authorised_by      ExposureAuthorization -> WorkingCapability
exposed_to         ExposureAuthorization -> ExposurePopulation
observed_as        WorkingCapability -> ProductionOutcome
values             ProductionOutcome -> ValueMeasure
caused             ProductionOutcome -> Incident

# Authority and assurance
authority_granted_by {any}             -> AuthorityGrant
policy_evaluated_by {any}              -> PolicyEvaluation
control_checked_by   {any}             -> ControlCheck
consent_basis        CaptureSession    -> ConsentRecord
permission_basis     {any}             -> DataUsePermission

# Convergence and learning
lessons            ValueMission     -> Lesson
contributes        Lesson           -> ReusablePrimitive
published_as       ReusablePrimitive -> MarketplaceAsset
accelerated_by     ValueCell        -> ValueCell

# Provenance (universal)
cites              {any}              -> {any}
rendered_as        {any}              -> Rendition
flags              DetectorFinding    -> {any}
reveals            DetectorFinding    -> AntiPattern
4.3 Object Type Registry

A. Canon family — the operating model's own truth

 Type              Key fields beyond the envelope

 Concept           definition; formal_definition; distinguishing_notes; replaces[]; operational_implications[]

 Principle         directive; derivation; violation_examples[]

 Rule              trigger; rule_statement; conditions[]; exceptions[]; machine_evaluable: bool; evaluator_ref

 Protocol          preconditions; steps[]; decision_points[]; outputs[]; e.g. "how a signal becomes a mission"

 Guardrail         boundary_statement; enforcement_mode: deterministic|advisory; evaluator_ref; severity; risk_tiers[]; violation_response

 Pattern           context; problem; approach; canonical_example; conformance_check_ref

 AntiPattern       signature[]; why_harmful; detector_ref; remediation

 Metric            definition; formula; unit; data_sources[]; direction; target_shape; rejected: bool

 Authority         authority_level; scope; conditions[]; granted_to; granting_evidence[]; demotion_triggers[]



B. Value family

 Type                           Key fields

 ValueSignal                    observed_condition; affected_population; process_or_journey; evidence[] (quantitative + qualitative);
                                frequency; duration; magnitude; baseline_performance;
                                potential_value{financial,customer,workforce,risk,strategic}; urgency; confidence; possible_causes[] (marked
                                confirmed/unconfirmed); consequences_of_inaction; related_signals[]; candidate_capabilities[];
                                recommended_co_creator; recommended_builder; recommended_next_probe;
                                requested_solution_candidates[] (explicitly labelled hypotheses, never the signal itself); state:
                                detected|enriched|monitoring|merged|promoted|rejected|expired

 ValueMission                   signal_ref; measurable_condition; baseline; target; affected_population; operating_boundaries; proof_required
                                (production evidence); value_hypothesis; co_creator; builder; strategic_relevance; opportunity_cost;
                                decision_authority; capital_boundary; available_data_tools_capabilities[]; risk_classification; policy_constraints[];
                                maximum_production_exposure; required_evidence_for_authority[]; human_intervention_conditions[];
                                reversibility_requirements; rollback_requirements; maximum_time; maximum_investment; decision_date;
                                stop_conditions[]; completion_criteria[]; status: exploring|proving|producing_value|underperforming|retired

 ValueCell                      mission_ref; co_creator; builder; agents[] (with agent_id, mandate, authority_level); authority_boundaries;
                                active_bursts[]; formed_at; dissolution_condition; contribution_log[]

 ValueBurst                     cell_ref; start; end; intent_compression; experience_generation; live_interaction_evidence[];
                                autonomous_challenge_results[]; refinement[]; controlled_exposure_ref; decision_ref; material_change_of:
                                capability|evidence|direction (a burst producing none of these is not a burst — enforce)

 OpportunityStreamItem          state: now|next|observing|expired; expiration_condition; value_estimate; urgency; required_context;
                                candidate_builders[]; readiness_evidence[]



C. Intent family

 Type                                 Key fields

 IntentModel                          mission_ref; desired_outcome; affected_people_and_situations[]; observable_behaviour[];
                                      business_rules[]; exceptions[]; constraints[]; non_negotiable_consequences[]; decisions[]; rationale[];
                                      representative_examples[]; evidence[]; confidence; assumptions[]; open_questions[];
                                      acceptance_history[]; change_history[]; living: never "complete"

 BehaviorStatement                    condition (trigger); observable_result; operating_constraints[]; source_decision_ref; confirmation{actor,
                                      at, method}; generates[] (implementation, tests, simulation, observability, traceability); verification_status:
                                      unverified|verified_in_simulation|verified_in_shadow|verified_in_production
 Type                                Key fields

 ExecutableOutcomeContract           desired_outcome; baseline; target; target_users_and_situations; affected_parties[];
                                     observable_behaviours[]; rules_and_exceptions[]; non_negotiables[]; acceptance_evidence[];
                                     risk_classification; authority_level; success_value_adoption_health_measures[];
                                     production_exposure_conditions; reversibility_conditions; expiration_and_retirement_criteria

 Constraint                          kind: legal|regulatory|technical|operational|financial|ethical; source; binding_scope

 NonNegotiableConsequence            statement; why_non_negotiable; violation_severity; detector_ref

 ConfirmedDecision                   decision; decided_by (human required for material decisions); authority_used; context; alternatives[];
                                     rationale; reversibility; consequences[]; effective_from

 OpenQuestion                        question; why_it_matters; blocking: bool; owner; needed_by

 Assumption                          statement; basis; confidence; verification_method; status: held|confirmed|disproven



D. Capability family

 Type                         Key fields

 ComposableCapability         plain_language_purpose; business_outcome; intended_consumers[]; input_schema; output_schema;
                              preconditions[]; dependencies[]; business_rules[]; exceptions[]; data_classifications[]; permitted_uses[];
                              authority_level; risk_tier; policy_constraints[]; security_privacy_accessibility_constraints[];
                              confidence_requirements; explainability_audit_behaviour; failure_modes[]; recovery_behaviour;
                              human_intervention_conditions[]; test_simulation_evaluation_refs[]; service_levels[]; cost_resource_telemetry_ref;
                              version; compatibility; owner_and_stewardship; review_date; minimum_use_threshold; operating_cost_ceiling;
                              retirement_condition; is_machine_discoverable (required true)

 CapabilityContract           the formal business-intent-and-outcome contract: promised outcome; refusal conditions; explanation
                              obligations; evidence obligations; authority; cost model; lifecycle

 CapabilityDependency         from; to; kind: data|event|policy|experience|model; criticality

 DataProduct                  name; steward; schema; quality_measures[]; classifications[]; permitted_uses[]; lineage_refs[]



E. Creation family — the traceability mandate

 Type                  Key fields

 CreationPrompt        source_behavior_statements[]; intent_model_ref; outcome_contract_ref; design_context_refs[] (glossary, patterns,
                       design tokens, prior capability contracts); guardrail_set_ref; prompt_template_ref; target_platform; expected_risk_tier;
                       estimated_cost; authority_required; compiled_at; compiled_by; never contains raw captured text (Part 13.4);
                       diffusion_ref (the positive list of what may be included)

 PromptTemplate        platform; stack; version; owner; guardrail_set; evaluation_status; supersedes; change_requires_eval: true

 BuildPlatform         name (Lovable|Claude Code|Codex|Cursor|Grok Bots); hosting: saas|internal; permitted_data_classifications[];
                       capabilities[]; integration_surface (api|cli|harness); auth_model; attestation_ref

 BuildRun              prompt_ref; platform; model_route_ref; model_version_pin; guardrail_set_version; template_version; dispatched_at;
                       completed_at; duration; cost; outcome: succeeded|failed|partial; failure_reason; reproducibility_key (= hash of
                       prompt_version + platform + model_route + model_version_pin + guardrail_set_version + template_version);
                       agent_actor; authority_used; log_ref

 BuildArtifact         run_ref; repository; commit_or_version; image_or_bundle; digest; files_changed[]; diff_ref; secrets_scan_result;
                       dependency_manifest

 WorkingSkeleton       mission_ref; one_real_user_process; minimal_interface; minimal_data_model; one_integration_path;
                       access_control_basis; observable_output; automated_safe_deployment_ref; rollback_ref

 Iteration             from_run; to_run; trigger (feedback_ref | evidence_ref | decision_ref); change_class:
                       cosmetic|behavioural|scope|architecture; scope changes must re-enter mission framing
F. Evidence family

 Type                      Key fields

 TestSuite                 generated_from[] (behaviour statement / contract refs); provenance: generated_from_intent |
                           independently_authored; independence_class (see Part 21.3)

 TestRun                   suite_ref; target_version; environment; executed_at; results[]; pass_fail; evidence_artifacts[]

 SimulationRun             scenario_spec; synthetic_population; conditions_covered[]; results[]; findings[]

 AdversarialRun            attempts[]; classes: break|manipulate|misuse|exploit|confuse; findings[]; severity; remediated[]

 ModelEvaluation           model_route; suite; metrics; pass_fail

 ShadowRun                 capability_ref; event_source; sample_size; period; shadow_outputs[]; actual_outcomes[]; comparison result;
                           discrepancy_rate; confidence_evidence[]; risk_evidence[]; bias_evidence[];
                           conditions_requiring_human_judgment[]

 Discrepancy               shadow_run_ref; case_ref; shadow_decision; actual_decision; delta; hypothesised_cause; disposition

 ExposureAuthorization     capability_ref; authority_level_granted; exposure_population (percent, cohort definition, event set);
                           conditions[]; rollback_armed: bool; kill_switch_ref; authorised_by: Actor (human required above encoded
                           thresholds); evidence_bundle_ref; effective_from; effective_to; authority_can_be_withdrawn

 ProductionOutcome         capability_ref; version; period; events_processed; outcomes[]; behaviour_observed; failures[]; incidents[]; cost;
                           risk_indicators[]; unintended_consequences[]

 ValueMeasure              mission_ref; measure_ref (a Metric object); value; unit; baseline; delta; confidence; source_evidence[];
                           realised_at

 Incident                  capability_ref; severity; description; detection; response; rollback_ref; root_cause; learning_ref

 Rollback                  capability_ref; from_version; to_version; executed_at; executed_by; outcome; duration



G. Assurance family

 Type                        Key fields

 ControlCheck                control_ref (from AI Governance control domains); subject_ref; result; evidence[]; evaluator

 PolicyEvaluation            policy_ref; subject_ref; inputs; decision: allow|allow_with_conditions|deny|escalate; conditions[]; decided_by
                             (engine id); deterministic: true

 AccessibilityEvaluation     standard (WCAG 2.2 AA); subject_ref; checks[]; findings[]; result

 SecurityScan                kind: sast|dast|dependency|secret|injection|model_security; subject_ref; findings[]; severity_summary

 DataUsePermission           data_product_ref; purpose; permitted: bool; basis (consent|contract|legal_obligation|legitimate_interest);
                             restrictions[]; expires_at

 ConsentRecord               participant; session_ref; scope (what may be captured and how used); granted_at; withdrawn_at; evidence



H. People family

 Type                    Key fields

 Builder                 identity; layers[] (ai_factory_liaison|fde_dedicated|citizen_developer|ai_fellow); capability_profile_ref;
                         active_cells[]

 BusinessCoCreator       identity; business_domain; decision_authority; active_missions[]

 CapabilityProfile       evidence-based, never self-described: domains_understood[]; outcomes_delivered[]; swarms_orchestrated[];
                         reusable_capabilities_contributed[]; risks_safely_managed[]; systems_simplified_or_retired[]; value_realised;
                         other_builders_accelerated[]; consequence_types_navigated[]; quality_maintained_as_autonomy_increased[];
                         derived_from_evidence[]
 Type                         Key fields

  HumanDecisionRequest        exact_decision_required; reason_ai_cannot_safely_decide; current_evidence_and_confidence;
                              ai_recommendation; viable_alternatives[] (each with consequences); affected_parties[]; deadline;
                              cost_of_waiting; reversibility; current_authority_boundary; proposed_next_machine_action; no other
                              information

  Decision                    request_ref; decision; decided_by; authority_used; rationale; effective_from; reversal_of



I. Context family (feeds the Enterprise Context Layer — THREAD owns canon, the Factory consumes it)
GlossaryTerm · DomainModel · ReferencePattern · DesignSystemToken · EntityExample

J. Learning family

 Type                    Key fields

  Lesson                 context; what_happened; what_was_learned; generalisable: bool; contributed_to_canon[]

  FailurePattern         signature[]; conditions[]; detection_ref; prevention

  ReusablePrimitive      kind: capability|pattern|test|failure|guardrail|connector|template; source_mission; publication_state

  MarketplaceAsset       primitive_ref; category (Copilot AI|Autonomous Agents|Workflow Automation|Decision Intelligence|Voice
                         AI|Knowledge Intelligence); usage_stats_ref; owner



K. Model and route family
 ModelRoute (provider, endpoint, region, cleared content tiers, attestation_ref, attestation_expiry, model_version_pin,
cost_profile, eval_status, permitted_task_classes[]) · ProviderAttestation (type: BAA|no_training|zero_retention|soc2; scope;
valid_from; valid_to; owner) · EvaluationSuite (name; version; golden_set_ref; metrics[]; pass_thresholds; last_run)


L. Detector family

 Type                  Key fields

  Detector             name; failure_mode_ref (from 1.3.11); detection_method: graph_query|pattern|llm_assisted|deterministic; inputs;
                       threshold; severity; owner_role; remediation_hint

  DetectorFinding      detector_ref; subject_refs[]; evidence; severity; first_seen; state:
                       new|acknowledged|remediated|accepted_risk|false_positive; assigned_to; resolution

  Rendition            source_object_ref; kind: briefing|explanation|interface|simulation|diagram|export|audio|video; generator (agent id +
                       model route); generated_at; expires_when: source_content_hash_changes; state: live|stale|deleted;
                       permission_context (the identity + purpose it was generated for)



4.4 Lifecycle states

NON-NEGOTIABLE: no object type may have a state named or meaning "awaiting approval", "pending sign-off", "submitted
for review" or "in QA phase".

 Family                 States

 Canon                  draft → active → challenged → superseded → retired

 Value Signal           detected → enriched → monitoring → merged → promoted / rejected / expired

 Value Mission          accepted → activated → probing → advancing → exposed → proven → embedded → closed/redirected

 Mission status         exploring → proving → producing value → underperforming → retired
 language

 Behavior Statement     proposed → confirmed → generating → verified_in_simulation → verified_in_shadow → verified_in_production →
                        superseded
 Family                  States

 Composable Capability   proposed → skeleton → shadow → limited_exposure → producing_value → underperforming → retired

 Authority               observe → recommend → act_with_confirmation → act_bounded → autonomous_with_exception (with demotion at
                         any time)

 Creation run            compiled → dispatched → running → succeeded / failed → superseded

 Rendition               live → stale → deleted



4.5 Graph integrity rules

 1. Every object must be reachable. An object with no edges is a defect. Orphan detection is a live detector with an owner.
 2. Every Behavior Statement must trace to a Confirmed Decision and a Value Mission. Untraceable behaviour is not
    permitted to reach creation.
 3. Every Composable Capability must trace to a Value Mission and carry a Capability Contract.
 4. Every production exposure must trace to an ExposureAuthorization with an evidence bundle.
 5. Every canon object must have a steward and a review date.
 6. Cycles in depends_on or derives_from are defects and are surfaced, not silently tolerated.
 7. Tombstones, not deletions. Withdrawn objects remain as tombstones with a reason so historical traceability resolves.
    Physical purge occurs only on a retention schedule with an audit record.
 8. Canon changes are versioned and evidenced. No silent drift (P15).
PART 5 — The Evidence Graph

5.1 The chain

NON-NEGOTIABLE: THREAD must be able to render and query this chain end to end:

  Source Signal → Confirmed Decision → Intended Behavior → Implement → Test + Simulate
    → Release Authority → Production Outcome → Value



5.2 How each link is created

 Link              Created by                           Required fields                         Enforcement

 Source Signal     Human confirmation of a material     signal_ref, decision_ref, actor,        A decision without a signal is rejected; a
 → Confirmed       rule/behaviour/consequence arising   authority_used, rationale, evidence     signal promoted to a mission without a
 Decision          from the signal                                                              framed measurable condition is rejected

 Confirmed         Intent Agent proposes; human         decision_ref, behavior_statement_ref,   Unconfirmed behaviour statements may
 Decision →        confirms material items              condition, observable_result,           not enter creation
 Intended                                               constraints                             ( can_reach_creation = false )
 Behavior

 Intended          Creation Prompt compilation          behavior_statement_refs, prompt_ref,    Reuse-first check must be recorded
 Behavior →                                             guardrail_set, platform,                (P11). Raw captured text must be absent
 Implement                                              authority_required                      (Part 13.4)

 Implement →       Continuous generation from intent    test_suite_ref, simulation_ref,         Every confirmed rule must link to tests
 Test + Simulate                                        adversarial_ref, target_version         and results. A capability may not
                                                                                                proceed without generated coverage
                                                                                                recorded

 Test + Simulate   Authority engine (Part 6)            evidence_bundle_ref, risk_tier,         No exposure without an authorisation
 → Release                                              authority_level, exposure_population,   object; Tier 4 requires independent
 Authority                                              rollback_armed, authorised_by           human judgment

 Release           Observation Agent + production       production_outcome_ref, period,         Shadow evidence required before
 Authority →       telemetry                            events, failures, incidents, cost,      autonomous authority above Tier 2
 Production                                             unintended_consequences
 Outcome

 Production        Value Agent                          value_measure_ref, baseline, delta,     "Producing value" state requires a value
 Outcome →                                              confidence, source_evidence             measure; otherwise the capability is
 Value                                                                                          "underperforming"




5.3 The nine questions the evidence graph must answer

For any capability, behaviour, or production behaviour, THREAD must answer with citations: why it exists; which decision
authorised it; what evidence supported that decision; which version implemented it; which tests and simulations evaluated it;
who or what authorised exposure; what happened in production; what value, cost, risk or harm emerged; and whether
continued operation is still justified.

Design requirement: each of these nine questions is a first-class view and a first-class MCP tool
( explain_capability(authority|decision|evidence|version|tests|exposure|outcome|value|justification) ), not
something an engineer assembles ad hoc.
5.4 Traceability query requirements

The following must be single queries returning in under one second at target scale (Part 16.4), not client-side loops:

 1. Blast radius of a change to a Behaviour Statement — everything downstream that must be re-verified.
 2. Everything affected by a canon change to a Guardrail, Pattern or Authority rule.
 3. All capabilities producing value with no current owner.
 4. All capabilities in production with no value evidence in the last review period.
 5. All behaviour statements with no test coverage.
 6. All production behaviours with no Confirmed Decision ancestor.
 7. All exposure authorisations past their effective_to with no renewal decision.
 8. Causal chains from an Incident back to a Decision.
 9. Everything that would be affected if a Composable Capability were retired.
10. Full chain rendering for any object, with hop depth and per-hop evidence.


5.5 Where traceability lives relative to ValueOS

The evidence chain replaces — and is materially stronger than — a requirement traceability matrix. It traces intent to value,
not requirement to test. It is the answer to Carey's mandate that "THREAD owns the traceability of requirements within the
THREAD system, requirement → prompt → build → artifact → visualization → review → feedback → next version": the same end-
to-end traceability, re-anchored on the ValueOS objects, with an additional link (production value) that a requirements matrix
never had.

Mapped explicitly to Carey's chain:

 Carey's chain element         THREAD object path

 requirement                   Behavior Statement + Executable Outcome Contract

 prompt                        CreationPrompt (+ PromptTemplate, GuardrailSet)

 build                         BuildRun (+ BuildPlatform, BuildArtifact)

 artifact                      BuildArtifact + WorkingSkeleton

 visualization                 Rendition (kind: interface/diagram/simulation)

 review                        ConfirmedDecision / HumanDecisionRequest / Decision

 feedback                      ChallengeRef, Lesson, Iteration (change_class)

 next version                  BuildRun iteration + BehaviorStatement version + ComposableCapability version
PART 6 — Authority, risk and guardrails

This kernel is what replaces the approval bureaucracy that ValueOS removes. It must be deterministic, transparent and fast,
and it must never become an approval queue.


6.1 Risk tiers

SOURCE. Tier is computed from consequence, sensitivity, autonomy, reversibility, exposure, novelty and evidence — never
from organisational politics or cost.

  RiskAssessment:
    consequence:   none|reversible|costly_reversible|irreversible|rights_affecting|safety|lifeline
    sensitivity:   public|internal|confidential|restricted|prohibited
    autonomy:      degree of unsupervised action requested
    reversibility: trivial|assisted|difficult|impossible
    exposure:      internal_only|limited_population|full_population|external_parties
    novelty:       established_pattern|adapted_pattern|novel
    evidence:      evidence bundle completeness score
    computed_tier: 1|2|3|4
    treatment:     the minimum operating treatment for that tier
    computed_at:   timestamp
    computed_by:   engine_id (deterministic)


 Tier           Characteristics                                                Minimum operating treatment

 1 — Low        Reversible, internal, non-sensitive, low consequence           Automated checks; Builder accountability; rapid exposure

 2—             Workflow or integration impact; limited sensitive data;        Targeted controls; limited exposure; enhanced observation
 Moderate       bounded consequence

 3 — High       Customer-facing; regulated; sensitive data; material           Consequence-owner confirmation; adversarial evaluation; Shadow
                decisions                                                      evidence; strict rollback

 4 — Critical   Rights-, safety-, financial-, legal- or life-affecting         Formal assurance; independent human judgment; strict least
                autonomous behaviour                                           authority; continuous monitoring


NON-NEGOTIABLE: Tier is a computed property, stored with its inputs, recomputable, and never manually overridden
downward. Upward override is permitted with a recorded rationale; downward override is PROHIBITED.


6.2 The progressive authority ladder

 Level                                    Behaviour                                  Promotion evidence required

 1. observe                               Receives events; records what it would     None — the default entry point
                                          have done; no production effect

 2. recommend                             Presents a proposed action and its         Shadow or simulation evidence above threshold; no
                                          evidence to a human                        unresolved critical findings

 3. act_with_confirmation                 Prepares the action; executes only after   Consecutive agreement between recommendation and
                                          explicit human confirmation                human decision above threshold

 4. act_bounded                           Executes automatically inside explicit     Shadow evidence; rollback verified; policy conformance; risk
                                          thresholds                                 tier ≤ 3

 5.                                       Operates continuously; routes only         Sustained production performance; discrepancy rate below
  autonomous_with_exception               ambiguous or consequential cases to        threshold; no critical incidents in period; risk tier ≤ 3; explicit
                                          humans                                     human grant
NON-NEGOTIABLE demotion rules. Authority decreases automatically, without human action, when any of: discrepancy rate
exceeds threshold; a critical or repeated incident occurs; policy or guardrail changes; the capability version changes materially;
the data distribution shifts beyond bounds; the model route or model version changes; the authority's effective_to passes
without renewal; the steward becomes unassigned; or a value review shows underperformance.

PROHIBITED: Tier 4 autonomous operation without independently-authorised human judgment on each authorisation, and
without continuous monitoring and an armed kill switch.


6.3 The confidence engine

NON-NEGOTIABLE: machine confidence is a transparent evidence bundle connected to the Intent Model, tests, policies,
authority, production behaviour and reversibility. It is not an unexplainable model score. The ConfidenceBundle schema is in
Part 4.1.1. Its overall value is computed by a published, versioned, readable rule — never by a learned model — and the
rule itself is a Rule object in the graph with a steward and history.


6.4 The decision pattern

NON-NEGOTIABLE decision matrix:

 Confidence and consequence                                                    Action

 High confidence, low consequence, encoded authority                           Automatic release or expansion

 Moderate confidence or limited evidence                                       Limited exposure with observation

 Low confidence or consequential outcome                                       Explicit accountable-human decision

 Prohibited condition                                                          Cannot proceed



6.5 The Human Decision Queue

The only human wait state in the entire system. PROHIBITED: any other queue, inbox, approval list, sign-off tray, review board
or gate.

NON-NEGOTIABLE — a decision request contains exactly these fields and nothing more:

  HumanDecisionRequest:
    exact_decision_required: text
    reason_ai_cannot_safely_decide: text
    current_evidence_and_confidence: EvidenceBundleRef
    ai_recommendation:        text
    viable_alternatives:      [{option, consequences, affected_parties}]
    affected_parties:         [party]
    deadline:                 timestamp
    cost_of_waiting:          text
    reversibility:            enum
    current_authority_boundary: AuthorityRef
    proposed_next_machine_action: text
    # A human must be able to decide, request ONE clarification, reduce authority,
    # or stop the mission — without assembling context manually.


Design requirements: decisions are event-triggered, not scheduled; no recurring status meetings; no notification streams for
awareness; when a human begins work, THREAD generates a concise intelligence brief from the graph rather than requiring
them to read anything.


6.6 Guardrails-as-code

Every guardrail from the AI Governance model is an executable object, not a document.

The six guardrail categories (SOURCE) mapped to executable form:
 Category                            Executable form in THREAD

 AI principles & ethical standards    Principle objects; evaluated for conformance by the Coherence Agent; violations raise findings

 Policies, standards & procedures     Rule objects with machine evaluators; PolicyEvaluation on every consequential action

 Risk appetite & acceptable use      Risk tier thresholds; prohibited_conditions evaluated before any dispatch

 Model & data governance standards    ModelRoute + ProviderAttestation with expiry gates; DataUsePermission per data
                                     product

 Human oversight requirements        Authority ladder promotion rules; mandatory human decision conditions

 Transparency, fairness &            Explanation obligations on capabilities; citation requirements on generated guidance; named owners
 accountability


NON-NEGOTIABLE: guardrail evaluation is deterministic where determinable. An LLM may propose a guardrail; only a
deterministic evaluator may enforce one. Advisory and enforcing guardrails are distinct fields and must never be conflated.


6.7 Prohibited conditions (cannot proceed, regardless of confidence or authority)

   Any action affecting rights, safety or life without independent human judgment
   Sending prohibited-class data to any route, ever
   Automated deployment to production without an ExposureAuthorization and an armed kill switch
   A capability with no owner, no telemetry or no expiration condition entering production
   A high-impact tool call without deterministic policy evaluation and provenance
   A Behaviour Statement without a Confirmed Decision ancestor reaching creation
   A Composable Capability without a Capability Contract being published to the fabric
   Canon change without versioning, evidence and a challenge window
   Any inference listed in Part 14.3 (surveillance boundaries)


6.8 Governance as escalation, not gating

SOURCE. Governance acts as an escalation system, not an approval body. THREAD must reflect this structurally:

   PROHIBITED: a "pending approval" state anywhere in the model.
   PROHIBITED: any workflow that blocks standard work awaiting a committee.
   The AI Governance Council receives escalations — high-risk, high-impact, novel or ambiguous matters — and returns
   guidance and decisions, not approvals. THREAD records council engagements as ConfirmedDecision objects with
    source: governance_council , and never as gates.
   Routine work inside guardrails must flow without any human touch. A measurable target: ≥80% of consequential
   actions are resolved by the authority engine with no human wait.
PART 7 — The Capability Fabric

7.1 Purpose

The registry and discovery layer for composable capabilities. It is how the enterprise stops treating the application as its
primary software asset and begins managing an inventory of reusable business abilities. It is also how P11 (reuse before create)
is enforced.


7.2 The capability contract

Every published Composable Capability carries all of the following (SOURCE — the contract fields are listed verbatim in the
source and must all be present):

Business outcome and plain-language purpose · machine-discoverable description · intended users and consumers · input and
output schemas · preconditions and dependencies · business rules and exceptions · data classifications and permitted uses ·
authority level and risk tier · policy, security, privacy and accessibility constraints · confidence and evidence requirements ·
explainability and audit behaviour · failure modes and recovery behaviour · human-intervention conditions · tests, simulations
and evaluation results · service levels and performance limits · cost and resource telemetry · version and compatibility
information · owner and stewardship model · review date, minimum-use threshold and retirement condition.


7.3 Required characteristics

NON-NEGOTIABLE. A published capability must be, and must be testably:

 Characteristic                   Testable assertion

 Self-describing                  A machine can determine purpose and limits from the descriptor alone

 Outcome-oriented                 It promises a business result, not a technical response

 Independently usable             It functions without an application around it

 Policy-aware                     Authority, privacy, risk and regulatory constraints travel with it

 Context-aware                    It responds to user, situation, permissions and process

 Machine-discoverable             search_capability_fabric returns it for an intent-shaped query

 Safely executable                Inputs, outputs, failures, approvals and escalation are explicit

 Observable                       Performance, use, cost, risk and value are continuously measured

 Evidence-producing               It records what happened, why, and which information was used

 Replaceable                      Internals can change without breaking the outcome contract

 Disposable                       It continues only while evidence justifies its existence



7.4 Discovery and the reuse-first gate

NON-NEGOTIABLE (P11): no creation may begin until the fabric has been searched and the result recorded.
  ReuseCheck:
    intent_shape:        {outcome, inputs, outputs, domain}
    results:             [{capability_id, match_score, reuse_mode: use_as_is|compose|extend, gaps[]}]
    decision:            reuse_as_is|compose_existing|create_new
    rationale:           text
    searched_by:         Actor
    searched_at:         timestamp
    # create_new requires: results is empty OR every result has recorded gaps,
    # AND a human or agent rationale is present.


DESIGN DECISION. Creation is blocked, not merely discouraged. A BuildRun cannot exist without a ReuseCheck linked to
the originating Behaviour Statement. This is the single most important mechanism for the enterprise compounding effect the
strategy promises ("every creation makes the next creation easier").


7.5 Composition

Capabilities compose at design time and dynamically at runtime. The composition layer must:

   Resolve a business intent to a capability graph (not a fixed application).
   Compose different sequences for different scenarios (member-submitted claim, provider-submitted claim, appeal, payment
   inquiry, new product) without a separate application for each.
   Respect authority and policy at every hop — a composition's effective authority is the minimum of its parts.
   Produce complete evidence across the composition, not per-component only.


7.6 Lifecycle, ownership and retirement

NON-NEGOTIABLE. Every capability receives, at creation: a value hypothesis; a designated owner; a review date; an operating-
cost ceiling; a minimum-use threshold; performance and risk thresholds; an expiration condition; and an automated retirement
path.

Retirement is a first-class capability. THREAD must be able to retire a capability automatically when its evidence no longer
justifies existence, while preserving data and audit continuity. "Deleting unnecessary capability is as valuable as launching
new capability."

Builder behaviours the system must make easy: build smaller; minimise dependencies; prefer reusable primitives; avoid
speculative features; design for removal; ignore sunk cost. The system should surface a capability's own replaceability and
retirement cost as first-class metadata.
PART 8 — The creation loop THREAD must trace

This is the operational heart of THREAD's mandate. THREAD does not build; it compiles, dispatches, records and proves.

  Read Part 8A immediately after this part. It specifies the front of the loop — the framing sessions in which business
  needs are articulated by the Business Co-Creator and the AI Builder, extracted from co-creation artifacts, logged as operating
  objects, and connected so that dependencies and relationships can be captured and visualised. Intent enters the enterprise
  there. If extraction is absent, the graph is empty; if it is sloppy, every downstream object inherits the error.



8.1 The full loop

     Value Signal ──► Value Mission ──► Value Cell
           │                                    │
           │                    ┌──────────────┴──────────────┐
           │                    ▼                              ▼
           │            AI prepares (pre-session)      Value Burst (human present)
           │            · analyse signal, workflow,      · Intent compression
           │              operating data                 · Experience generation
           │            · review policies/controls       · Live interaction
           │            · search Capability Fabric       · Autonomous challenge
           │            · draft Intent Model + Contract · Refinement
           │            · build disposable probe         · Controlled exposure
           │            · identify the smallest          · Observe and decide
           │              unanswered human questions
           │                    │                              │
           │                    └──────────┬──────────────────┘
           │                               ▼
           │                    Behaviour Statements confirmed
           │                               ▼
           │                    CreationPrompt compiled ◄── ReuseCheck recorded
           │                               ▼
           │               dispatched to BuildPlatform (Lovable | Claude Code | Codex | Cursor | Grok Bots)
           │                               ▼
           │                    BuildRun ──► BuildArtifact ──► WorkingSkeleton
           │                               ▼
           │          Continuous evidence: TestRun · SimulationRun · AdversarialRun · ModelEvaluation
           │                               ▼
           │                    Production Shadow (compare → learn → earn authority)
           │                               ▼
           │               ExposureAuthorization (progressive, risk-gated, rollback armed)
           │                               ▼
           │                    ProductionOutcome ──► ValueMeasure
           │                               ▼
           └────────────────────── Compound: Lesson → ReusablePrimitive → MarketplaceAsset


AI continues after the human burst ends. THREAD must hold and display the autonomous work stream: bounded changes
implemented, simulations run, alternatives prepared, production evidence analysed, risk and value monitored, mission memory
updated, and the next human decision assembled.


8.2 What THREAD records at each step

 Step                 Objects created                               Non-negotiable requirement

 Signal               ValueSignal                                   Must contain the observed condition and evidence. A signal whose
 detected/enriched                                                  primary content is a requested solution is flagged by the
                                                                     RequestedSolutionWithoutCondition detector

 Mission              ValueMission , MissionContract                Must satisfy the mission formula. No activated mission without
 accepted/activated                                                 an empowered Co-Creator — a detector enforces this
 Step                     Objects created                                      Non-negotiable requirement

 Cell formed               ValueCell , agent assignments                       Two accountable humans; agent mandates recorded

 Pre-session AI           Draft IntentModel , draft                            Must be recorded as drafts, clearly labelled, never as canon
 preparation               ExecutableOutcomeContract , candidate
                          hypotheses[], disposable probe BuildRun

 Burst conducted           ValueBurst with all seven phase records             Must record a material change of capability, evidence or direction;
                                                                               otherwise flagged as not-a-burst

 Intent confirmed          BehaviorStatement s (confirmed),                    Material decisions require human confirmation, recorded with
                           ConfirmedDecision s, Assumption s,                  actor and authority
                           OpenQuestion s

 Prompt compiled           CreationPrompt , ReuseCheck ,                       Raw captured text is PROHIBITED in the prompt. Guardrails applied
                           GuardrailSet ref, PromptTemplate ref                are enumerated on the prompt object

 Build dispatched          BuildRun with reproducibility_key                   Platform, model route, model version pin, template version,
                                                                               guardrail set version all pinned

 Artifact produced         BuildArtifact , WorkingSkeleton                     Commit/digest recorded; secrets scan result recorded

 Evidence generated        TestSuite , TestRun , SimulationRun ,               Coverage linked to Behaviour Statements; independence class
                           AdversarialRun , ModelEvaluation                    recorded (Part 21.3)

 Shadow                    ShadowRun , Discrepancy                             Comparison to actual outcomes; discrepancy rate computed

 Exposure                  ExposureAuthorization                               Authority level, population, conditions, rollback armed, kill switch,
 authorised                                                                    authorising actor, evidence bundle

 Production                ProductionOutcome , Incident ,                      Observed behaviour, failures, cost, risk indicators, unintended
 observed                  Rollback                                            consequences

 Value measured            ValueMeasure                                        Baseline, target, delta, confidence, source evidence. No value
                                                                               measure ⇒ capability is underperforming

 Compound                  Lesson , ReusablePrimitive ,                        The loop is not complete until something is published for reuse
                           MarketplaceAsset



8.3 Platform integration requirements

 Platform         Integration approach                           Constraints

 Claude           Self-hosted. Dispatch via CLI/agent harness;   Full lineage capture; no production credentials in the build context
 Code             capture stdout, diff, commits, token cost

 Codex            Self-hosted. API/agent harness dispatch        Same

 Cursor           Self-hosted. Dispatch via its                  Same
                  agent/automation surface; capture the
                  applied diff

 Grok / Grok      Self-hosted. Bot/agent invocation; capture     Same
 Bots             bot traces

 Lovable          Vendor SaaS — the only external build          NON-NEGOTIABLE: only content classes cleared for external processing;
                  platform. Dispatch via its API                 restricted/prohibited classes must never be routed here. The platform registry
                                                                 records this per-platform


Common requirements for all five:

 1. Pinned reproducibility. A BuildRun must be replayable from its reproducibility_key . Where the platform cannot
    guarantee determinism, THREAD records that fact and the replay is marked best_effort , not deterministic .
 2. Cost and duration telemetry captured per run, with per-mission and per-cell budget ceilings enforced at dispatch, not
    discovered at month end.
 3. Bidirectional linkage. THREAD knows which prompt produced which artifact; the artifact's repository links back to the
    BuildRun .
 4. Least-privilege build credentials. Build agents run scoped, with no production credentials and no network egress except
    to the platforms and approved dependency sources.
 5. No production data in any build context. Synthetic or approved test data only.


8.4 The burst clock, and the daily pattern

Burst: the reference 60–180 minute structure from Part 1.3.2 is the operating cadence THREAD's Burst surface must support,
with phase timers, per-phase evidence capture and a decision at the end.

Daily pattern THREAD must support (SOURCE):

 Window                Builder experience                                  AI activity THREAD must orchestrate and record

 Overnight             No required human presence                          Monitor, analyse, simulate, prepare, advance bounded work

 Morning               Review intelligence brief                           Present decisions, anomalies, opportunities, stop
                                                                           recommendations

 Value Burst 1         Live creation with Co-Creator                       Generate, challenge, simulate, expose capability

 Autonomous            Human moves to higher-value judgment                Implement, evaluate, document, prepare release evidence
 window

 Value Burst 2         Advance another mission or review production        Adapt capability and authority recommendations
                       evidence

 Compound              Publish useful learning                             Register primitive, pattern, test, failure or guardrail


DESIGN DECISION — reconciling with Carey's direction. Carey's framing ("the business can see a visualization of the build
tomorrow for the requirements they provided today") maps onto this pattern as follows: overnight AI preparation produces
the disposable probe and its visualization, so the Co-Creator arrives to working evidence rather than a blank page. The
human's reaction happens in the burst, not in an asynchronous review queue — because ValueOS replaces delayed UAT with
continuous acceptance. THREAD therefore generates the morning intelligence brief and the burst-time co-creation surface, and
it does not create a separate overnight approval board. This is a refinement of Carey's framing, not a rejection: the visualization
still arrives before the human session; there is simply no approval gate attached to it.


8.5 Change classification on iteration

Every iteration must be classified, because the governance consequence differs sharply:

 Class              Definition                              Governance consequence

  cosmetic          Labels, wording, ordering, styling      Fast delta rebuild; no re-approval; authority unchanged

  behavioural       A changed observable result or rule     Behaviour Statement re-confirmed; tests regenerated; authority re-evaluated

  scope             A new obligation or outcome             Must re-enter mission framing. A scope change is a new Behaviour
                                                            Statement traced to a new or amended Executable Outcome Contract

  architecture      A change to capability composition,     Coherence Agent conformance re-run; capability contract versioned;
                    dependencies or contracts               dependent capabilities notified


NON-NEGOTIABLE: scope changes may not be smuggled through iteration. A detector flags iterations whose diff content
indicates a scope change classified as cosmetic or behavioural.
PART 8A — Framing Sessions and the Co-Creation Extraction
Pipeline

CONFIRMED by the COO (15 Oct 2026). The traceable unit is an object — a Behavior Statement inside a Living Intent
Model — and "requirement" survives only as a human-facing alias so that people with a legacy mindset can follow.

This part specifies the front of the loop: how business needs are articulated in framing sessions, extracted from co-creation
artifacts, logged as operating objects, and connected so that dependencies and relationships can be captured and
visualised.

Why this part is load-bearing. It is the mechanism by which intent enters the enterprise at all. If extraction is sloppy, every
downstream object inherits the error — and a same-day build pipeline will faithfully and quickly produce the wrong thing. If
extraction is absent, the graph is empty and THREAD has nothing to be canonical about. The framing session is where the
operating model is either preserved or lost.


8A.1 What a framing session is

A framing session is a live co-creation working session between the Business Co-Creator (the business owner, closest to the
condition and empowered to decide) and the AI Builder (who frames the problem and directs the autonomous AI workforce),
at which business needs are articulated, challenged and confirmed.

It corresponds to Stage 1 of the Live Build Loop (Frame the outcome), to Value Bust phases 1–4 (intent compression →
experience generation → live interaction → autonomous challenge), and it is the first place a Value Mission's Intent Model
acquires substance.

A framing session is not a meeting. It has no agenda document, no minutes, no action items and no attendees list as its
primary output. Its output is operating objects: needs, behaviour statements, decisions, rules, exceptions, constraints,
assumptions and open questions — each traced to the exact moment it was expressed.

Entry test (SOURCE, and load-bearing): by the end of framing, the Cell must be able to complete this sentence for the
primary outcome —

  For [specific person or situation], we will improve [measurable outcome] by enabling [new business ability], proven by
  [observable production evidence].

If it cannot, the session's output is an unresolved OpenQuestion , not a mission. Do not proceed to build on an incomplete
sentence.


8A.2 The co-creation artifact set — what must be captured

NON-NEGOTIABLE. The pipeline must handle every one of these. They arrive simultaneously, in different modalities, and each
carries different evidence weight.

 Artifact class        Examples                                 Extraction posture

 Live speech           The conversation itself, diarised with   Primary source. Context, never authority — see 8A.5
                       speaker and authority identification

 Live drawing          Whiteboard, canvas, sketched flow,       VLM pass producing structured description: boxes, labels, swimlanes,
                       hand-drawn data model                    arrows, and the relationships they depict. A drawn arrow is a proposed
                                                                dependency, not a confirmed one

 Working prototype     The skeleton or probe built during the   Interaction log: what the Co-Creator actually did, where they hesitated,
                       session, in whatever environment         what they tried twice

 Screen capture        Screenshots and screen recordings of     Anchored to the behaviour statement under discussion at that moment
                       the prototype at key moments
 Artifact class            Examples                                     Extraction posture

 Brought-in                An existing SOP, a policy, a spreadsheet,    Ingested through the standard path, with content-tier classification and the
 documents                 a prior design, a regulator's letter         detection gate before any model call

 Transcribed third-        Recordings of earlier sessions, interviews   Same treatment; note the source is not the Co-Creator and carries different
 party material            with frontline staff, member call            authority
                           recordings

 Chat / thread             The async conversation that continues        Lower evidence weight; frequently where the real clarification happens
                           between sessions

 Structured notes          Anything a participant types during the      Direct input; still requires classification
                           session

 Decision artifacts        Something clicked, chosen or explicitly      Highest evidence weight when the speaker had the authority to decide
                           stated as a decision


Every artifact becomes a CoCreationArtifact object with its own envelope, its content-tier classification, its consent basis,
and its provenance. Artifacts are evidence, not canon. PROHIBITED: treating any artifact as authoritative content in its own
right.


8A.3 The extraction pipeline

     Capture ──► Consent & tier gate ──► Normalise ──► Segment ──► Classify ──► Extract
        │                                                                           │
        │                                                                           ▼
        │                                                              Resolve against graph
        │                                                                           │
        │                                        ┌─────────────────────────────────┤
        │                                        ▼                                  ▼
        │                              Surface contradictions             Find prior decisions,
        │                              and challenges (LIVE)               needs, capabilities (LIVE)
        │                                        │                                  │
        │                                        └────────────┬────────────────────┘
        │                                                     ▼
        │                                        Propose typed objects with
        │                                        provenance spans (DRAFT)
        │                                                     ▼
        │                                        Human confirmation of
        │                                        material items
        │                                                     ▼
        └───────────────────────────────► Confirmed objects → canon → graph
                                                        ▼
                                           Dependencies & relationships computed
                                                        ▼
                                           Web updated · renditions regenerated


 Stage                Requirement

 Capture              Multi-modal, simultaneous, time-anchored. Everything captured against a common session timeline so a sentence and a
                      whiteboard stroke can be correlated

 Consent & tier       ConsentRecord must exist before capture opens. Content-tier classification and the PHI/PAN detection gate run on the
 gate                 transcript before any model call — a framing session about claims will contain PHI. Tier C content hard-blocks; Tier B
                      routes in-boundary only

 Normalise            Audio → diarised text with timestamps; drawing → structured description; prototype → interaction log; documents → text
                      with structure preserved

 Segment              Split into coherent statement units, not fixed windows. A statement unit is the smallest span that can stand as a claim

 Classify             Six-way classification of every unit — see 8A.5. This stage is what stops a transcript becoming a specification

 Extract              Typed objects with mandatory provenance spans. See 8A.4
 Stage                Requirement

 Resolve              Match each extracted object against the existing graph: is this the same need as one raised in session 3? Is this behaviour
                      already confirmed? Is this capability already built?

 Surface (live)       Contradictions, challenges, and prior related objects are pushed into the session while the context is still alive — not
                      batched to a report afterwards

 Propose              Objects are created in draft state with full provenance. They are visible, searchable and traceable immediately — but not
                      authoritative

 Confirm              Material items require explicit human confirmation. See 8A.11

 Connect              Relationships and dependencies computed on confirmation. See 8A.7

 Regenerate           The web, briefs, and any dependent renditions are regenerated; sources changed so renditions go stale


Idempotent and re-runnable. Re-extracting the same session with a better extractor produces a new extraction revision,
diffable against the last — never a destructive overwrite. Extraction improvements must be applicable to historic sessions
without losing confirmations already made.


8A.4 What gets extracted

The canonical capture list (SOURCE — semantic capture, verbatim): business condition · evidence introduced · assumptions
· hypotheses · rules and exceptions · constraints and consequences · confirmed decisions · capabilities used and created ·
scenarios tested · failures discovered · guardrails applied · production exposure authorised · unresolved questions · autonomous
work initiated · evidence required for the next decision.

Mapped to typed objects:

 Extracted as               Object type                                               Notes

 Business condition         ValueSignal (candidate) or NeedStatement                  A condition with measurable character may be a signal; a
                                                                                      need is intent

 Business need              NeedStatement                                             The COO's named unit. See 8A.12

 Evidence introduced        EvidenceRef on the relevant object                        With the artifact and span it came from

 Assumption                 Assumption                                                Must carry a proposed verification method

 Hypothesis                 ValueSignal.hypotheses[] or Assumption                    Explicitly marked unconfirmed

 Rule                       BehaviorStatement (kind: rule)                            Confirmed only by an authority-holder

 Exception                  BehaviorStatement (kind: exception)                       Must name the exception path and who handles it

 Constraint                 Constraint                                                Kind: legal/regulatory/technical/operational/financial/ethical

 Non-negotiable             NonNegotiableConsequence                                  Violation severity + proposed detector
 consequence

 Confirmed decision         ConfirmedDecision                                         Requires an authority-holder. See 8A.5

 Capability used /          CapabilityRef → ComposableCapability                      Triggers a fabric search at articulation time
 created / needed

 Scenario tested            SimulationRun (draft) or EntityExample

 Failure discovered         FailurePattern (draft) or OpenQuestion

 Guardrail applied          GuardrailRef

 Exposure authorised        ExposureAuthorization (only inside a burst,
                            never from conversation alone)

 Unresolved question        OpenQuestion                                              With blocking: bool and needed_by
 Extracted as            Object type                                            Notes

 Autonomous work         BuildRun (draft) reference
 initiated

 Evidence required for   EvidenceRequirement                                    Feeds the confidence bundle
 next decision

 Observable behaviour    BehaviorStatement                                      Condition → observable result → operating constraints

 Affected people /       Actor refs, Persona , Situation
 situations

 Terminology             GlossaryTerm (draft)                                   Definitions proposed, never assumed

 Dependency              DependencyProposal                                     Confirmed into a typed edge in 8A.7
 mentioned


NON-NEGOTIABLE. Every extracted object carries: the source CoCreationArtifact id; a provenance span (speaker +
timestamp range, or character range, or a bounding region on a drawing, or an interaction-log offset); the extractor and model
version; a confidence; and a draft state. An extracted object with no provenance span is discarded before it reaches the
graph — not flagged, discarded.


8A.5 Statement classification — the discipline that prevents transcripts becoming authority

SOURCE risk #2: "Treat transcripts as requirements — Classify statements and confirm material rules, decisions and
consequences. Raw speech is context, not authority."

The Intent Agent's mandate (SOURCE) is to "distinguish questions, suggestions, assumptions, decisions and confirmed behavior."
This is implemented as a six-way classification applied to every statement unit, before extraction:

 Class                      Meaning                           Becomes                                   Confirmation required

  question                  An open enquiry, not a claim      OpenQuestion                              No

  suggestion                A proposal, idea or possibility   Assumption or candidate                   Yes, before it can reach creation
                                                              BehaviorStatement

  assumption                Stated or implied as true         Assumption , with a proposed              No to log; yes to rely on
                            without evidence                  verification method

  decision                  An authoritative choice           ConfirmedDecision                         Yes — explicit. Only if the speaker
                                                                                                        held the authority

  confirmed_behavior        An agreed observable              BehaviorStatement (confirmed)             Yes — explicit
                            behaviour

  context                   Background, narrative,            Evidence only; no object                  n/a
                            anecdote, restatement


NON-NEGOTIABLE — authority-aware classification. The pipeline knows who is speaking and whether that person holds the
authority to make the claim. If a participant without decision authority states a rule as fact, it is logged as a suggestion , not a
decision, and the mismatch is surfaced: "Recorded as a suggestion — the decision authority for this belongs to the Claims
Operations Lead." This is the single most valuable use of speaker-identification, and it prevents the most common failure in
framing sessions: an offhand remark by someone without authority being treated as a requirement.

PROHIBITED. Any path by which a context or question unit can become a BehaviorStatement without an explicit
classification change by a human. A detector ( RawSpeechTreatedAsAuthority ) watches for it.

NON-NEGOTIABLE — no silent materiality. Where the classifier is uncertain whether a statement is a rule, decision or
consequence, it must ask in the session, not guess and not defer. "That sounds like a rule — should I record it as one?" A single
in-session question is cheaper than a wrong object in the graph forever.
8A.6 Logging — how objects enter the graph

Every confirmed extraction produces an operating object with the universal envelope (Part 4.1), plus capture-specific fields:

  FramingSession:
    id, human_ref                    # FS-2026-0184
    mission_ref                      # nullable — a session may precede a mission
    co_creator: Actor                # required
    builder: Actor                   # required
    participants: [{actor, role, authority_held: ref}]
    purpose: text
    opened_at, closed_at
    consent_ref: ConsentRecord       # NON-NEGOTIABLE: required before capture opens
    content_tier: A|B|C              # computed; gates all downstream processing
    artifacts: [CoCreationArtifact]
    extraction_revision: integer
    objects_proposed: count
    objects_confirmed: count
    material_items_awaiting_confirmation: count
    contradictions_surfaced: [DetectorFinding]
    prior_objects_surfaced: [object_id]
    entry_test_result: {completed: bool, sentence: text|null}

  CoCreationArtifact:
    session_ref
    kind: audio | transcript | whiteboard | diagram | prototype_interaction |
          screen_capture | recording | brought_in_document | third_party_recording | chat | typed_notes
    media_ref, duration_or_size
    captured_at, captured_by
    content_tier
    consent_basis
    extraction_state: pending | extracted | failed | superseded
    evidence_weight: primary | corroborating | context_only

  ExtractedStatement:
    artifact_ref
    span: {kind: time_range|char_range|region|log_offset, start, end}
    speaker_actor                    # who said or drew it
    speaker_authority_ref            # what authority they held at that moment
    classification: question|suggestion|assumption|decision|confirmed_behavior|context
    raw_text                         # the verbatim span — evidence, never canon
    extractor, model_route, model_version
    confidence
    resolved_object_ref|null         # the canonical object this became, if any
    state: draft | confirmed | rejected | superseded

  NeedStatement:
    # the business need as articulated by the Co-Creator
    statement                        # "We need members to see their coverage without calling us"
    observed_condition               # the underlying condition, separated from the requested solution
    requested_solution_candidates[] # explicitly hypotheses, per the intent/solution separation
    affected_population[]
    affected_situations[]
    measurable_character             # nullable — if absent, the need is not yet buildable
    baseline|null
    target|null
    value_hypothesis
    authority_holder                 # who owns the need and can confirm it
    origin_session_ref
    status: articulated | elaborated | becomes_mission | deferred | rejected | superseded
    behavior_statements: [object_id] # the needs it decomposes into
    capability_refs: [object_id]
    dependencies: [object_id]


Draft visibility rule. Draft objects are visible, searchable and traceable immediately — so nothing is lost — but they: cannot
reach creation; cannot be counted in any value or coverage measure; and are rendered with a visible draft marker.
PROHIBITED: any measure that counts draft objects as progress.
8A.7 Connection — how dependencies and relationships are derived

Connecting is the whole point. This is the "concept/idea web" the COO described, and it is what turns a collection of captured
statements into an interconnected model.


8A.7.1 Relationship sources, in order of confidence

 Source                        Mechanism                                         Confidence   Confirmation

 Explicit statement            The Co-Creator says it: "this depends on the      High         Auto-link with provenance, marked
                               coverage check"                                                as stated

 Explicit drawing              An arrow drawn on a whiteboard between two        Medium-      Proposed; confirmed on session
                               elements                                          high         review

 Structural decomposition      A need decomposed into behaviour statements       High         Derived from the extraction
                                                                                              structure

 Capability reference          A behaviour statement names a capability that     High         Auto-link to the capability
                               exists in the fabric

 Prior-object resolution       The same need or behaviour was captured in an     High         Merge or link, with the merge
                               earlier session                                                reversible

 Co-occurrence in a            Two objects appear in the same utterance with a   Medium       Proposed
 statement unit                relational verb

 Semantic + graph inference    Embedding proximity plus shared actors, data or   Low-         Always proposed, never auto-
                               capabilities                                      medium       confirmed

 Contradiction                 Two statements cannot both hold                   n/a          Always surfaced, never auto-
                                                                                              resolved


NON-NEGOTIABLE. Every proposed relationship carries its source, its confidence, and its provenance span, and appears in the
session review queue. Nothing below "explicit statement" is auto-confirmed into canon. A wrongly-auto-linked
dependency silently corrupts every downstream impact analysis, and it is very hard to notice — which makes it the most
dangerous automated action in this part.


8A.7.2 New relationship verbs

  articulated_in      NeedStatement      -> FramingSession
  extracted_from      {any}              -> CoCreationArtifact
  expressed_as        NeedStatement      -> BehaviorStatement                    # need decomposes into behaviour
  addresses           BehaviorStatement -> NeedStatement                         # inverse, for traversal
  depends_on          NeedStatement      -> NeedStatement
  depends_on          BehaviorStatement -> BehaviorStatement
  blocks              {any}              -> {any}
  relates_to          {any}              -> {any}                                 # weak, typed on confirmation
  contradicts         {any}              -> {any}                                 # symmetric, always surfaced
  supersedes_understanding_of NeedStatement -> NeedStatement                       # intent evolves; history preserved
  clarifies           ExtractedStatement -> {any}
  supersedes_statement ExtractedStatement -> ExtractedStatement
  raises_question     {any}              -> OpenQuestion
  resolves_question   ConfirmedDecision -> OpenQuestion
  needs_capability    NeedStatement      -> ComposableCapability
  references_capability {any}            -> ComposableCapability
  mentioned_by        {any}              -> Actor
  affected_by_change {any}               -> {any}                                 # computed, for impact analysis


8A.7.3 Dependency derivation rules
   A dependency is directional and carries a kind: data , sequence , authority , capability , decision . A bare
   "depends on" is insufficient for impact analysis.
   Transitive closure is computed, not stored as edges. The graph answers "what transitively depends on X" by traversal, so
   a new edge never requires rewriting others.
   Cycles are defects. A cycle in depends_on among needs or behaviour statements indicates a modelling error and is
   surfaced immediately, with the cycle rendered.
   Every edge states its origin: stated, drawn, decomposed, resolved, inferred. Inferred edges are visually distinct in every
   view.


8A.7.4 Cross-session continuity — the highest-value behaviour in this part
DESIGN DECISION, and the most valuable single capability in the framing pipeline.

When a need or behaviour statement is articulated, THREAD immediately surfaces, in the session:

 1. Prior related needs — "you articulated a closely related need in FS-2026-0041 on 12 August; here it is."
 2. Prior decisions — "this was decided on 3 September; the decision was X, by Y, under authority Z."
 3. Prior behaviour statements — "this behaviour was confirmed in an earlier session and is already built."
 4. Existing capabilities — a fabric search fires at articulation, so the Co-Creator learns in the session that a capability already
    performs most of this outcome (reuse-first applied at the earliest possible moment, where it saves the most).
 5. Contradictions — "this conflicts with a decision recorded on 3 September: [quote]. Which stands?"
 6. Disproven assumptions — "an assumption underlying this was disproven in production last month."

Why this matters more than it looks. The most expensive failure in enterprise delivery is not building the wrong thing — it is
re-deciding something already decided, and not knowing it. People forget. Sessions happen months apart, with different
participants. The enterprise has the memory; the people do not. THREAD's single greatest contribution at the framing stage is
being the memory that speaks up at the moment of articulation.

NON-NEGOTIABLE: this surfacing happens live, in the session, not in a report afterwards. A post-session summary is too late
— the decision has already been made out loud.


8A.8 The dependency and relationship web — the visualisation

This is the view the COO originally described as the "wiki": needs and behaviour statements, connected, with dependencies and
relationships visible.

Required views:

 View                  Purpose

 Need Web              Needs as nodes, depends_on / relates_to / contradicts as edges. Answers: what does this need depend
                       on, what depends on it, and what conflicts with it

 Decomposition         Need → behaviour statements → capabilities → evidence. The vertical trace from articulated intent to proven
 Tree                  behaviour

 Session               One framing session and everything it produced, laid out as a connected field. Useful for reviewing a session and for
 Constellation         showing the Co-Creator what they actually decided

 Dependency Web        Behaviour statements only, force/layered layout by dependency. Where the cycles and the single-point-of-failure
                       clusters show up

 Contradiction Map     Only conflicting objects, clustered by subject, each edge carrying both statements side by side

 Unresolved Frontier   Needs with no behaviour statement, behaviour with no evidence, questions unanswered, assumptions unverified —
                       the honest picture of what is not yet understood

 Cross-Session         Every need and behaviour statement plotted against session date, with supersedes_understanding_of edges
 Timeline              showing how intent evolved

 Impact Overlay        Forward closure from any need or behaviour statement: what must be re-verified if this changes


Required interactions: hover isolates a neighbourhood; click any edge for "why is this connected?" (verb, origin, confidence,
provenance span, who confirmed it, when); inferred edges visually distinct from stated ones; draft objects visually distinct from
confirmed ones; deep-linkable state; export to image and data.
8A.9 The framing session surface

NON-NEGOTIABLE — the tool must show, live, what it is capturing. The Co-Creator must be able to correct the machine's
understanding while the context is alive. This is the show-react-refine loop applied to capture itself, and it is the difference
between a session that produces a trustworthy model and one that produces a transcript.

Required elements:

 Element                  Behaviour

 Live transcript pane     Diarised, time-anchored, with speaker and authority indicated

 Live extraction pane     Objects appearing as they are articulated, each showing its classification (question / suggestion / assumption /
                          decision / confirmed behaviour) and its draft state

 Classification chips     The Co-Creator can re-classify in one click: "no, that was a suggestion, not a decision." Corrections are recorded as
                          signals for extractor improvement

 Contradiction prompt     Challenge Agent interrupts with a specific, quoted contradiction and asks which stands

 Prior-object prompt      Surfaces related prior needs, decisions, capabilities — with the option to link, supersede or dismiss

 Capability reuse         Fires on articulation: "a capability that performs most of this exists — would you like to experience it before
 prompt                   creating anything?"

 Dependency capture       Stated and drawn dependencies appear as proposed edges, confirmable in the moment

 Prototype pane           The shared working skeleton or probe, with the behaviour statement currently under discussion highlighted

 Entry-test tracker       The completion of the framing sentence, visible and updated live. It is the session's readiness indicator

 Material items rail      Running list of items awaiting confirmation, with a count. The session should not close with an unaddressed
                          material item without an explicit deferral

 Consent and tier         Always visible: consent basis, content tier, and which routes are permitted
 indicator

 No minutes, no action    PROHIBITED. The session produces objects, not a document
 items


Autonomous work runs alongside the session. The Simulation Agent, Adversarial Agent and Coherence Agent work while
the humans talk, so their findings are available before the session ends rather than after.


8A.10 Session review and confirmation

NON-NEGOTIABLE — material items require explicit human confirmation. Material means: rules, exceptions, non-
negotiable consequences, decisions, and confirmed behaviour. Non-material items (context, suggestions, assumptions,
questions) are logged without blocking.

The review is short and structured:

 1. Every draft object, in dependency order — confirm, edit, re-classify, or reject.
 2. Every proposed relationship — confirm or discard. Inferred ones default to discard.
 3. Every contradiction — resolve, defer with an owner and a date, or record as accepted ambiguity.
 4. The entry test — complete, or the session yields an OpenQuestion instead of a mission.
 5. The unresolved frontier — what is still open, deliberately.

NON-NEGOTIABLE: a session may close with unresolved items, but never with unrecorded unresolved items. Explicit deferral
is a legitimate outcome and is recorded as such; silence is not.

Confirmation is captured on the object ( confirmed state, actor, authority used, timestamp) — the same mechanism as any
other ValueOS confirmation. There is no separate sign-off workflow, no approval record, and no gate. PROHIBITED: a session
approval state.
8A.11 New MCP tools

  start_framing_session(mission_ref?, co_creator, builder, participants[], purpose) -> session_id
  capture_artifact(session_id, kind, media) -> artifact_id
  extract_from_artifact(artifact_id, revision?) -> [ExtractedStatement]
  classify_statement(statement_id, classification, by) -> statement
  log_need(session_id, statement, observed_condition, ...) -> NeedStatement
  log_behavior_statement(session_id, condition, observable_result, constraints[]) -> BehaviorStatement
  link_need_to_behavior(need_id, behavior_id) -> edge
  propose_dependency(from_id, to_id, kind, origin, provenance) -> edge
  confirm_object(object_id, by, authority_used) -> object
  confirm_relationship(edge_id, by) -> edge
  surface_prior_objects(session_id, statement) -> {needs[], decisions[], capabilities[], contradictions[]}
  find_contradictions(scope) -> [DetectorFinding]
  render_need_web(root_id, depth, filters) -> graph_payload
  render_dependency_web(scope, filters) -> graph_payload
  render_unresolved_frontier(mission_ref) -> [objects]
  close_framing_session(session_id, entry_test_result) -> session_summary


Every tool obeys the ToolContract in Part 12.3, including requires_policy_evaluation and provenance_capture .


8A.12 New detectors

Added to the set in Part 11.9. Each requires an owner, an age and a resolution.

 Detector                             Signal

  RawSpeechTreatedAsAuthority         A context or question unit promoted to a BehaviorStatement or decision without explicit
                                      human re-classification

  UnextractedDecision                 A decision appears to have been made in a session (stated, agreed, no dissent) but no
                                      ConfirmedDecision object exists

  BehaviorWithoutNeed                 A BehaviorStatement with no parent NeedStatement — behaviour with no articulated intent

  NeedWithoutBehavior                 A NeedStatement past its elaboration window with no behaviour statement — intent never made
                                      concrete

  NeedWithoutMeasure                  A need with no measurable character, baseline or target — not buildable, exactly the "requested
                                      solution with no measurable condition" failure

  UnextractedSession                  A session artifact exists with no extraction revision — capture happened, nothing was logged

  SessionWithoutConsent               A CoCreationArtifact with no active consent basis

  ContradictionUnresolved             A surfaced contradiction still open past its resolution window

  AssumptionUnverified                An assumption relied upon in a confirmed behaviour with no verification attempt

  ProvenanceSpanMissing               An object in the graph with no attribution to a source artifact and span (should be impossible;
                                      monitors for bypass)

  DraftObjectUsedAsBasis              A build or exposure conducted on the basis of a draft object

  DraftCountedAsProgress              Any measure counting draft objects

  SessionProducingMinutes             A session whose primary output is a document rather than objects

  DependencyCycle                     A cycle in depends_on among needs or behaviour statements

  InferredEdgeAutoConfirmed           A low-confidence inferred relationship confirmed without a human

  FramingSessionAsMeeting             A session with a scheduled duration, an agenda artifact and no objects produced
8A.13 Non-functional requirements specific to capture and extraction

 Requirement                        Target

 Live extraction latency            Object appears in the live pane within 3 s of the statement unit ending (p95)

 Live contradiction detection       Within 5 s (p95)
 latency

 Prior-object surfacing latency     Within 3 s of articulation (p95) — requires the fabric search and the vector query to be warm

 Capability reuse search at         Within 2 s (p95)
 articulation

 Session close → graph              Within 60 s (p95), including dependency computation
 updated

 Extraction accuracy                Measured per class on a hand-labelled corpus; published, never asserted. Report precision and recall
                                    separately per classification and per object type

 Session capture durability         Zero loss. Capture is buffered locally and streamed; a network failure must not lose a session

 Consent enforcement                A capture cannot open without an active ConsentRecord ; verified by test

 Tier enforcement                   The detection gate runs on the transcript before any model call; verified by test

 Re-extraction safety               Re-extraction never destroys a confirmation; verified by test

 Accessibility                      Live panes navigable by keyboard; the transcript is screen-reader accessible; the web views have non-visual
                                    equivalents



8A.14 Risks specific to this pipeline

 #      Risk                                      Severity    Countermeasure

 F1     Transcripts become the                    Critical    Six-way classification; authority-aware classification; explicit confirmation for
        specification — the named ValueOS                     material items; RawSpeechTreatedAsAuthority detector; raw speech never
        failure mode                                          enters a creation prompt

 F2     An offhand remark by a non-               Critical    Speaker-authority identification; classification downgrade with a visible note; the
        authority-holder becomes a                            false-authority path is a test case
        requirement

 F3     Extraction error propagates into a        High        Draft objects cannot reach creation; provenance span mandatory or the object is
        same-day build                                        discarded; re-extraction is idempotent; drafts are not counted in any measure

 F4     Cross-session memory fails — a            High        Live prior-object surfacing is a required capability with a latency budget, not a nice-
        decision re-litigated because the                     to-have; tested by a scenario where a decision from a prior session must be
        tool didn't surface it                                surfaced

 F5     The dependency web becomes a              Medium      Sparse default; inferred edges visually distinct; type and origin filters; honest edge
        hairball                                              budgets; cycles rendered explicitly

 F6     PHI captured in a framing session         Critical    Consent gate; detection gate on the transcript before any model call; Tier B in-
                                                              boundary routing; Tier C hard block; retention class; access logging

 F7     Surveillance drift — session              Critical    Participation analysis is PROHIBITED; no individual activity metrics derived from
        analysis used to evaluate                             sessions; refusal at generation time; explicit board-level policy
        participants

 F8     Capture fatigue — participants            Medium      Capture is ambient where consented and permitted; the object output is the point,
        perform for the recorder and the                      not the recording; sessions remain conversations, not ceremonies
        model goes shallow
 #       Risk                                Severity   Countermeasure

 F9      Extraction is good but nobody       High       Material items rail; session cannot close with unaddressed material items without
         confirms, so the graph fills with              explicit deferral; draft age is a monitored metric with an owner
         drafts

 F10     Confirmation becomes clerical       High       Review is dependency-ordered and short; reject is as easy as confirm; sampling-
         throughput — people rubber-                    based QA rather than per-item review where volume is high; confirmation latency
         stamp the review                               and edit rate are tracked

 F11     Session artifacts are treated as    High       Artifacts are evidence objects by construction; the canon separation is a structural
         canon                                          rule and a test




8A.15 Where this part sits in the build sequence

This pipeline is not a late addition. It is the front of the loop and must be built early, because everything downstream depends
on the graph having objects in it.

Revised placement in Part 20:

      Phase 1 (Canon and envelope) — unchanged, plus the FramingSession , CoCreationArtifact , ExtractedStatement ,
      and NeedStatement object types join the registry.
      Phase 2 (Operating Graph core) — unchanged, plus the Need Web, Dependency Web, Decomposition Tree and
      Contradiction Map views.
      NEW Phase 2B — Framing Session capture and extraction (4–5 weeks): consent and tier gating; multi-modal capture
      with a common timeline; normalisation and segmentation; six-way classification with authority awareness; typed extraction
      with mandatory provenance spans; live extraction pane; live contradiction and prior-object surfacing; session review and
      confirmation; re-extraction safety. Exit evidence: a real framing session between a business Co-Creator and a Builder
      produces a confirmed object set with 100% provenance coverage; a deliberate offhand remark by a non-authority
      participant is classified as a suggestion and the mismatch is surfaced; a deliberate contradiction with a prior session is
      detected live; re-extraction with a changed extractor preserves every prior confirmation; the entry test is tracked and
      reported.
      Phases 3 onward proceed as specified, now operating on a graph that actually contains intent.

DESIGN DECISION. Running this at Phase 2B rather than later means the pilot workstreams populate the graph with real intent
early, so every subsequent phase — authority, fabric, evidence, creation loop — is developed and tested against real objects
rather than fixtures. It also front-loads the highest-risk unknown: whether extraction quality is good enough to be trusted.
PART 9 — Production Shadow

9.1 Purpose

SOURCE. A Production Shadow is a capability running against representative or actual production events without controlling
the real outcome. It is not a test environment. It exists to compare intended behaviour with reality while protecting the real
outcome — allowing learning to begin early without granting premature control.

  Real Events ──► Shadow Capability ──► Compare ──► Learn ──► Earn Authority



9.2 What THREAD must do

 Requirement                                                 Detail

 Receive representative production events                    An event tap with permission-aware filtering; no write-back

 Operate without affecting the real result                   Structurally isolated; read-only on production systems

 Compare shadow output with actual decisions and outcomes    Automatic comparison producing Discrepancy objects

 Analyse discrepancies automatically                         Categorise by cause hypothesis; surface patterns, not just counts

 Generate confidence, failure, risk and bias evidence        Feeds the ConfidenceBundle and the authority decision

 Identify conditions requiring human judgment                Specific cases escalated with context, not a generic "review needed"

 Earn authority progressively                                Shadow results are the primary evidence for ladder promotion (Part 6.2)




9.3 Shadow data rules

   Shadow processing respects the same permission model as production. A shadow capability cannot see data its consumers
   could not see.
   Shadow outputs are stored separately and are never served as production decisions.
   Where the underlying data is sensitive, shadow analysis runs in-boundary only.


9.4 Discrepancy analysis as a first-class capability

Discrepancy rate is the primary authority-earning metric and the primary demotion trigger. THREAD must support: discrepancy
rate per capability per version; clustering of discrepancies by cause; a requirement that every discrepancy class above threshold
has an owner and a disposition; and automatic demotion when the rate breaches the bound.
PART 10 — The Generation Layer

10.1 The core rule

NON-NEGOTIABLE (P1). The Operating Graph is the only authority. Every human-facing artifact — explanation, briefing,
interface, diagram, simulation, walkthrough, export, audio, video, role-specific scenario, decision tree — is a rendition,
generated from canon, for a specific person and moment.

"A generated rendering never becomes the canonical model."


10.2 Rendition requirements

 Requirement           Enforcement

 Stamped               Every rendition carries source object refs, generator (agent + model route), generated_at , and a content hash of
                       its sources

 Expiring               expires_when: source_content_hash_changes . When any source object changes, the rendition becomes
                        stale and must be regenerated or deleted

 Never editable into   Renditions are read-only. Editing a rendition produces a proposed canon change as a separate object with its own
 canon                 review path

 Permission-scoped     A rendition is generated for an identity, purpose and context. It must never be served to a different permission
                       context, even if the underlying objects overlap

 Non-authoritative     Every rendition visibly distinguishes generated explanation from canon, and cites the canon objects it renders
 by display

 Deletable             Stale renditions are deleted on a schedule, not merely hidden

 No silent             Multiple agents may generate different explanations of the same canon, but they may not create different definitions.
 multiplicity          Conflicting definitions raise a CanonFragmentation finding (a named failure mode)




10.3 Generation kinds the system must support

From the source's list of how ValueOS generates material for a person and moment: 60-second audio briefing · interactive
visual explanation · short generated video · conversational walkthrough · role-specific scenario · decision tree · live
demonstration · technical explanation · executive narrative.

Plus the operational kinds THREAD needs: capability explanation · evidence chain rendering · impact narrative · morning
intelligence brief · burst brief · value narrative · council briefing · Board/Audit Committee report.


10.4 The morning intelligence brief — a required generated artifact

Generated overnight, per Builder, from the graph. Contains only what requires judgment: decisions requiring input,
anomalies, opportunities, and stop recommendations. Not a status report. PROHIBITED: any generated artifact whose
primary content is progress-against-plan, task list, or activity summary.


10.5 Canon change and the challenge mechanism

NON-NEGOTIABLE (P15). Canon objects may be changed only through a recorded path: proposed change → evidence →
challenge window (counter-arguments invited; Challenge Agent actively produces them) → decision by the steward under
stated authority → new version with the old version preserved → dependent renditions marked stale → dependent capabilities
notified.
PROHIBITED: silent drift of canonical definitions, authority rules or consequential guardrails. The system must detect and
report canon drift as a live metric.
PART 11 — Surfaces

Each surface is a generated interface appropriate to the moment, not a fixed set of permanent screens. NON-NEGOTIABLE for
all surfaces: permission-aware at retrieval (P8); keyboard navigable; WCAG 2.2 AA; no decorative chrome; every number is drill-
through to its evidence.


11.1 Value Companion

The personal, contextual surface embedded in the employee's normal work surface.

Must understand: the employee's responsibilities and current context; permitted data and actions; active missions and signals;
available capabilities; relevant guardrails and authority; recent enterprise learning; and how the operating model applies to the
work occurring now.

Must respond to a statement with evidence — the canonical example from the source:

  Employee: "We manually correct this report every Monday." THREAD: "This appears to be a potential Value Signal. I found
  173 similar corrections over the last 90 days, requiring approximately 96 employee hours. I can create the signal, connect it
  to the related data-quality mission, or continue monitoring it."

Must exhibit behavioural challenge — coaching, never punitive, intrusive or surveillant:

   "You are beginning with a requested application. What measurable condition must change?"
   "This meeting appears designed for status reporting. I can generate the evidence brief automatically. Should the time be
   used for a Value Burst?"
   "You are writing detailed requirements before involving a Builder. I can initiate live co-creation."
   "An existing capability may already perform most of this outcome. Would you like to experience it before creating
   anything?"


11.2 Value Mission Runtime

PROHIBITED: this surface must not resemble a project-management tool or a backlog with renamed fields. Absence is testable
(Part 21.4).

Must show: why the mission exists; current business condition and evidence; target condition; Co-Creator and Builder; active
value and cause hypotheses; available composable capabilities; the current working intervention; production evidence and
confidence; important uncertainties; authority and risk boundaries; autonomous AI work underway; the next consequential
human decision; and mission continuation, expiration and stop conditions.

Must allow conversational action (the source's verb list, implemented as tools in Part 12): create a Value Signal from this
evidence; determine whether this belongs to an existing mission; find the right Business Co-Creator; form a Value Cell; begin a
Value Burst; find capabilities that may produce this outcome; run adversarial and policy simulations; enter a Production
Shadow; expose this to 2% of eligible events; show evidence since the last human decision; publish this capability to the
Community.

The interface is generated around the current decision, not organised into permanent menus and screens.


11.3 Operating Graph Explorer

The graph-first surface. This is where the connected operating model is seen and navigated.

Required views:
 View                  Purpose

 Canon Navigator       Browse and traverse the operating model's own objects — concepts, principles, rules, protocols, guardrails, patterns,
                       anti-patterns, metrics, authority

 Mission               A mission, its cell, its bursts, its behaviours, capabilities and evidence as a connected field
 Constellation

 Nebula                The whole graph at level-of-detail, clustered by domain and mission (the "spider web" view, reframed: it shows the
                       operating model, not a document repository)

 Focus                 One object plus n hops, with per-edge provenance

 Path Finder           Shortest and all-paths between two objects — the "how are these connected?" question

 Impact / Blast        Radial forward closure from a change target, grouped by affected object type and owner
 Radius

 Authority Overlay     Colour nodes by authority level and risk tier; surface every capability operating above its earned authority

 Expiration Overlay    Surface every object approaching or past its review date, expiration condition or minimum-use threshold

 Detector Overlay      Surface every active anti-pattern finding against the objects that produced it


Required interactions: semantic zoom with clustering and honest edge budgets; "why is this connected?" on every edge (verb,
confidence, evidence, actor, authority, time); deep-linkable view state; export to image and to data.


11.4 Evidence Graph view

The eight-step chain rendered as a first-class, navigable view. For any capability or behaviour, the chain is walked node by
node, each node clickable to its evidence. This view is the answer to "why does this exist and is it still justified?" — and it is the
successor to any notion of a traceability matrix.


11.5 Human Decision Queue

Only the fields in Part 6.5. Time-boxed; shows cost of waiting; supports decide, one clarification, reduce authority, or stop.
PROHIBITED: bulk approve.


11.6 Live Enterprise Value Feed

SOURCE content: newly detected Value Signals; missions seeking a Co-Creator or Builder; Value Bursts beginning now;
capabilities available for reuse; capabilities reused in new contexts; Production Shadows and experiments underway; outcomes
achieved; missions stopped because evidence disproved them; important failures and lessons; new guardrails; employees
seeking collaborators; quantified enterprise value created.

Required behaviours: employees follow domains, missions, capabilities, outcomes or types of learning. The primary action on
any item is "Reuse or remix this capability." Reputation is earned through verified value, capability reuse, useful signals,
important assumptions disproved, learning contributed, and other cells made faster.

PROHIBITED: engagement optimisation, reaction counts, streaks, or any mechanic that rewards visibility over value. A detector
must exist for ValueFeedDriftingTowardEngagement .


11.7 Capability Fabric / Marketplace

Search, inspect a capability contract, see its evidence and value record, compose, reuse, fork, retire. Six skill categories as facets:
Copilot AI, Autonomous Agents, Workflow Automation, Decision Intelligence, Voice AI, Knowledge Intelligence.
11.8 Semantic capture console

Consent-aware session capture with speaker and authority identification; intent, rule, decision and evidence extraction; real-
time clarification and contradiction prompts; shared generated interface and prototype preview; lightweight confirmation of
consequential decisions. Records the conversation, what the enterprise learned, and what changed — not merely a
transcript. Raw conversation remains searchable context; structured, versioned and confirmed operating objects are
authoritative.


11.9 Anti-pattern & legacy-behaviour detector surface

A first-class product capability, not an internal tool. Every one of the fifteen failure modes in Part 1.3.11 is a Detector with
a query, a threshold, an owner role, a remediation hint and a live findings list. Plus the THREAD-specific detectors:

 Detector                                                Signal

  RequestedSolutionWithoutCondition                      A signal or mission whose primary content is a solution with no measurable
                                                         condition

  MissionWithoutEmpoweredCoCreator                       Mission activated with no decision-capable Co-Creator

  DocumentPreparedForHandoff                             A document generated specifically to be handed between people

  AwarenessOnlyRecurringMeeting                          A recurring meeting whose purpose is information distribution

  StandardWorkAwaitingApproval                           Any object waiting in a queue that encoded authority could resolve

  CapabilityCreatedWithoutRegistrySearch                 A BuildRun with no linked ReuseCheck

  BatchThatCouldBeIncremental                            An exposure proposed at full population where incremental exposure is
                                                         available

  HumanMonitoringMachinesCouldPerform                    A human task that is pure observation

  AutonomousActionWithoutEvidence                        Action above the evidence threshold for its authority level

  CapabilityWithoutOwnerTelemetryOrExpiration            Any live capability missing those three fields

  LocalScopeOverEnterpriseValue                          A capability or decision optimised within a silo against mission outcome

  BuilderPerformingAgentWork                             Repeated mechanical work in the graph attributed to a Builder

  UncitableGeneratedAnswer                               Generated guidance with no canon citation

  HighImpactToolCallWithoutPolicy                        Tool call with material side effects and no PolicyEvaluation

  ValueFeedDriftingTowardEngagement                      Feed mechanics rewarding visibility over value

  CanonFragmentation                                     Two active canon objects with conflicting definitions in the same scope

  ScopeChangeClassifiedAsCosmetic                        Iteration diff content indicating scope change under a lower class

  RejectedMeasureInUse                                   Any field, report or dashboard using a rejected measure

  WikiDrift                                              THREAD usage concentrating in browsing/reading rather than acting (see Part
                                                         21.4)

  AuthorityInflation                                     Authority granted above evidence, or granted outside the ladder

  RawSpeechTreatedAsAuthority                            A conversational unit promoted to a Behavior Statement or decision without
                                                         explicit human re-classification (see Part 8A.12)

  UnextractedDecision                                    A decision appears to have been made in a session but no
                                                         ConfirmedDecision object exists

  BehaviorWithoutNeed                                    A Behavior Statement with no parent NeedStatement

  NeedWithoutBehavior                                    A need past its elaboration window with no behavior statement
 Detector                                                Signal

  NeedWithoutMeasure                                     A need with no measurable character, baseline or target

  UnextractedSession                                     A session artifact exists with no extraction revision

  SessionWithoutConsent                                  A capture artifact with no active consent basis

  ContradictionUnresolved                                A surfaced cross-session contradiction still open past its window

  AssumptionUnverified                                   An assumption relied upon in confirmed behavior with no verification attempt

  ProvenanceSpanMissing                                  An object in the graph with no attribution to a source artifact and span

  DraftObjectUsedAsBasis                                 A build or exposure conducted on the basis of a draft object

  DraftCountedAsProgress                                 Any measure counting draft objects

  SessionProducingMinutes                                A session whose primary output is a document rather than objects

  DependencyCycle                                        A cycle in depends_on among needs or behavior statements

  InferredEdgeAutoConfirmed                              A low-confidence inferred relationship confirmed without a human

  FramingSessionAsMeeting                                A session with a scheduled duration, an agenda artifact and no objects
                                                         produced


Design requirement: every detector finding has an owner, an age, a state and a resolution. Findings accepted as risk are
recorded with an approver and an expiry. A detector without an owner is worse than no detector, because it manufactures
the appearance of governance.


11.10 Simulation Studio

Employees enter simulated operating situations rather than completing courses. Example scenario from the source: "A business
executive asks you to build a new customer-service application. What do you do next?" AI portrays the executive, customer,
frontline employee, AI Builder, regulator/policy constraint, production failure and conflicting stakeholder. The scenario changes
in response to choices. Evaluation covers: began with the outcome; identified evidence; avoided prematurely selecting a
solution; formed the appropriate Value Cell; composed existing capability before creating; used progressive exposure; applied
appropriate human judgment; captured reusable learning.

NON-NEGOTIABLE: new-employee onboarding culminates in a real, low-risk Value Mission, not course completion.
PROHIBITED: multiple-choice certification, completion percentages as a measure.


11.11 Canon stewardship console

Version history, challenge threads, drift report, steward assignment, review-date compliance, and the canon change workflow.
Restricted access; every change logged.


11.12 MCP gateway surface

The machine-facing entry point (Part 12). Not a human UI, but a required surface with its own health, quota, audit and
provenance views.
PART 12 — Agent-executable surface

12.1 Why this is non-negotiable

ValueOS names "a knowledge base that cannot initiate action" as a prohibited outcome. THREAD must be executable, not
readable. Every meaningful operation is a callable tool.


12.2 Required tool set

The twelve tools named in the ValueOS source (implement exactly, with these names):

 Tool                              Purpose                                                Authority required

  detect_value_signal              Create a signal from evidence                          None (any employee)

  score_value_signal               Score magnitude, urgency, value, confidence            None

  find_related_missions            Locate missions/capabilities related to a condition    None

  create_value_mission             Establish a bounded mission from a promoted signal     Named Co-Creator required

  recommend_value_cell             Propose Co-Creator + Builder + agent configuration     None (recommendation)

  start_value_burst                Open a burst session with phase timers and capture     Cell member

  search_capability_fabric         Intent-shaped capability discovery                     None

  run_adversarial_simulation       Adversarial / misuse testing against a capability      Cell member

  request_exposure_authority       Request productive exposure authorisation              Authority engine decides; escalation as
                                                                                          required

  monitor_outcome_evidence         Retrieve production and value evidence                 Permission-scoped

  publish_reusable_capability      Publish a primitive to the fabric and marketplace      Steward or owner

  detect_legacy_behavior           Evaluate observed behaviour against the anti-pattern   None
                                   set


Additional tools THREAD must expose (extended from the source's model, required for the kernels):
  # Operating Graph
  get_object · search_graph · traverse_graph · get_rendition · list_renditions
  propose_canon_change · challenge_canon · get_canon_history

  # Intent
  add_behavior_statement · confirm_behavior_statement · record_decision
  raise_open_question · record_assumption · disprove_assumption · update_intent_model

  # Evidence graph
  explain_capability(authority|decision|evidence|version|tests|exposure|outcome|value|justification)
  trace_chain · blast_radius · find_gaps · find_orphans · find_unowned

  # Creation loop
  compile_creation_prompt · dispatch_build · record_build_run · attach_artifact
  record_iteration · classify_change

  # Authority and governance
  evaluate_authority · request_human_decision · grant_exposure_authority
  withdraw_authority · evaluate_policy · check_guardrails · escalate_to_council

  # Shadow and production
  start_shadow · record_discrepancy · record_production_outcome
  record_value_measure · raise_incident · execute_rollback · arm_kill_switch

  # Assurance
  run_test_suite · run_simulation · run_adversarial · run_model_evaluation
  scan_security · evaluate_accessibility · check_data_use_permission

  # Capability fabric
  get_capability_contract · compose_capabilities · propose_capability
  retire_capability · check_capability_usage

  # Detectors and measurement
  list_detector_findings · resolve_finding · measure_flow · measure_value
  measure_capability_health · measure_community · get_intent_to_value_time

  # Generation
  generate_briefing · generate_explanation · generate_scenario · generate_decision_tree



12.3 Tool contract requirements

NON-NEGOTIABLE. Every tool declares, and THREAD enforces:

  ToolContract:
    name
    purpose
    input_schema          # typed, validated
    output_schema         # typed
    risk_tier             # the tier of the operation itself
    authority_required    # minimum authority level to invoke
    side_effects          # none|creates_objects|external_call|production_effect
    idempotent            # true|false
    requires_policy_evaluation # true for any material side effect
    provenance_capture    # always true
    permission_predicate # evaluated at retrieval, never at render
    rate_limits
    cost_model
    failure_modes
    compensating_action    # how to reverse a partial effect



12.4 Resources, prompts and notifications (MCP)

   Resources: canon objects, capability contracts, mission state, evidence chains, glossary, patterns, design tokens, detector
   findings — all permission-filtered at the resource level.
   Prompts: reusable, versioned prompt templates (governed like templates in Part 4.3 E).
   Notifications: real-time subscription to mission state changes, authority changes, detector findings, value events, decisions
   required. Users and agents subscribe; no broadcast notification streams for awareness (a named failure mode).


12.5 Agent-to-agent

NON-NEGOTIABLE: THREAD must support A2A so specialised agents can discover one another and collaborate across
platforms, using open contracts. THREAD's role: register agent identities, capabilities and mandates in the graph; enforce
authority per agent; record every inter-agent interaction in the provenance chain; and prevent multiple agents with
conflicting definitions — one canon, many agents (a named failure mode).


12.6 Injection defence for an executable surface

Because agents can now act, the injection risk from earlier planning is amplified and must be handled structurally:

 1. Captured conversation and uploaded artifacts are DATA, never instructions. They may inform extraction into typed
    objects; they may never be concatenated into a creation prompt or a tool-call argument as free text.
 2. Prompt compilation is a typed transformation. The CreationPrompt is assembled from typed object fields (Part 4.3 E)
    — a positive-list diffusion, not a text concatenation.
 3. Tool arguments are validated against schemas. An agent cannot pass an instruction where a value is expected.
 4. Detection on captured content, compiled prompts and generated output, with measured recall reported honestly —
    never claimed as complete.
 5. Containment so a failure is bounded: scoped credentials, no production credentials in build contexts, no egress from build
    sandboxes, output scanning, and human-readable diffs before any exposure.
PART 13 — Model, compute, residency and the AI Factory boundary

13.1 Do not rebuild the AI Factory

NON-NEGOTIABLE. The AI Factory already provides unified model access, orchestration, MCP servers, connectors,
observability, CI/CD, and the six capability domains. THREAD consumes those and owns canon, evidence, authority and
generation. Duplicating Factory capability is a named anti-pattern and a design failure.

 Concern                                                                                         Owner

 Model gateway, routing, BYOM                                                                    AI Factory

 Agents and agent orchestration harness                                                          AI Factory

 Connectors, data integration, RAG infrastructure                                                AI Factory

 Build platforms and their runtimes                                                              AI Factory

 Deployment, environments, feature flags, rollback mechanics                                     AI Factory

 Observability and telemetry pipelines                                                           AI Factory

 Canon, object identity, versioning, permissions on canon                                        THREAD

 Authority engine, policy evaluation, guardrails-as-code                                         THREAD

 Evidence graph, provenance ledger, decision records                                             THREAD

 Capability Fabric registry and contracts                                                        THREAD (publish/consume)

 Generation layer and rendition lifecycle                                                        THREAD

 Detectors and findings                                                                          THREAD

 Measurement of value, flow, capability, community                                               THREAD



13.2 Routing and residency

SOURCE. All layers sit inside the MASA-controlled perimeter; models are accessed via API so proprietary data never leaves and
is never used for training. Target state: internally hosted open-weight models (Qwen, Kimi, DeepSeek) via NVIDIA NIM, plus
Bedrock or Foundry for frontier models. Interim: licensed public models under existing enterprise agreements including BAAs
— existing cloud BAAs already cover AI endpoints.

Three content tiers with one router:

 Tier              Content                                          Permitted routes

 A — Cleared       Internal, non-sensitive, on the approved class   Factory gateway: Bedrock/Foundry, licensed public, or in-boundary
                   list

 B—                PHI-adjacent, confidential, compliance-scoped,   In-boundary (NIM-hosted open-weight) or Bedrock/Foundry only — never
 Restricted        contractual                                      Lovable, never a general public endpoint

 C—                Card numbers (PAN), sensitive authentication     No model, ever. Hard block before any processing
 Prohibited        data, secrets, credentials


Two hard routing gates (NON-NEGOTIABLE):

 1. Attestation expiry blocks routing. If a provider's BAA, no-training or zero-retention attestation has lapsed, the router
    refuses to route. A visible failure is better than an invisible disclosure.
 2. Evaluation-suite pass blocks routing. A route may not receive a task class until its evaluation suite passes for that class.
Route by task class, not uniformly: cheap routes for tagging and classification; mid for extraction and summarisation; high
for prompt compilation and any code generation; in-boundary deterministic for guardrail scanning (injection, PHI, PAN),
which must never depend on an external route.


13.3 Invocation logging trap

NON-NEGOTIABLE. Prompt/response invocation logging must be off for Tier A/B routes, or routed to the same access
controls, retention class and audit as the source object. Debug logging that captures prompts recreates exactly the exposure
the perimeter exists to prevent. This is a named check in Part 21.


13.4 The creation prompt must contain no raw captured text

NON-NEGOTIABLE. The CreationPrompt is assembled from typed fields: the confirmed Behaviour Statement, the Executable
Outcome Contract, linked design context (glossary terms, patterns, design tokens, prior capability contracts), the guardrail set,
the prompt template and approved reference examples. Captured transcripts, uploaded documents and tool outputs are never
concatenated into it. Where verbatim content is genuinely required, it enters as a bounded, length-capped, explicitly-quoted
field in a designated non-instruction region, and the template must instruct the model to treat it as untrusted data.


13.5 Cost governance

   Per-build, per-mission and per-cell cost ceilings enforced at dispatch.
   A FinOps view aligning to the strategy's cost-optimisation promise: routing efficiency, usage visibility, shadow-AI
   elimination.
   PROHIBITED as measures: prompt count, agent-call count, token volume as a productivity proxy. Cost is measured for
   control, never for performance.


13.6 Cloud-agnostic deployment

THREAD must deploy identically on the AWS (Bedrock + NIM + Qwen/Kimi/DeepSeek + VPC endpoints + Secrets Manager +
CloudWatch/CloudTrail) and Azure (Foundry + NIM on AKS + Entra ID + Key Vault + Purview + Private Link) reference
architectures. No provider-specific logic above the router.
PART 14 — Compliance, consent and assurance

14.1 Inherit, do not reinvent

SOURCE. The AI Factory claims that because governance is embedded, every AI interaction is logged, audited and policy-
enforced, meeting GDPR, HIPAA and SOC 2 with zero custom compliance work. THREAD must therefore inherit the
Factory's compliance posture and not rebuild it. THREAD's additional obligations are: canon integrity, evidence
completeness, authority correctness, consent records, and the surveillance boundaries — the things the Factory's generic
compliance layer does not cover.


14.2 Regulatory mapping

 Obligation                          THREAD's implementation

 HIPAA — privacy, security, breach   Content tier B/C enforcement at the router; PHI detection before any model call and before any
 notification                        exposure; access logging on every restricted object read; 6-year retention class for compliance-scoped
                                     evidence with legal hold by default; no PHI in any build context

 HIPAA — minimum necessary           Permission predicate pushed into every query including vector and graph search; renditions scoped to
                                     the identity and purpose they were generated for

 PCI DSS                             PAN and sensitive authentication data are Tier C: blocked outright, not redacted. A document
                                     containing card data does not belong in the graph. Hard block, owner notified, compliance officer alerted

 SOC 2 — security, availability,     Complete provenance on every consequential behaviour; append-only audit ledger; change control on
 confidentiality, processing         canon; independent assurance for Tier 4; DR and availability commitments in Part 19
 integrity, privacy

 GDPR — lawful basis, purpose        DataUsePermission per data product; ConsentRecord per capture session; purpose recorded on
 limitation, minimisation, rights    every object and enforced at retrieval; retention and deletion by class; rights handling for personal data
                                     appearing in captured content

 SOX-adjacent financial controls     Irreversibility of the ledger; independent judgment for financial-consequence actions; no self-approval

 Board / Audit Committee             A generated rendition kind; sourced from the graph, expiring, non-authoritative
 reporting



14.3 Surveillance boundaries — PROHIBITED inferences

NON-NEGOTIABLE. The system must expose mission evidence while protecting people. THREAD must not:

   Score employees from private conversations.
   Treat visible activity as contribution.
   Infer performance from prompt volume, message volume, hours connected or agent calls.
   Capture conversations without clear consent and purpose.
   Use coaching data for discipline without a separate, explicit policy and lawful process.
   Rank, rate, leaderboard or compare individual humans on activity.

Required technical control: a prohibited-inference detector runs against every query and every generated rendition. A
rendition that would surface an individual's activity-derived metric is refused at generation time, not filtered afterwards. The
 CapabilityProfile (Part 4.3 H) is evidence-based but is scoped to outcomes, judgement, reuse and value — never to
activity volume.
14.4 Ambient capture

 Requirement                     Detail

 Consent before capture           ConsentRecord must exist and be active; capture session cannot open without it

 Scope recorded                  What may be captured, how it may be used, how long it is retained

 Speaker and authority           Knowing who said what and whether they had the authority to decide it
 identification

 Purpose limitation              Captured content may be used to extract typed objects and to provide searchable context; it may not be
                                 used for any other purpose

 Withdrawal                      Consent withdrawal stops capture and triggers a disposition decision on captured material

 Classification                  Captured content inherits the highest classification of anything discussed




14.5 Retention, deletion and tombstones

   Tombstones, not deletions. Withdrawn objects remain as tombstones so historical traceability resolves.
   Legal hold by default for compliance-scoped evidence.
   Retention by class, with the retention schedule itself a canon object with a steward.
   Physical purge only on the schedule, with an audit record.
   Renditions are deleted, not archived, when stale (Part 10.2) — they are regenerable.
   Right to erasure handling for personal data in captured content: a disposition path that preserves the evidence graph's
   integrity while honouring the obligation, with the compromise recorded.


14.6 Assurance requirements

 Requirement              Threshold

 Independent judgment     Required for every Tier 4 authorisation; the authorising human must be independent of the Builder who created the
                          capability

 Independent              Required for compliance-scoped behaviours; test provenance must be independently_authored (Part 21.3)
 verification

 Adversarial evaluation   Required for Tier 3 and 4 before any exposure

 Penetration testing      Before production exposure of the platform itself, and annually

 Evidence completeness    100% of consequential behaviours carry a complete provenance chain; completeness is a published metric

 Audit readiness          Any assessor question answerable by a query, not a scramble




14.7 Honest limitation — state this explicitly, early

THREAD can prove that a decision was recorded, that evidence was attached, that authority was granted and that a production
outcome was observed. It cannot prove the evidence is true, that a control is effective, or that a recorded decision was
wise. An automated system can produce a complete, well-linked, audit-defensible chain over evidence that a human
fabricated.

Mitigations: evidence provenance (was this test result imported from the execution platform or uploaded by hand?); sampled
independent re-verification; mandatory independent authoring for high-consequence behaviour; and an explicit published
statement of this limitation to the compliance officer and auditors.

Say this before they discover it. Overclaiming here is how the platform loses the compliance function permanently.
PART 15 — Measurement

15.1 THREAD's primary measure

SOURCE. Median time from confirmed business intent to measurable production value. This is the number the platform exists to
move. It must be computed from the graph, displayed prominently, and never manually reported.


15.2 Measure families

 Family                Measures

 Flow                  Signal detection → enrichment; signal → mission activation; activation → first working evidence; first working evidence
                       → Co-Creator validation; validation → Production Shadow; Shadow → bounded production; decision → implemented
                       change; waiting time; human handoffs; human judgment latency

 Quality & trust       Escaped defects and harmful outcomes; intent rework; rule-to-test traceability; automated coverage; policy
                       exceptions; Shadow discrepancy rate; recovery and rollback performance

 Value                 Revenue, retention, conversion, growth; operating cost and human effort; cycle time and throughput; customer and
                       employee experience; quality, error and rework; risk, loss, control, compliance; cash flow and working capital;
                       adoption, use and behaviour change

 Capability            Reuse frequency; outcome success across contexts; reliability and latency; operating cost; policy and exception rate;
                       human intervention rate; autonomy level; dependency complexity; time since last value evidence; retirement eligibility

 Community &           Capability reuse rate; patterns and controls contributed; time for an emerging Builder to own bounded missions;
 compounding           Builder-to-Agent use; business participation; future creation-time reduction

 Platform health       Canon drift rate; rendition staleness and deletion compliance; orphan object rate; evidence-chain completeness;
 (THREAD's own)        authority conformance; detector finding age; alias resolution rate; provenance gaps (must be zero); injection-
                       detection recall (measured, reported)



15.3 Rejected measures — PROHIBITED

The following must be absent from the schema, absent from every dashboard, and actively flagged by a detector if they
appear in human input or in any imported content:

story points · sprint velocity · requirements completed · features shipped without outcome evidence · lines of code ·
prompt count · agent-call count · utilisation as a proxy for value · meetings held · documents produced · training
modules completed.

NON-NEGOTIABLE test: a schema-level test asserts that no field, table, view or API response contains any rejected measure. A
detector flags rejected-measure language. This is one of the tests that proves THREAD has not become a legacy tool (Part 21.5).


15.4 Reporting rules

   Every measure is drill-through to the evidence that produced it. A number without evidence is PROHIBITED.
   No manual status reporting. Live evidence replaces status reporting — "anyone with permission can inspect the evidence
   without asking another person for an update."
   Transparency must not become surveillance (Part 14.3).
   Board/Audit Committee reporting is a generated rendition, expiring, sourced from the graph.
PART 16 — Data model and storage

16.1 Logical model

DESIGN DECISION. Three storage roles, because the access patterns genuinely differ:

 Role                 Contents                                      Technology

 Object store         Every operating object, envelope + body,      PostgreSQL with JSONB for type-specific bodies + a typed column set for the
 (system of           all versions, all states, permissions, and    envelope's queryable fields. This is the transactional truth.
 record)              the authoritative record

 Graph                Objects as nodes, relationships as edges,     Recommended: Apache AGE on the same PostgreSQL — one database,
                      for traversal, impact, pathfinding, closure   one backup regime, one operational surface, Cypher for traversal. Alternative:
                      queries, orphan/cycle detection,              Neo4j if traversal-heavy analytical workloads dominate. Decide on operating
                      detectors                                     capacity, not features.

 Semantic             Embeddings of capability contracts,           pgvector in the same database. A separate index for restricted-class
 discovery            canon objects and intent shapes for           content, never merged into the general index (embeddings of restricted
                      intent-shaped search ("find a capability      content inherit its protection)
                      that does this")

 Evidence and         Append-only ledger of every                   Append-only table with hash chaining; object-locked archival export. Tamper-
 audit                consequential action, decision, authority     evidence is a requirement, not a nicety
                      change and provenance record

 Artifacts and        Build artifacts, diffs, screenshots,          S3-compatible object store, immutable/versioned, with lifecycle policies keyed
 renditions           walkthroughs, generated documents,            to the rendition expiry rule
                      exports

 Search               Human-facing lexical search over objects      PostgreSQL full-text, or OpenSearch if faceting and aggregation demand it.
                      and evidence                                  BM25 quality matters for identifier-heavy content



16.2 Why not a document store

NON-NEGOTIABLE. There is no "document" object type in THREAD. Content is either an operating object (with envelope,
authority, evidence, expiration), an evidence object, or a rendition (generated, stamped, expiring). A free-floating document is
exactly the legacy artifact ValueOS removes — "a document prepared for a handoff."


16.3 Scale assumptions (to validate in the pilot)

DESIGN DECISION — estimates, not facts.

 Dimension                                                                Year 1 estimate                            Year 3 estimate

 Employees with access                                                    300–800                                    all employees

 Business Co-Creators active                                              40–120                                     200+

 Builders (all four layers)                                               60–200                                     300+

 Value Signals                                                            1,000–6,000                                40,000+

 Value Missions                                                           150–800                                    5,000+

 Value Bursts                                                             1,000–8,000                                60,000+

 Operating objects total                                                  100,000–500,000                            5M+

 Relationships                                                            500,000–3M                                 30M+
 Dimension                                                       Year 1 estimate                        Year 3 estimate

 Evidence objects                                                200,000–1,500,000                      20M+

 Renditions (live)                                               20,000–100,000                         500,000

 Concurrency (peak humans)                                       50–200                                 500+

 Agent-initiated calls/second (peak)                             50–500                                 5,000+


Right-size accordingly. Do not build for 100× the year-1 estimate. Do design the schema and service boundaries so a 10×
growth needs no re-architecture — but the operational priority at this scale is backup and rehearsed restore, not distributed
scale. A single-database topology with no tested restore is the largest avoidable platform risk.


16.4 Performance requirements

 Operation                                                                   Target

 Object read by id                                                           p95 < 50 ms

 Graph traversal, 2–3 hops                                                   p95 < 250 ms

 Blast radius (forward closure to depth 6)                                   p95 < 800 ms

 Path find / all paths (bounded)                                             p95 < 1 s

 Intent-shaped capability search                                             p95 < 400 ms

 Evidence chain render (8 steps, full evidence)                              p95 < 1.5 s

 Detector sweep (full corpus)                                                < 15 min; incremental < 60 s

 Rendition generation — brief                                                p95 < 10 s

 Rendition generation — structured explanation                               p95 < 30 s

 MCP tool call (non-generation)                                              p95 < 300 ms

 Graph view first paint (clustered)                                          < 300 ms

 Graph view interactive at rendered node count                               ≥ 30 fps at 20,000 rendered nodes



16.5 Graph rendering strategy (the Nebula view specifically)

Because the graph will reach millions of edges, the rendering strategy is a build requirement, not a detail:

 1. Server-side precomputed layouts per view and per cluster. The browser never solves a large layout.
 2. Level-of-detail aggregation — cluster super-nodes at low zoom, resolved labels above a threshold.
 3. Incremental subgraph loading — serve the top level, fetch neighbours on demand.
 4. Honest edge budgets — cap rendered edges per view and state the cap ("showing 500 of 3,412").
 5. Precomputed cluster summaries so global questions are answerable without brute-force traversal.
 6. Deep-linkable view state for every view (nodes, filters, layout, time, authority overlay).
 7. Sparsity by default. The default view is deliberately sparse; detail is added by the user. A dense hairball is the failure mode
    of every graph tool ever built.
PART 17 — Service decomposition and API surface

17.1 Services

DESIGN DECISION. Bounded services aligned to the kernels. Each owns its data; no service reads another's tables.

 Service                Responsibility                                                                    Owns

 Canon Service          Object identity, versioning, lifecycle states, envelope integrity, canon change   All operating objects (the system
                        workflow, challenge threads, drift detection                                      of record)

 Graph Service          Relationship writes, traversal, pathfinding, closure, orphan/cycle detection,     Edges, layouts, cluster summaries
                        layout precomputation

 Permission Service     Role/attribute/context/purpose evaluation; retrieval predicates; rendition        Policy bindings, predicate
                        scoping                                                                           compiler

 Authority Service      Risk assessment, confidence bundle assembly, decision matrix, authority ladder,   Risk assessments, authority
                        promotion/demotion, exposure authorisation                                        grants, policy evaluations

 Guardrail Service      Deterministic evaluators for guardrails-as-code; prohibited conditions;           Guardrail evaluators, gate runs,
                        classification gates; PHI/PAN/injection scanning                                  scan results

 Evidence Service       The eight-step chain, provenance ledger, completeness scoring, the nine           Evidence objects, ledger, chain
                        explain queries                                                                   projections

 Capability Fabric      Capability registry, contracts, discovery, composition, reuse checks, usage       Capabilities, contracts, reuse
 Service                telemetry, retirement                                                             checks

 Creation-Loop          Prompt compilation, dispatch to build platforms, run recording, artifact          Prompts, templates, runs,
 Service                attachment, iteration classification, reproducibility keys                        artifacts, skeletons, iterations

 Shadow &               Shadow runs, discrepancy analysis, exposure execution, production outcome         Shadow and production objects
 Production Service     capture, incidents, rollback, kill switches

 Generation Service     Rendition generation, stamping, permission scoping, expiry, staleness, deletion   Renditions

 Decision Service       Human decision requests, the queue, decisions, rationale, reversal                Decision requests, decisions

 Detection Service      Detector registry, scheduled and event-driven sweeps, findings, ownership,        Detectors, findings
                        resolution

 Measurement Service    Flow, quality, value, capability, community and platform-health measures;         Metric definitions, computed
                        intent-to-value computation; rejected-measure guard                               measures

 Feed Service           Value Feed composition, subscriptions, relevance, permission filtering            Feed state, subscriptions

 Capture Service        Consent, session capture, transcription, extraction, clarification prompts,       Sessions, consents, capture
                        semantic capture records                                                          records

 Simulation Studio      Scenario generation, simulation runtime, evaluation of human decisions            Scenarios, simulation runs,
 Service                                                                                                  evaluations

 Model Router           Thin adapter over the AI Factory gateway — route selection, attestation and       Route table, attestations, eval
 Adapter                eval gates, version pinning, cost accounting                                      status

 MCP Gateway            Tool/resource/prompt/notification exposure, agent identity, quotas, provenance    Tool contracts, agent registry
                        wrapping

 Notification Service   Event-triggered notifications only; subscription management; no broadcast         Subscriptions
                        awareness streams

 Audit Service          Append-only ledger, hash chaining, export, legal hold                             Ledger

 Admin &                Canon stewardship console, retention, purge, tenant/config, operator runbooks     Config, retention schedules
 Stewardship Service
Event topics (async backbone): signal.* , mission.* , cell.* , burst.* , intent.confirmed , prompt.compiled ,
 build.dispatched , build.completed , artifact.attached , evidence.recorded , shadow.discrepancy ,
 authority.granted , authority.withdrawn , exposure.authorised , production.outcome , value.measured ,
 incident.raised , rollback.executed , decision.requested , decision.made , detector.finding , canon.changed ,
 rendition.stale , capability.published , capability.retired , primitive.published .


17.2 API conventions

   REST + GraphQL for human surfaces. GraphQL is the right default for the graph-shaped read patterns behind the Explorer,
   Mission Runtime and Evidence views.
   MCP for agent surfaces (Part 12).
   Events for internal integration.
   Every request is permission-evaluated at retrieval. A query without a permission predicate does not exist in the
   codebase.
   Every write records provenance: actor, authority used, evidence refs, timestamp, version.
   Idempotency keys on every mutating endpoint, so agent retries cannot duplicate evidence.
   No endpoint returns a rejected measure. Enforced by a response-shape test.


17.3 Integration points (consume, do not rebuild)

 Integration                                                    Direction

 AI Factory model gateway                                       Outbound (routing)

 AI Factory agent harness & MCP servers                         Bidirectional

 AI Factory connectors / data sources / RAG                     Outbound (evidence and context)

 AI Factory deployment & operations layer                       Bidirectional (exposure execution, rollback, feature flags, telemetry)

 Build platforms (Lovable, Claude Code, Codex, Cursor, Grok     Outbound dispatch, inbound artifact and run telemetry
 Bots)

 Enterprise Context Layer (glossary, patterns, design system,   THREAD is the author; the Factory consumes — with a published export
 catalogs)                                                      contract

 Testing & Assurance Layer                                      Bidirectional (test generation and execution evidence)

 Identity provider (Entra ID or equivalent)                     Inbound (identity, roles, attributes)

 Observability stack                                            Outbound (telemetry, traces, metrics)

 AI Governance Council tooling                                  Outbound escalations, inbound decisions
PART 18 — Visual and interaction design requirements

18.1 Design language

DESIGN DECISION. The interface is a working instrument, not a portal.

 Principle            Requirement

 Graph-first          The Explorer is a primary surface, not a feature buried in a menu

 Decision-centred     Screens are generated around the current decision, not organised into permanent menus

 Evidence-adjacent    Every claim, number, node and edge is one interaction away from its evidence

 Dense but legible    High information density is acceptable and preferred; decoration is not

 Honest               Confidence, authority, staleness, generated-vs-canon and detector findings are always visible, never hidden to look
                      better

 No portal            PROHIBITED: hero banners, marketing copy, welcome dashboards, card grids of links, "quick links", news carousels
 aesthetics

 Typography           System font stack; monospace for identifiers, hashes, version keys, reproducibility keys

 Colour               Semantic: risk tier, authority level, lifecycle state, detector severity. Never decorative-only colour

 Motion               Only to convey state change. No ornamental animation



18.2 Required interaction requirements

   Why-are-these-connected panel on every edge: verb, confidence, evidence refs, actor, authority, time.
   Provenance strip on every object: created by, authority used, version, cited objects, renditions, review date, expiration
   condition.
   Generated-vs-canon marker on every rendition, non-dismissible, stating what it was generated from and when it expires.
   Impact preview before any canon change or capability retirement, rendering the blast radius.
   One-keystroke actions on the decision queue: decide, one clarification, reduce authority, stop.
   Inline challenge — any object may be challenged from wherever it is displayed, with the challenge becoming a
    ChallengeRef on the object.
   Time scrubber on mission and capability views: see the object's state at any point in its history.
   Export — image and data, for every view. Executives will ask in week one.


18.3 Accessibility

NON-NEGOTIABLE. WCAG 2.2 AA from the first release, not retrofitted. Keyboard navigation for every interaction including
graph traversal; a non-visual equivalent for every graph view (the adjacency and evidence lists are the accessible path); colour-
blind-safe palettes; screen-reader announcements for generated content and for live state changes; reduced-motion support.


18.4 Reference implementations already produced

Two working concept renderings exist and should inform the build prompt's UI specification:

 1. Connected knowledge view — force-directed graph, typed nodes and edges, neighbour isolation on hover, per-node
    relationship panel, click-a-line provenance drill-down, class/family filters, density control, in-graph search. Corresponds to
    the Nebula and Focus views.
 2. Same-day build factory lineage view — vertical stage chain grouped into iteration bands, per-stage provenance, canvas-
    rendered wireframes of what the Co-Creator will experience, coverage gaps and churn flagged visibly. Corresponds to the
   Evidence Graph view and the Creation-Loop lineage.

Note: the second concept's framing (a next-morning approval board and a "requirement" object) has been superseded by Part 2.5
and Part 8.4 of this document. The interaction patterns are valuable; the governance framing is not.
PART 19 — Non-functional requirements

Category           Requirement

Availability       99.9% for object read/write and tool calls; 99.5% for generation; explicit maintenance windows for detector sweeps

Durability         Zero loss of evidence or audit records. Append-only ledger replicated. Point-in-time recovery.

Recovery           RPO ≤ 15 min; RTO ≤ 4 h. A rehearsed restore is an exit criterion of the first production phase — not a document

Security           Zero-trust; SSO only, no local human accounts; per-object permission; secrets in a managed vault; encrypted at rest and in
                   transit; no production credentials in any build context

Privacy            Purpose limitation enforced at retrieval; prohibited-inference refusal at generation; consent gate on capture

Auditability       Every consequential behaviour carries a complete provenance chain; completeness is a published metric at 100%

Accessibility      WCAG 2.2 AA

Scalability        10× year-1 volume with no re-architecture

Observability      Traces, metrics and structured logs for every service; a provenance gap is an alertable condition

Cost               Per-mission and per-cell ceilings enforced at dispatch; FinOps view; no unbounded agent loops (hard iteration and cost
                   caps)

Interoperability   MCP and A2A; exportable canon in an open format; no provider-specific logic above the router

Testability        Every normative requirement in this document maps to an automated test (Part 21)

Maintainability    Canon schemas versioned; migrations reversible; no service reads another's tables

Localisation       Not required at launch; text externalised so it is possible
PART 20 — Build sequence

NON-NEGOTIABLE framing. This is a sequence of capability slices with evidence-based exit gates, not a phased project
plan. Do not convert it into milestones and a schedule in the build prompt. Each phase ends when its exit evidence exists — not
when a date passes.

Estimated shape: roughly 24–32 weeks of build effort to a production-capable platform, running in parallel with the
Factory's own 8-week build, because THREAD depends on Factory primitives (model gateway, agent harness, deployment
layer).


Phase 1 — Canon and envelope (2–3 weeks)

Slices: object identity and numbering; the universal envelope; schema versioning; permission spec model; lifecycle state
machine; tombstoning; the append-only audit ledger with hash chaining.

Exit evidence: every object type in Part 4 can be created, versioned, permissioned, tombstoned and audited. A provenance gap
is impossible to create. Restore has been rehearsed once.


Phase 2 — Operating Graph core (3–4 weeks)

Slices: the object type registry with all families; relationship writes and typed edges; Graph Service with traversal, pathfinding,
closure; orphan and cycle detection; canon change workflow with challenge threads; canon drift detection; the Canon
Navigator and Nebula/Focus/Path/Impact views.

Exit evidence: the fifteen canon object types are live; every object is reachable; cycles are surfaced; canon changes are
versioned and evidenced; the Explorer renders 20,000 nodes interactively with honest edge budgets.


Phase 2B — Framing session capture and extraction (4-5 weeks)

Why it runs here. This is the front of the loop and everything downstream depends on the graph actually containing intent.
Running it early populates the graph with real objects, so every later phase — authority, fabric, evidence, creation loop — is
developed and tested against real intent rather than fixtures. It also front-loads the highest-risk unknown: whether extraction
quality is good enough to be trusted. See Part 8A.

Slices: consent and content-tier gating on capture; multi-modal capture with a common session timeline; normalisation and
statement segmentation; six-way statement classification with speaker-authority awareness; typed extraction with mandatory
provenance spans and draft state; the live extraction pane with one-click re-classification; live contradiction, prior-object and
capability-reuse surfacing; session review and material-item confirmation; re-extraction safety that preserves prior
confirmations; the Need Web, Dependency Web, Decomposition Tree, Contradiction Map and Unresolved Frontier views.

Exit evidence: a real framing session between a Business Co-Creator and a Builder produces a confirmed object set with 100%
provenance coverage; a deliberate offhand remark by a non-authority participant is classified as a suggestion and the
mismatch surfaced; a deliberate contradiction with a prior session is detected live; re-extraction with a changed extractor
preserves every prior confirmation; a draft object is proven unable to reach creation; the entry test is tracked and reported;
extraction precision and recall are published per classification and per object type.


Phase 3 — Authority, guardrails and decisions (4 weeks)

Slices: risk assessment; ConfidenceBundle assembly with the published overall rule; the decision matrix; the authority
ladder with automatic promotion and demotion; guardrails-as-code with deterministic evaluators; prohibited conditions;
content tier classification with PHI/PAN hard block; the Human Decision Queue with exactly the fields in Part 6.5.

Exit evidence: the decision matrix behaves correctly across a test matrix of risk × confidence × consequence; demotion fires
automatically on every trigger; PHI/PAN blocks are proven against a labelled corpus with measured recall published; no
object type in the schema has an approval state.
Phase 4 — Capability Fabric (3 weeks)

Slices: capability contracts; the registry; intent-shaped discovery; the reuse-first gate that blocks creation without a
 ReuseCheck ; composition with effective-authority inheritance; usage telemetry; lifecycle with review dates, minimum-use
thresholds, cost ceilings, expiration and automated retirement.

Exit evidence: a creation attempt without a reuse check is rejected by the system, not by convention; a capability can be
discovered from an intent-shaped query; a capability can be retired automatically while preserving data and audit continuity.


Phase 5 — Evidence graph (3–4 weeks)

Slices: all eight chain links with their creation rules and enforcement; the provenance ledger integration; chain completeness
scoring; the nine explain_capability queries as tools and views; the ten traceability queries in Part 5.4; the Evidence Graph
view.

Exit evidence: for any capability, all nine questions are answered in one interaction; the ten queries return within their
performance budgets; a capability with no Confirmed Decision ancestor cannot reach creation.


Phase 6 — Creation loop and platform integration (4–5 weeks)

Slices: prompt compilation from typed fields only (with a test asserting raw captured text is absent); prompt templates with
governance and eval gating; the reuse gate integration; dispatch to all five build platforms; run recording with reproducibility
keys; artifact attachment; skeleton recording; iteration classification with the scope-change detector; cost ceilings at dispatch.

Exit evidence: a confirmed Behaviour Statement becomes a dispatched build on each of the five platforms with a complete
lineage recorded; a build replays to an equivalent artifact from its reproducibility key (or is honestly marked best-effort); a
scope change classified as cosmetic is caught by the detector.


Phase 7 — Shadow, exposure and production outcome (3–4 weeks)

Slices: shadow event tap with read-only isolation and permission parity; automatic comparison and discrepancy creation; cause
clustering; authority-earning metrics; exposure authorisation with progressive population, armed rollback and kill switch;
production outcome capture; incident and rollback recording; value measurement with baseline and delta.

Exit evidence: a capability earns authority from shadow evidence and is exposed progressively; a deliberate discrepancy above
threshold triggers automatic demotion; a kill switch stops a live exposure within its stated bound.


Phase 8 — Generation layer (3 weeks)

Slices: rendition generation for all required kinds; stamping with source refs and generator; permission scoping per identity
and purpose; expiry on source hash change; staleness marking; scheduled deletion; the morning intelligence brief; the canon-
vs-generated marker on every rendition; refusal of prohibited-inference renditions.

Exit evidence: changing a canon object marks every dependent rendition stale; a rendition cannot be served outside its
permission context; a rendition requesting individual activity metrics is refused.


Phase 9 — Agent-executable surface (3 weeks)

Slices: MCP gateway with tool contracts (Part 12.3); the twelve ValueOS-named tools plus the extended set; resources, prompts
and notifications with permission filtering; agent identity and registry; quotas and cost caps; provenance wrapping on every
call; A2A support; injection defence layers 1–5 (Part 12.6).

Exit evidence: an external agent can detect a signal, search the fabric, compile a prompt, dispatch a build and read the
evidence chain entirely through MCP with complete provenance and correct permission enforcement. Injection attempts are
detected with measured recall and blocked by construction.
Phase 10 — Detection and measurement (3 weeks)

Slices: the detector registry; all fifteen ValueOS failure-mode detectors plus the THREAD-specific set; scheduled and event-
driven sweeps; finding ownership and resolution; accepted-risk with approver and expiry; the four ValueOS measure families
plus platform-health measures; intent-to-value computation; the rejected-measure guard as both a schema test and a live
detector.

Exit evidence: each of the fifteen failure modes can be deliberately induced in a test environment and is detected with an
owner assigned; the rejected-measure schema test passes; intent-to-value time computes correctly from the graph.


Phase 11 — Human surfaces (4 weeks, partially parallel from Phase 2)

Slices: Value Companion with evidence-grounded response and behavioural challenge; Value Mission Runtime generated
around the current decision; Value Feed with reuse-or-remix as the primary action; Capability Fabric/Marketplace surface;
Semantic capture console with consent gating; Simulation Studio with an adaptive scenario and the eight evaluation criteria;
Canon stewardship console.

Exit evidence: Part 21.4 passes — the platform demonstrably is not a wiki, not a project tool and not a portal. The Mission
Runtime contains no backlog, no story, no sprint, no task list and no status report. The Feed contains no engagement
mechanic.


Phase 12 — Hardening, assurance and scale (3–4 weeks)

Slices: penetration test and remediation; independent assurance path for Tier 4; load testing to 10× estimate; DR rehearsal;
retention and purge automation; accessibility audit; operator runbooks; the compliance-officer walkthrough; the external-
assessor pack query.

Exit evidence: penetration test findings closed or accepted with owners; DR rehearsed and timed; WCAG 2.2 AA audit passed;
an assessor question answered by query in under an hour; post-restore integrity of the evidence ledger verified.
PART 21 — Test and assurance strategy for THREAD itself

NON-NEGOTIABLE: THREAD must be built the ValueOS way. Dogfooding is a requirement, not a virtue signal. THREAD's
own build runs through the same loop it implements: signals, a mission, a cell, bursts, behaviour statements, prompts, runs,
evidence, shadow, progressive exposure, value measurement. If the build of THREAD cannot be conducted through ValueOS,
then ValueOS does not work and that is the most important possible finding.


21.1 Test categories

 Category               Coverage

 Canon                  Every object type validates against its schema; envelopes are complete; lifecycle transitions are legal; expiration fields
 conformance            present

 Authority engine       A full matrix of risk tier × confidence × consequence × reversibility × novelty, asserting the correct action from the Part
                        6.4 decision matrix

 Guardrail              Every enforcing guardrail has a deterministic evaluator; every evaluator has positive and negative tests; advisory
 determinism            guardrails cannot block

 Evidence               No consequential behaviour can be written without a complete provenance chain; completeness metric reads 100%
 completeness

 Permission leakage     Retrieval-layer tests for every query type, including vector and graph search; a post-filtering implementation must fail
                        the test

 Injection              Labelled corpus of instruction-like content in captured text, artifacts, metadata, spreadsheet cells, diagram labels, HTML
                        comments, hidden text, zero-width characters; recall measured and published, never claimed complete

 Generated-vs-          No service can read a rendition as truth; renditions cannot be edited into canon; stale renditions are not served
 canon

 Expiration             Every object type expires correctly; stale renditions are deleted; unreviewed canon raises findings

 Reproducibility        A build replays from its reproducibility key, or is honestly marked best-effort

 Detector efficacy      Each of the fifteen failure modes is deliberately induced and detected

 Scale                  10× year-1 volume; graph view at 20,000 rendered nodes; detector sweep within budget



21.2 The authority test matrix (explicit)

For every combination, assert the correct outcome. Minimum cells:

 Scenario                                                                      Expected

 High confidence, low consequence, encoded authority exists                    Automatic release

 High confidence, low consequence, no encoded authority yet                    Act with confirmation

 Moderate confidence, any consequence                                          Limited exposure with observation

 Low confidence, low consequence                                               Limited exposure or recommend

 High confidence, irreversible consequence                                     Explicit human decision

 Any confidence, rights-affecting or safety consequence                        Explicit human decision, independent

 Any confidence, prohibited condition                                          Cannot proceed

 Any confidence, Tier C content                                                Cannot proceed, hard block

 Authority lapsed (attestation or effective_to)                                Cannot proceed, route refused
 Scenario                                                                     Expected

 Version changed materially                                                   Authority demoted to observe , promotion path re-run



21.3 Verification independence — the test-circularity control

NON-NEGOTIABLE. A model that writes both the capability and its tests produces weak evidence: "all tests pass" becomes
close to a tautology, and a green suite is exactly the evidence that makes reviewers feel safe while proving little.

Controls, in order of strength:

 1. Tests derive from confirmed Behaviour Statements and Executable Outcome Contracts, which are human-
    confirmed. The human assertion is primary; the test is the machine's attempt to falsify it. A Behaviour Statement with
    vague observable results has no independent verification available to it at all — which is why the framing entry test
    in Part 1.3.4 is load-bearing.
 2. Independent authoring for compliance-scoped, safety-relevant, financial and rights-affecting behaviour: a separate
    generation pass with no visibility of the implementation, plus human review of test intent.
 3. Mutation testing on a sample: introduce defects, confirm the tests catch them. A suite that does not is padding.
 4. Sampled human review of generated tests each cycle, rolling coverage across the corpus.
 5. Report verification independence as a metric — the share of verification evidence independent of the generating model
    — and surface it to the compliance function. Target: ≥70% overall, 100% for compliance-scoped behaviour.


21.4 The anti-wiki / anti-legacy acceptance suite

This is the most important test category in the document. Every THREAD release must pass it, and a regression here is a
release blocker.

 #    Test                    Passes when

 1    No document             The schema contains no free-floating document type; content is always an operating object, evidence, or rendition
      object type

 2    No approval state       No object type, workflow or UI exposes an approval, sign-off, gate, pending-review or "awaiting" state

 3    No backlog, story,      No such concept exists in the schema or in any surface; a Mission Runtime screenshot contains none of them
      sprint or task list

 4    No rejected             A schema and API-response test asserts absence of all eleven rejected measures
      measure

 5    Action ratio            Usage telemetry shows that the majority of sessions result in an action (signal created, mission advanced, burst
                              started, capability reused, exposure authorised, decision made) rather than a read. Reading must not be the
                              dominant mode. Target: ≥60% of sessions contain at least one graph-mutating action, and no more than 25% of
                              sessions are read-only with no action

 6    No awareness            No broadcast stream whose purpose is information distribution; every notification is decision- or event-triggered
      notifications

 7    Reuse gate              A creation attempt without a recorded reuse check is rejected by the system
      enforced

 8    Citations               Generated guidance without canon citations cannot be produced
      mandatory

 9    Surveillance            A rendition or query requesting individual activity metrics is refused at generation time
      refusal

 10   Canon supremacy         No service reads a rendition as truth; no path exists from a rendition to a canon write

 11   Orphan-free             No object exists without relationships; orphan rate is a monitored metric with an owner
 #      Test                 Passes when

 12     Expiration           Every live object has a review date and an expiration condition
        everywhere

 13     Executability        Every core verb in Part 12 is invocable by an agent; the platform is not read-only for machines

 14     Compression          The measured path from confirmed intent to first working evidence is hours or days, not weeks — and the
        realised             measurement is published, not asserted

 15     No document          The DocumentPreparedForHandoff detector has zero unaddressed findings above threshold
        prepared for
        handoff


Test 5 deserves emphasis. A wiki is detected by behaviour, not by structure: a platform can have no document table and still
be used as a wiki if people only read it. The action ratio is the behavioural test that THREAD is a work environment rather than
a reference site.


21.5 Testing the operating model itself

SOURCE requirement: ValueOS must have "mechanisms for challenging the operating model itself." THREAD must therefore
support:

      Canon challenge threads with counter-arguments actively generated by the Challenge Agent.
      A published canon drift report.
      Detector findings against the operating model's own objects (for example, an operating concept that no mission references,
      or an anti-pattern with no detection coverage).
      A recorded decision path for every canon change, with the previous version retained.
      Confidence and authority states that are visible and falsifiable.
PART 22 — Risks

22.1 The risks that matter most

 #     Risk                        Severity   Why it is decisive                   Countermeasure

 R1    THREAD becomes an           Critical   It is the single most likely         Part 2.3 prohibitions; Part 21.4 acceptance suite (especially
       extremely well-                        failure. It is also the most         the action ratio and the absence of a document type);
       organised wiki                         comfortable outcome, which is        instrumented from release one
                                              why it happens. Every status
                                              quo force pushes toward it

 R2    The requirement object      Critical   Reintroduces the translation         Part 2.5 resolution; no requirement object in the schema;
       is reintroduced                        layer on new technology, and it      requirements completed absent; scope-change and
                                              will feel like progress the entire   readiness-gate detectors
                                              way

 R3    Canon fragmentation         High       Named failure mode; destroys         One canon, many renditions; CanonFragmentation
       — multiple agents with                 the single truth                     detector; stewardship console
       conflicting definitions

 R4    Generated material          High       The subtlest failure. A              Rendition stamping, expiry on source change, deletion,
       hardens into authority                 convincing briefing becomes          canon-vs-generated marker, test 10
                                              the thing people cite

 R5    Prompt injection            Critical   The surface is now executable,       Structural separation (typed prompt compilation); detection
       through captured                       so injection has blast radius        with measured recall; containment; no production
       conversation or                                                             credentials or egress in build contexts
       artifacts

 R6    Prohibited-class data       Critical   Reportable disclosure;               Tier C hard block before processing; attestation-expiry gate;
       reaching a model route                 reputational and regulatory          Lovable excluded from restricted classes; output scanning;
                                                                                   invocation logging off

 R7    Permission leakage          Critical   Fastest way to lose enterprise       Retrieval-layer predicates including vector and graph;
                                              trust permanently                    rendition permission scoping; penetration testing before
                                                                                   exposure

 R8    Authority inflation         High       The ladder degrades into             Computed risk tiers, no downward override, automatic
                                              "everything is autonomous"           demotion, AuthorityInflation detector, independent
                                                                                   judgment for Tier 4

 R9    Surveillance creep          High       Destroys the culture the             Prohibited-inference refusal at generation; no activity
                                              strategy depends on                  metrics; explicit board-level policy; test 9

 R10   Test circularity — the      High       Produces confident-looking           Part 21.3 controls; verification-independence metric
       model verifies itself                  evidence with little substance       published

 R11   Detection becomes           Medium     Manufactures the appearance          Every finding requires an owner, age and resolution;
       theatre — findings with                of governance                        accepted risk needs an approver and an expiry
       no owners

 R12   Legacy re-                  High       The $8M failure repeating            The fifteen detectors; mission-without-Co-Creator guard;
       entrenchment — the                                                          reuse gate; no approval states; leadership inspects evidence
       old organisation rebuilds                                                   not status
       itself around the new
       tools

 R13   Graph decay — orphans,      Medium     The graph stops being                Orphan/review/staleness detectors with owners; expiration
       stale canon, unreviewed                trustworthy and people stop          enforced at schema level
       objects                                using it

 R14   Reuse check becomes a       Medium     Compounding effect never             The gate is a hard block with a recorded rationale; reuse
       formality                              materialises                         rate is a published measure
 #     Risk                       Severity   Why it is decisive                   Countermeasure

 R15   Value is asserted, not     High       The exit thesis depends on            ValueMeasure required for the producing_value
       measured                              measurable value                     state; underperforming is a real state; intent-to-value
                                                                                  published

 R16   Over-automated             Critical   Rights-, safety-, financial- or      Risk tiers; progressive authority; shadow; human
       consequential decisions               life-affecting harm                  confirmation; explicit prohibited actions; independent
                                                                                  judgment

 R17   Impact of shifting value   High       No empowered Co-Creator              MissionWithoutEmpoweredCoCreator guard;
       expectations — the Co-                means no cell activation             leadership protects Co-Creator availability; no activation
       Creator becomes                                                            without one
       unavailable

 R18   Platform becomes the       Medium     Irony with consequences              Performance budgets in Part 16.4; MCP latency budgets;
       bottleneck it removed                                                      detector sweeps scheduled off-peak

 R19   Single-database failure    Medium     At this scale, topology is simple,   Rehearsed restore as a phase exit criterion; RPO/RTO
                                             so resilience is the risk rather     commitments; ledger replication
                                             than scale

 R20   Cost runaway from          Medium     Unbounded autonomy is                Hard iteration and cost caps; per-mission and per-cell
       agent loops                           expensive                            ceilings at dispatch; FinOps view



22.2 And one risk to name honestly

The largest single risk is that the organisation is not ready for the operating model, and THREAD makes that visible
faster than it can be addressed. ValueOS requires decision-capable Co-Creators, Builders who exercise judgment rather than
operate prompts, and leaders who inspect evidence rather than status. THREAD will surface every place those conditions are
absent — quickly, and in public. That is a feature. It should be stated to the sponsor in advance, because the first weeks will
look like the platform is finding problems rather than solving them, and it is solving them by making them legible.
PART 23 — Glossary

Carry this glossary into the build prompt verbatim. The canonical definitions live in the graph; this is the seed set.

 Term                     Definition

 AI Builder               The accountable human who converts business intent into functioning capability by directing an autonomous AI
                          workforce and exercising integrated product, technical, risk and consequence judgment

 AI Builder Community     The enterprise network of Builders, Business Co-Creators, agents, capabilities, patterns, evidence and shared
                          creation infrastructure

 AI Factory               The controlled enterprise environment providing models, agents, sandboxes, data access, capability contracts,
                          patterns, policy, evaluation, deployment and observability

 Anti-pattern             A behaviour that recreates legacy delivery; detects and reports

 Autonomous AI            The coordinated agents and tools performing intent, challenge, creation, simulation, trust, release, observation,
 workforce                memory and reuse work continuously

 Behavior Statement       A machine-readable expression of condition, observable result and operating constraints that agents can act on

 Bounded bet              Maximum time, investment, authority, evidence requirement, decision date and stop condition for an uncertain
                          mission or intervention

 Business Co-Creator      The empowered person closest to the business condition who contributes intent, context, rules, exceptions,
                          consequence, acceptance, adoption and value ownership

 Canon                    The authoritative operating objects. Distinct from every generated rendering

 Capability Contract      The business outcome, interface, policy, authority, evidence, observability, cost, lifecycle and technical contract for a
                          composable capability

 Capability Fabric        The enterprise network and registry of discoverable, reusable, governed business capabilities

 Composable capability    A complete, reusable, discoverable, policy-aware business ability invokable by people, agents, workflows,
                          applications or other capabilities

 Controlled exposure      Deliberate release to a limited population, transaction set, environment or authority level with observation and
                          rollback

 Creation Prompt          The compiled, versioned, typed artifact that becomes a build instruction on a build platform

 Detector                 An executable check for one of the named failure modes, with an owner and a remediation path

 Dynamic Capability       Evidence-based representation of a Builder's domain understanding, outcomes, judgment, AI use, reuse, risk
 Profile                  management and value

 Enterprise Operating     The canonical, machine-readable graph of operating concepts, rules, protocols, guardrails, capabilities, decisions,
 Graph                    evidence, authority and relationships

 Evidence graph           The traceable connection from signal and decision through behaviour, implementation, tests, authority, production
                          outcome and value

 Executable Outcome       The measurable outcome, behaviour, rules, evidence, risk, authority, value and lifecycle conditions that can
 Contract                 generate implementation and assurance artifacts

 Human Decision           The minimal, contextual queue containing only decisions that require human judgment because consequence or
 Queue                    uncertainty exceeds machine authority

 Intent Model             Living structured representation of outcome, people, behaviour, rules, exceptions, constraints, decisions, examples,
                          assumptions, questions, evidence and acceptance

 Mission Contract         Living contract defining a Value Mission's signal, outcome, baseline, target, value, humans, authority, boundaries,
                          evidence, time and stop conditions
Term                    Definition

Opportunity Market      Evidence-driven mechanism matching enriched Value Signals with Builders, Co-Creators, capabilities and bounded
                        capacity

Opportunity Stream      Expiring set of Now, Next, Observing and Expired opportunities that replaces a permanent backlog

Production Shadow       A capability operating against production-like or real events without controlling the real outcome, used to compare
                        behaviour and earn authority

Progressive authority   Movement from observe to recommend, confirm, bounded action, and autonomous-with-exception based on
                        evidence and consequence

Rendition               A generated human-facing artifact produced from canon for a specific person and moment; stamped, permission-
                        scoped, expiring, never authoritative

Reproducibility key     The composite pin (prompt version + platform + model route + model version + guardrail set version + template
                        version) that makes a build replayable

Semantic capture        Conversion of consented collaboration into structured intent, decisions, rules, evidence, capability changes and
                        traceability rather than only a transcript

THREAD                  The canonical Operating Graph, the Evidence Graph, the authority and guardrail engine, the generation layer and
                        the agent-executable surface that ValueOS runs on

Value Burst             Short, intensive creation-and-learning cycle that produces working capability, production evidence, a consequential
                        decision, or a disproven assumption

Value Cell              One Business Co-Creator, one AI Builder, and an autonomous AI workforce with the authority and capability to
                        convert intent directly into verified value

Value Companion         Personal, contextual AI interface that helps an employee understand and execute the operating model at the point
                        of work

Value Feed              Permission-aware live stream of signals, missions, bursts, capability reuse, evidence, failures, guardrails and value

Value Mission           Temporary, outcome-centred mandate to change a measurable business condition within explicit evidence, time,
                        risk and authority boundaries

Value Signal            Evidence that a problem, opportunity, risk or unmet need may be valuable enough for enterprise action

ValueOS                 The living, machine-readable, agent-executable enterprise operating system that operationalises the Zero-
                        Translation Enterprise

Zero Translation        Direct conversion of business intent into working capability without interpretation handoffs or administrative
                        decomposition
```

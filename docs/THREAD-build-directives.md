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

**NON-NEGOTIABLE (L-08): THREAD owns the THREAD, not the STATE.** THREAD compiles intent, dispatches prompts and records lineage and authority. Platforms own execution. Runtime/build/environment status is mirrored read-only with a `mirrored_from` source reference, never authored by THREAD, never a lifecycle, metric or gate.

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
11. **PROHIBITED (L-08):** THREAD-owned build, environment, deployment, pipeline or release-execution state in any type/table/column/enum/lifecycle/surface/metric/report. BuildRun carries only source outcome `succeeded|failed|partial` and lineage; no build status board.
12. **Hard routing gates:** expired attestations or failed evaluation suites refuse routing; Tier A/B invocation logging must be off or equivalently protected; Tier C is blocked before processing.
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
| P7 | Human judgment at consequential boundaries | Independent authorized human judgment for Tier 4; recorded decision and armed monitoring/kill switch |
| P8 | Permission at retrieval | Caller-scoped RLS/security-definer predicates on every graph/vector hop; post-filter-only leakage tests must fail |
| P9 | Complete provenance | Append-only `ledger` with hash chain; a trigger rejects consequential writes that lack `provenance_chain_id` |
| P10 | Anti-pattern detection is a product capability | `detectors` registry with an owner on every detector |
| P11 | Reuse before creating | FK `creation_prompts.reuse_check_id NOT NULL` → `reuse_checks` |
| P12 | Measured by value, not output | Rejected-measure schema test plus a language detector |
| P13 | Consent and surveillance boundaries | `consent_records` gate every capture insert (RLS + trigger) |
| P14 | Open protocols | MCP endpoint, A2A cards, provider-agnostic model router, canon export |
| P15 | The model can challenge itself | Canon change = new version + evidence + challenge window + recorded `ConfirmedDecision` |

Appendix A is an index of binding constraints with explicit Appendix C references. The complete cited Appendix C text governs; extracted fragments are not substitutes. The correction packet overrides the specified source contradictions until Revision 1.2.

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
ValueSignal -> ValueMission -> ValueCell
  -> AI pre-session preparation: draft IntentModel, draft ExecutableOutcomeContract,
     candidate hypotheses, disposable probe, smallest unanswered human questions
  -> ValueBurst [ FramingSession = burst phases 1–4 ]
  -> confirmed BehaviorStatements + ExecutableOutcomeContract
  -> ReuseCheck [hard block] -> CreationPrompt -> BuildRun -> BuildArtifact
  -> Test / Simulation / Adversarial -> Production Shadow
  -> ExposureAuthorization -> ProductionOutcome -> ValueMeasure -> Compound
```

### 3.3 Lovable stack mapping (DESIGN DECISION, Lovable adaptation)

| Concern | Source recommendation (Part 16/17) | Lovable implementation |
|---|---|---|
| Framework | Services per Part 17.1 | TanStack Start v1 app; each source "service" becomes a server module `src/server/<service>/*.server.ts`, called through `createServerFn` wrappers in `src/server/<service>/*.functions.ts` |
| Object store | PostgreSQL + JSONB | Lovable Cloud Postgres, table `objects` (typed envelope columns + `body jsonb`) and `object_versions` |
| Graph | Apache AGE (alt. Neo4j) | **Platform availability must be verified before relying on the substitution.** Table `edges` plus recursive CTE functions (`graph_traverse`, `graph_paths`, `graph_closure`, `graph_cycles`, `graph_orphans`) written in SQL. Depth caps and edge budgets per Part 16.4–16.5 |
| Semantic discovery | pgvector | pgvector, `object_embeddings` (general) and `object_embeddings_restricted` (separate table, separate RLS, never merged) |
| Evidence/audit ledger | Append-only, hash-chained | `ledger` table; `REVOKE UPDATE, DELETE`; BEFORE trigger serializes the append with `pg_advisory_xact_lock(hashtext('thread_ledger_chain'))`; SQL `ledger_row_hash` uses pgcrypto; SQL `thread_verify_ledger` alone verifies; nightly verifier. Contention must be load-tested at 500 calls/s |
| Artifacts and renditions | S3-compatible, versioned | Lovable Cloud storage buckets `artifacts` (immutable, private) and `renditions` (private, lifecycle by expiry) |
| Search | Postgres FTS / OpenSearch | Postgres FTS (`tsvector` generated column) + trigram for identifiers |
| Models | AI Factory gateway | `ModelGateway` adapter. The default implementation calls the Lovable AI Gateway; the production implementation targets the MASA Factory gateway. All calls are logged per Part 13.3 |
| Agent surface | MCP gateway | Server route `src/routes/api/public/mcp.ts` (JSON-RPC MCP over Streamable HTTP). It verifies an agent bearer token against `agents` inside the handler |
| Auth / identity | Factory IdP (Entra, etc.) | Lovable Cloud auth (email + Google) now; `IdentityProvider` adapter for SSO later. Roles in a separate `user_roles` table with a `has_role()` security-definer function, never on the profile |
| Scheduled sweeps | Scheduler | `/api/public/cron/*` server routes, protected by a shared secret, triggered by pg_cron + pg_net |
| Runtime | Cloud-agnostic | Edge (Worker) runtime: no Node-only libraries in server code; use Web Crypto for unrelated application hashes, never the database ledger chain |

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
| `ContentClassifier` | `classify(text) → {tier, phi:bool, pan:bool, spans}`. Deterministic regex/Luhn scanning is the production in-boundary implementation and must never be stubbed; only model assistance may be simulated. PHI/PAN hard blocks apply before any model call |

---

## 4. Object model

Implement **exactly** the schemas in Layer B Part 4: the universal envelope (4.1), the ConfidenceBundle (4.1.1), the relationship verbs (4.2), the Object Type Registry with every family (4.3), lifecycle states (4.4) and graph integrity rules (4.5). Also implement the framing-session types from Part 8A.6 (`FramingSession`, `CoCreationArtifact`, `ExtractedStatement`, `NeedStatement`, `DependencyProposal`, and the others listed there). Do not invent parallel structures.

**Depth priority (Part 25.2).** Build these first and in full detail, with Zod schemas in `src/domain/types/` and per-type JSON Schema stored in `object_type_registry.body_schema`: envelope, `ConfidenceBundle`, `ValueSignal`, `ValueMission`, `BehaviorStatement`, `ExecutableOutcomeContract`, `CreationPrompt`, `BuildRun`, `ExposureAuthorization`, `ValueMeasure`, `Rendition`, `Detector`.

**Lifecycle state machines** are defined in `src/domain/lifecycle.ts` as data (family → allowed transitions) and mirrored in the DB function `assert_transition(type, from, to)`, which is called by a BEFORE UPDATE trigger. Transitions not in Part 4.4 are rejected.

**`ConfidenceBundle.overall`** must be computed by a published, versioned rule (`confidence_rules` table, pure function `computeOverall(bundle, ruleVersion)`). It is never learned and never model-generated. The rule version is stored with every computation.

**Human references** (`human_ref`, e.g. `VS-2026-0417`) come from a per-type prefix and a per-year sequence (`ref_sequences`). **DESIGN DECISION (Lovable adaptation):** `id` is a UUIDv7, never reused and never renumbered.

**Legacy alias registry:** the `legacy_aliases(alias, source_system, object_id)` table is a migration aid only. It has no status column.

---

## 5. Authority and guardrail engine (K3)

Implement Layer B Part 6 as a **pure, deterministic TypeScript module** `src/server/authority/engine.ts` with no I/O and no model calls inside the decision. The same module runs in server functions and in tests.

- `assessRisk(object, context) → {tier:1..4, reasons[]}` per Part 6.1.
- `evaluateAuthority({actor, action, object, bundle, consequence_class, guardrail_results}) → {decision: 'proceed'|'proceed_with_confirmation'|'escalate_human_decision'|'block', rule_ids[], explanation}`, using the decision pattern in Part 6.4. The pure function returns `policy_evaluation_payload` as well. The Authority Service persists PolicyEvaluation and ledger in the same transaction as an action requiring policy evaluation; such an action cannot commit without both (L-16).
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
- **Typed extraction with mandatory provenance spans.** `extraction_spans` is the sole authoritative span store (artifact, speaker, time/character range, drawing region or interaction offset). Drop span-less candidates before persistence, with an observable discard. A deferred same-transaction insert constraint rejects extracted objects without spans; draft exit checks again. Captures/sessions themselves are not extracted candidates. Everything extracted enters in **draft** state (L-06).
- **Draft vs confirmed.** Draft objects cannot reach creation: `compile_creation_prompt` rejects any source whose state is draft, and a DB constraint does the same. Material items need confirmation by the actor with authority (Part 8A.10). Confirmation is a recorded decision, not an approval queue.
- **Re-extraction safety.** Re-running with a changed extractor version never overwrites a confirmed object. It creates proposals linked by `supersedes` candidates, and every prior confirmation is preserved.
- **Connection (Part 8A.7).** Dependency derivation follows the relationship-source confidence ordering in 8A.7 and produces `DependencyProposal`s.
- **Live surfacing.** While a session runs, look up contradictions with prior confirmed objects, related prior objects (vector search) and reusable capabilities, within the latency budgets in Part 8A.13. Push results with Supabase Realtime.
- **Views (Part 8A.8):** Need Web · Decomposition Tree · Session Constellation · Dependency Web · Contradiction Map · Unresolved Frontier · Cross-Session Timeline · Impact Overlay. Each supports neighbourhood isolation, edge explanations, distinct inferred/stated and draft/confirmed rendering, deep links, image/data export. Render them with a WebGL graph library (for example `@cosmograph/cosmos` or `sigma.js`) loaded client-only (lazy import behind `ClientOnly`).
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

Implement Layer B Parts 16.3–16.5 and 19 exactly, including every performance budget, the scale assumptions (validated in the pilot), security, auditability and accessibility. Graph requirements (L-17): server-precomputed layouts per view/cluster (no large browser layout); level-of-detail cluster aggregation; incremental neighbour loading; honest visible edge cap (showing 500 of 3,412); precomputed cluster summaries; restorable deep-link state (nodes/filters/layout/time/authority); sparsity by default. Test first clustered paint <300 ms and ≥30 FPS at 20,000 rendered nodes; targets are not proof. On the edge runtime, any query that cannot meet its budget must be pre-computed into a materialised table refreshed by an event or schedule. Record each such case as a DESIGN DECISION in `AGENTS.md`.

---

## 16. Build sequence: capability slices with evidence-based exit gates

**NON-NEGOTIABLE (Part 20):** this is a sequence of capability slices with evidence-based exit gates, not a phased project plan. It has no dates and no milestones. A slice ends when its exit evidence exists. The slices and their exit evidence are exactly as in Layer B Part 20. Run them in this order on Lovable:

1. **Phase 1, Canon and envelope.** Enable Lovable Cloud, create the core DDL (Section 18), the ledger hash chain, tombstoning, the lifecycle triggers and the type registry seed. *Exit evidence: Part 20 Phase 1, plus a test proving a provenance gap cannot be created.*
2. **Phase 2, Operating Graph core**, including the Explorer views.
3. **Phase 2B, Framing session capture and extraction** (Part 8A), with recorded-fixture Transcription (speaker labels, timestamps, confidence) for regression and live transcription for the real human pilot; no synthetic substitute for exit evidence.
4. **Phase 3, Authority, guardrails and decisions.**
5. **Phase 4, Capability Fabric.**
6. **Phase 5, Evidence graph.**
7. **Phase 6, Creation loop and platform integration** (five `BuildPlatform` adapters, simulated until credentials exist).
8. **Phase 7, Shadow, exposure and production outcome** (`Telemetry` and `FeatureFlags` adapters).
9. **Phase 8, Generation layer.**
10. **Phase 9, Agent-executable surface** (MCP endpoint, all tools).
11. **Phase 10, Detection and measurement** (exactly the L-05 manifest: 15 ValueOS + 5 governance + 16 framing = 36 blocking-capable, plus AntiWikiActionRatioThresholdUnset = 37; no duplicates; security refusals remain controls, not additional inventory aliases).
12. **Phase 11, Human surfaces** (built partly in parallel from Phase 2).
13. **Phase 12, Hardening, assurance and scale.**

**Dogfooding (Part 21, NON-NEGOTIABLE):** from Phase 2B onward, THREAD's own build is recorded inside THREAD as signals, a mission, a cell, bursts, behaviour statements, prompts, runs and evidence.

**(a) Adapter-dependent evidence may be deferred (L-03).** Live five-platform builds, telemetry, feature-flag exposure, penetration testing and DR timing are `pending_live_adapter` with simulated evidence attached; met only on live evidence. List each at slice end.

**(b) The Phase 2B human pilot may NOT be deferred.** Phase 3 must not begin until a real Co-Creator/Builder session passes: 100% produced-object provenance; deliberate non-authority suggestion with mismatch surfaced live; contradiction with prior confirmed object detected live; changed-extractor re-extraction preserving every confirmation; draft unable to reach creation; precision/recall by class and type published. Existing later-phase implementation does not retroactively satisfy this gate.

**DESIGN DECISION (recorded):** Run the pilot on MASA's approved enterprise environment, on the codebase that will migrate to MASA AWS. Record deployment target and real business condition. Synthetic/recorded sessions are regression fixtures only. Named participants and a scheduled time require human input; never fabricate them.

---

## 17. Test and assurance strategy

Use Vitest for unit, domain and DB tests (against a test schema), and Playwright for surface tests. Implement every category in Layer B Part 21.1, the authority test matrix (21.2: risk × confidence × consequence), verification independence (L-09 / 21.3: tests from human-confirmed Behaviour Statements/Executable Outcome Contracts; blind separate authoring plus human intent review for compliance/safety/financial/rights behaviour; sampled mutation testing; rolling human review each cycle; publish drill-through independence ≥70% overall and 100% compliance-scoped), and operating-model tests (21.5).

**Anti-wiki / anti-legacy acceptance suite (Part 21.4), all 16 tests, IDs AW-1 to AW-16.** Every blocking-capable test must pass; AW-5 OPEN is explicitly a non-blocking warning (L-02), never silently omitted:

| ID | Test | Implementation |
|---|---|---|
| AW-1 | No document object type | Registry and `information_schema` scan |
| AW-2 | No approval state | Scan of all enums, lifecycle definitions and rendered UI text for approval, sign-off, gate, pending-review or awaiting |
| AW-3 | No backlog, story, sprint or task list | Schema + UI text scan; Playwright screenshot of Mission Runtime with OCR check |
| AW-4 | No rejected measure | Schema + API response + UI scan for all eleven rejected measures (Part 15.3) |
| AW-5 | Action ratio | **OPEN, see Appendix B.** Telemetry computes `% sessions with ≥1 graph-mutating action` and `% read-only sessions`. Thresholds are read from canon setting `anti_wiki.action_ratio` |
| AW-16 | No state ownership | Live schema and rendered-surface scan; every execution status must be read-only with mirrored_from |
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

AW-5 while `status=open` computes/reports both ratios and THRESHOLD_UNSET, creates owned WARNING finding AntiWikiActionRatioThresholdUnset without expiry, and does not block release. Once set, out-of-threshold ratios block release. Every slice-end report prints ratios and OPEN until decided.

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

## 19. Representative operations (complete requirement: §11 and Appendix C Parts 12.2 / 8A.11)

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

**DESIGN DECISION (Lovable adaptation):** Error model: `{ code: 'BLOCKED_PROHIBITED'|'REUSE_CHECK_REQUIRED'|'DRAFT_NOT_CREATABLE'|'CONSENT_REQUIRED'|'AUTHORITY_INSUFFICIENT'|'PHI_PAN_BLOCK'|'PROVENANCE_REQUIRED'|'UNCITED_GENERATION', rule_ids[], explanation }`.

---

## Appendix A: Index of binding constraints (L-19 corrected)

This is a navigational index, not a verbatim extraction. Full Appendix C sections below govern, including all tables/schema fields, not the old heading-only or scrambled fragments. `docs/THREAD-correction-packet.md` resolves the specified contradictions.

- **Appendix C Part 1.3.9 — What ValueOS must not become (verbatim list — treat as PROHIBITED)**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 1.3.12 — Measures to reject (verbatim — PROHIBITED in THREAD's schema)**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 2.3 — THREAD is not (PROHIBITED — absence is testable)**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 2.5 — The one tension that must be resolved explicitly**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 4.1 — The universal object envelope**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 4.1.1 — ConfidenceBundle (replaces any single confidence score)**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 4.4 — Lifecycle states**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 5.1 — The chain**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.1 — Risk tiers**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.2 — The progressive authority ladder**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.3 — The confidence engine**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.4 — The decision pattern**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.5 — The Human Decision Queue**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.6 — Guardrails-as-code**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 6.8 — Governance as escalation, not gating**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 7.3 — Required characteristics**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 7.4 — Discovery and the reuse-first gate**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 7.6 — Lifecycle, ownership and retirement**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8.2 — What THREAD records at each step**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8.3 — Platform integration requirements**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8.5 — Change classification on iteration**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.2 — The co-creation artifact set — what must be captured**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.4 — What gets extracted**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.5 — Statement classification — the discipline that prevents transcripts becoming authority**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.6 — Logging — how objects enter the graph**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.7.1 — Relationship sources, in order of confidence**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.7.4 — Cross-session continuity — the highest-value behaviour in this part**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.9 — The framing session surface**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.10 — Session review and confirmation**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 8A.14 — Risks specific to this pipeline**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 10.1 — The core rule**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 10.4 — The morning intelligence brief — a required generated artifact**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 10.5 — Canon change and the challenge mechanism**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 11.2 — Value Mission Runtime**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 11.5 — Human Decision Queue**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 11.6 — Live Enterprise Value Feed**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 11.10 — Simulation Studio**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 12.3 — Tool contract requirements**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 12.5 — Agent-to-agent**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 13.1 — Do not rebuild the AI Factory**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 13.2 — Routing and residency**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 13.3 — Invocation logging trap**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 13.4 — The creation prompt must contain no raw captured text**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 13.5 — Cost governance**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 14.3 — Surveillance boundaries — PROHIBITED inferences**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 15.3 — Rejected measures — PROHIBITED**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 15.4 — Reporting rules**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 16.2 — Why not a document store**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 18.1 — Design language**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 18.3 — Accessibility**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 18.4 — Reference implementations already produced**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.
- **Appendix C Part 21.3 — Verification independence — the test-circularity control**: complete section text, including tables and schemas, is binding. Search the exact heading in `docs/THREAD-spec.md`.

---


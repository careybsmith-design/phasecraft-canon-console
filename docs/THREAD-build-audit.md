# THREAD whole-build audit

**Audit refreshed:** 17 October 2026, 00:07 UTC. **Release verdict: FAIL — not fully compliant.**

This audit reviews Sections 1–19, the full canonical specification and Appendices A–C. It does not relabel unfinished phases as accepted. Passing local tests, rollback-only fixture checks and catalog scans are identified separately from real production proof. All prior open items remain in the roadmap.

## Verified summary

- The expanded automated suite passes: **1,653 tests across 23 files**, including 1,008 authority matrix and 380 lifecycle cases. The complete transcript is in `docs/audit/full-suite.txt`; the text extension ensures it persists with the app rather than being excluded as a log. This does not establish every Section 17 runtime acceptance.
- 1,008 parameterized authority cases now exercise risk × confidence × consequence × reversibility × novelty; 380 lifecycle cases exercise every currently declared state-pair rule. Those prove the declared implementation, not resolution of the specification's lifecycle ambiguity.
- Historical database regression groups: Phase 2, 2B, 3, 4, 5, 6, 7, 8, 10, 11 and Phase 12 behavioral checks passed in the previous audit; they were not all rerun here. Fresh migration 0063 reran the rollback-only audit security/callback suite and ledger integrity successfully. Direct read-tool calls to privileged tests are denied; privileges were not weakened to run tests. Phase 1's historical ten/thirty-second timeouts remain failed/unverified.
- Fresh catalogue covers **53 public tables, 54 policies and 368 public functions**: zero tables without RLS; zero anonymous table SELECT grants; authenticated canonical INSERT revoked. Two authenticated-callable `thread_*` functions are read-only integrity/snapshot checks (`thread_verify_ledger`, `thread_restore_rehearsal`), not exposed writes. Nine linter warnings remain: two public extensions and seven intentionally callable RLS/read helpers. This is not independent security certification.
- Fresh independent SQL hash recomputation verified **2,754 ledger entries**, no bad sequence. Version snapshot rehearsal is historical and simulated, not a platform backup restore.
- Current snapshot: 534 stored objects, 153 non-tombstoned objects, **93 non-draft orphans**, zero notifications lacking an event/decision trigger, zero live objects missing review/expiration fields. The previous 92-orphan count is superseded; no relationships or objects were altered to force a pass.
- AW-5 is correctly **THRESHOLD_UNSET**: open/null decision, zero recorded usage sessions, no invented threshold. AW-13 lacks real adversarial execution. AW-14 has no published actual intent-to-first-working-evidence measurement.
- Inventory: **126 exported human server operations; 95 MCP tools: 75 advertised live, 10 pending execution, 10 human-only.** “Live” is catalogue status, not proof that each verb ran end-to-end.
- Fresh browser: `/build-audit`, `/assurance` and required evidence/session deep links redirect signed-out to Sign in; zero page errors; unauthenticated MCP returns 401. Authenticated workflows were not verified: requester-session mint again failed because no matching account existed. No unrelated account was selected.

## Renewed audit — additional fixes and fresh proof

The complete source and Appendices A–C were reviewed again. All 19 section entries below remain a built/missing/mismatch assessment, and all 34 specified Section 19 operations were compared individually. **Not every engineering gap was fixed:** source authority, schemas, permission semantics, execution and performance work below remains open. An earlier chat claim that everything fixable in code was fixed was incorrect.

| New fix | Failure prevented | Executed proof | Boundary |
|---|---|---|---|
| Fail-closed prompt context | Failed guardrail/reuse reads could compile without the required safety context | `creation.server.test.ts`: failed object/guardrail/reuse reads and invisible reuse all refuse before a write | Mocked reads; full registered body schemas still missing |
| Fail-closed dispatch configuration | Failed prompt/adapter-binding reads could silently choose simulation | Same test file: both failure cases refuse before dispatch | Real adapters not invoked |
| Evidence read errors | Related missions, outcomes, history, policy, contracts, usage and prior-object queries could return false empty success | `tools.server.test.ts`: multi-read failures are errors, not empty success; 11 handler regressions | All-policy and two-person runtime acceptance still required |
| Historical object lookup | Missing XOR identity and version contract | Phase 9 schema regression; handler requires visible current parent before version 2; hidden parent never reads snapshots | MCP contract/handler fixed, not every human contract |
| Search state selection | Specified `states` input absent/ignored | Handler test asserts `lifecycle_state` filter `published` | Retrieval correctness at production scale unverified |
| Withdrawal evidence | Supplied evidence was omitted from authority change | Handler tests preserve evidence IDs and refuse hidden evidence before writing | Evidence truth/applicability still requires trusted receipts |
| AW-5 setting status | Readers expected impossible `decided`, while Section 18 permits `set/open` | Domain boundary test; migration 0063 checks SQL status and open/null returns `THRESHOLD_UNSET` | **No threshold set**; usage writer/aggregate still missing |
| Honest current AW verdicts | AW-7/8 were unconditional passes from historical results | Two regressions now require blocked status without current execution evidence | Historical DB-boundary passes retained only as historical proof |

Fresh evidence downloads on this page contain the complete suite transcript, all AW-1–15 results, database catalog/access policies, ledger check, linter warnings, public browser outcomes, 95 generated contracts and 126 human-operation names/paths. Names/paths are not full human request/response contracts. Full automated suite **1,653/1,653** passes; full Section 17 acceptance does **not**.

## Section-by-section result

### 1. Objective
**Built:** canonical operating graph, evidence graph, human actions, agent tools, creation, shadow, generation and measurement surfaces.

**Missing:** a real, independently sourced end-to-end signal → mission → cell → burst → confirmed intent → live build → independent evidence → authorized exposure → production → value chain; THREAD dogfooding.

**Mismatch:** previous phase checkmarks describe implementation, not all required live exit evidence. They now explicitly mean implementation only. **Proof:** actual AW-5/13/14 failures and open live-chain items prevent release.

### 2. Non-negotiable constraints
**Built:** separate canon/renditions, authority/confidence, immutable ledger/version history, reuse/citation/consent guards, prohibited-content and surveillance refusal, challenge-window canon changes.

**Fixed:** low confidence formerly allowed automation; it now escalates to an accountable human. Moderate/high confidence cannot manufacture execution authority for an observer. Privileged actor fields reject missing/null kind/identity/authority. Current AW-7/8 statuses no longer hardcode historical passes.

**Missing/mismatch:** full named runtime P1–P15 acceptance; all-surface anti-legacy/semantic tests; purpose/context enforcement. No full compliance claim follows from regex scans.

### 3. Architecture
**Built:** TanStack server functions, caller-filtered database reads, service-role-only controlled writes, provider-agnostic adapter contracts, human/MCP shared operation cores.

**Fixed:** human and MCP action evaluation share one core; failed guardrail/grant/risk reads stop evaluation. Live dispatch carries THREAD's immutable run ID and persists external identity through a ledgered operation. Tool completion failures no longer produce fake success.

**Missing/mismatch:** enterprise Factory adapters, SSO-only identity, governed model attestations, true service ownership boundaries, comprehensive policy predicate compiler. Existing three-hop context and graph closure/path routines still need full bounded-work review and target-scale proof.

### 4. Object model
**Built:** registry, universal envelopes, lifecycle ranks, version/hash/provenance rules, specialized guards for creation, framing, authority, exposure, capability publication and value.

**Fixed:** generic human creation now validates seven explicit body contracts and refuses types without a generic contract instead of accepting arbitrary bodies. Existing risk downward-override rejection was verified; it was not a new missing guard.

**Missing/mismatch:** registered `body_schema` metadata remains largely placeholder/unconstrained; every type/version/write path still needs authoritative schemas and DB parity. Generic protection is partial, not registry completion. Lifecycle rank-forward shortcuts are a documented design decision; evidence-gated adjacency/shortcut semantics need reconciliation. The source's “fifteen canon types” conflicts with its nine Canon registry rows.

### 5. Authority and guardrail engine
**Built:** deterministic risk/confidence engine, enforcing/advisory guardrails, decision queue, authority history and automatic demotion.

**Fixed:** Part 6.4 low-confidence escalation; actor and grant authority required for automatic execution; actor/action scope required in shared evaluation; expired/draft/simulated/invisible confidence references rejected; policy/request records inherit subject permission/classification. Missing/current promotion evidence is checked at the authority-history write. Tier 4 rejection category preserved after stronger judgment checks.

**Missing/mismatch:** trusted actor/action grants need a complete authoring lifecycle; current grants lacking scope now fail closed. UI previously “attached” the subject as evidence; it now requires explicit evidence IDs. Confidence scores and mandatory flags still need evidence-derived computation, not caller claims; model actions need mandatory route/attestation facts. Generic promotion evidence must still be proven applicable/live through verified execution receipts. Formal independent two-human positive authorization remains untested.

### 6. Framing sessions and extraction
**Built:** consented capture, source spans, classification/extraction, human correction/confirmation, preserved confirmations on re-extraction, session close/defer rules and sixteen detectors.

**Fixed:** specified `/sessions/$sessionId` route reuses the existing framing surface, without duplicated auth or UI.

**Missing/mismatch:** participant decision authority/domain is currently declared, not resolved from trusted domain-scoped organizational grants. Live transcription, warm vector retrieval, real two-person co-creation, source scope corrections, independently labeled extraction evaluation and 3/5-second latency proof remain open. Guests' consent attestation is a design decision, not verified organizational policy.

### 7. Evidence graph
**Built:** eight-link chain, nine cited explanation questions, ten traceability queries, creation/exposure/value chain guards.

**Fixed:** evidence deep links now open the existing selected capability surface; historical snapshots additionally require current object visibility; ledger/evidence references and aliases are access-filtered.

**Proof:** current Phase 5 test returned all thirteen checks passing; all ten trace queries were 1.87–39.05 ms at the small fixture corpus, nine answers in 118.53 ms. This is not a target-scale pass.

**Missing/mismatch:** a ConfirmedDecision's nonempty source string is not full source existence/type/authority/provenance proof. Strict source resolution and applicability validation remain required. No real complete chain; no target-scale queries. The “last review period” and added chain verbs remain recorded design decisions.

### 8. Capability Fabric
**Built:** intent-shaped discovery, recorded reuse checks, contract-gated publication, composition and retirement.

**Fixed:** composition rejects duplicate/missing/unpublished/expired parts and incompatible permission predicates; it copies an identical common predicate rather than broadening roles. Restricted embeddings require both a permitted role and readable current parent object. Reuse-check reads are scoped to author/authorized roles and all current source results.

**Missing/mismatch:** discovery uses full-text/trigram/shape, not semantic embeddings. Caller-described extra gaps are claims, not independently computed unmet requirements. Heterogeneous scopes conservatively refuse composition until a real intersection representation exists. Dynamic policy changes after composition need component-access reevaluation at every use.

### 9. Creation loop
**Built:** typed confirmed-field compiler, raw-capture hash guard, mandatory reuse, five platform routes, reproducibility keys, spending ceilings, skeleton and iteration lineage.

**Fixed:** dispatch sends run ID; ledgered external-ID binding; signed callback is typed and bounded; callback-before-response works; identical callback retries are idempotent; conflicting callbacks are rejected; live timeout is reconciliation-required, not a false failed build inviting duplicates. Compiler and dispatcher now stop on unavailable safety/reuse/configuration reads rather than silently omitting safeguards or falling back to simulation.

**Proof:** two live-adapter unit tests and ten rollback-only DB audit checks including callback race, late binding, identical retry and conflict refusal. Existing Phase 6 twenty-check suite passes. No real builder was invoked by these tests.

**Missing:** real five-platform credentials/adapters and signed production callbacks, real artifact inspections, code-diff analysis and independent replay evidence. User-confirmed confidential clearance and best-effort replay are preserved; restricted goes to no builder.

### 10. Generation
**Built:** seventeen rendition kinds, non-canon markers, source versions/hash/citations, read-only currentness, purpose/identity-bound serving, purge queue and PDF exports including authorized confidential/restricted renditions.

**Fixed:** API output schemas distinguish generation refusals and do not silently report them as success.

**Proof:** current Phase 8 eighteen DB checks pass: uncited/source-mismatch guidance, surveillance requests, restricted external routes, wrong identity/purpose, edits and stale serving all refused; purge and morning-brief fixture checks passed.

**Missing/mismatch:** citations present do not prove support for claims; independently tested unsupported/conflicting claims needed. Real regeneration orchestration, live media (currently scripts), complete governed expiry/retention and scheduled execution health remain open.

### 11. MCP surface
**Built:** token-bound agent identity, caller-filtered reads, controlled writes, ceilings/quotas/cost caps, one-use confirmation, content origin, injection scanning, A2A and polling notifications.

**Fixed:** `evaluate_authority` evaluates action and records policy evidence instead of returning current history; exposure grant is correctly human-only; output contracts are executable JSON Schemas and required result fields are validated; nonfinite/undefined/class-instance outputs refused; contract sync and end-call errors checked; one completion attempt only, explicit reconciliation/uncertain-effects errors; subscriptions/refusal-record errors checked. Zero-width and compatibility text normalized for injection scanning.

**Missing/mismatch:** ten pending tools and ten human-only tools are not executable agent successes. Full Section 19 field/nested-type/result semantics and all tool success/permission/idempotency tests remain incomplete. Pending protocols cannot count as AW-13. Streaming/realtime notifications and <300 ms measured p95 remain open. Nested output schemas currently permit JSON fields and are not fully business-typed. Contract sync occurs on initialization; old stored rows need reconciliation.

### 12. Human surfaces
**Built:** Feed, Companion, Mission Runtime, Simulation Studio, capture/framing views, evidence and Assurance.

**Fixed:** exact specified evidence/session deep links, route matching tests and current evidence input instead of a fictitious attached-evidence checkbox.

**Missing/mismatch:** signed-in multi-step acceptance, real two-human mission, provenance/history completeness, all graph accessible equivalents, impact previews, burst phase orchestration/expiry, account directory/onboarding, WCAG assistive-technology proof and Mission Runtime screenshot/OCR. Route existence is not workflow acceptance.

### 13. Compliance, consent and surveillance
**Built:** consent gates, content tiers, restricted storage/read role controls, surveillance refusal, immutable audit and visible honest limitation.

**Fixed:** anonymous table grants removed; direct authenticated canonical write grants revoked; current/history visibility intersection; scoped ledger/reuse/alias/cost/embedding/session-finding reads; raw extraction evaluation corpus limited to steward/compliance. Public registry/tool definitions remain intentionally readable to authenticated people; scanner flags are reviewed rather than blindly hidden.

**Missing/mismatch:** role/classification checks are not full attribute/context/purpose/permitted-use enforcement. Retention/legal holds/erasure, physical storage execution, restricted-read receipts, enterprise SSO-only transition and Factory privacy/security attestations require additional implementation and real owners.

### 14. Measurement
**Built:** connected intent-to-value intervals, flow/health/value/community queries, owned detector findings and explicit observations distinct from native inference.

**Fixed:** detector candidate set materialized once per sweep instead of recomputing for each open finding. This reduces repeated work; Phase 1 still times out because exhaustive type mutations repeatedly trigger full graph/framing sweeps, so performance is NOT fixed overall.

**Fixed in renewal:** AW-5 SQL and domain readers now recognize Section 18 `set/open`, not the impossible `decided` status. No setting value or recorded decision was changed.

**Missing/mismatch:** AW-5 has no semantic usage-session writer and its current caller-scoped reader is personal, not safe aggregate collection. Session semantics/privacy must be designed and implemented. Actual intent-to-first-working-evidence publication (AW-14) and live value/compounding evidence missing. Do not use call counts as value.

### 15. Non-functional requirements
**Built:** 256 KiB/20-item transport bounds, no-store protected responses, currentness checks, spending bounds, precomputed graph layout and recovery targets.

**Fixed:** body/result validation, callback correlation, checked provenance completion and least privileges.

**Missing/mismatch:** dense graph work bounds, all trace budgets at representative scale, 10× load (5M operating objects/30M relationships/15M evidence/1M live renditions/2,000 humans/5,000 calls per second), real-data 20,000-node graph, uptime, real DR and independent WCAG/penetration. User's synthetic graph median 30.1 fps at ledger #1150 remains valid synthetic evidence, not real-canon scale acceptance.

### 16. Build sequence
**Built:** phases implemented in order and earlier user confirmations/open items retained.

**Mismatch corrected in reporting:** implementation checkmarks are not full exits. Live dependencies count only when live adapters supply evidence. No synthetic fixture becomes production acceptance. Phase 10–12 exits remain open; the whole build is not declared complete.

### 17. Test and assurance strategy
**Built/run:** complete current Vitest suite; expanded full authority matrix, every declared lifecycle pair, hidden/zero-width injection fixtures, output-contract and receipt failure tests; current DB groups as above; public browser boundaries; full AW-1–15 status report.

**Missing/failing:** Phase 1 DB test timeout; all-type real schema validation; every guardrail positive/negative; every retrieval-path two-identity leakage; native induction/recurrence for every detector; controlled isolated schema mutants; independent test-route records and human intent review; blind verification ≥70% overall/100% compliance; authenticated OCR/surfaces; real dogfooding; full MCP core-verb execution.

**Important:** enumerating blocked AW checks is not executing them. The all-fifteen release verdict is FAIL. No test-count inflation is presented as production proof.

### 18. Database layout
**Built:** required object registry/objects/version/edges/ledger, authority/confidence, reuse/creation/build, generation, embeddings, consent/session/extraction, detection, agent/tool, alias/settings/notifications/usage roles tables; additional phase-specific sidecars; migration history; all application tables RLS.

**Fixed/proof:** migrations 0057–0063 are present in the repository; they add forward-only policy/grant/currentness/callback/authority/reconciliation protections and correct the action-ratio reader. Fresh full catalog proves zero anonymous application table SELECT grants and no direct authenticated canonical INSERT. Append-only ledger/version rules retained. New privileged write/test helpers remain service-role-only; two existing integrity read helpers intentionally remain authenticated-callable.

**Missing/mismatch:** rich body schema parity, non-role permission predicates and safe usage telemetry; every function's effective helper grants/dataflow needs exhaustive negative caller testing. Broad registry reads are intentional metadata, not object-content exemptions. Read-only catalogue observations do not prove full two-identity enforcement.

### 19. API surface — every specified operation

| Spec operation | Current implementation | Gap / mismatch / proof boundary |
|---|---|---|
| getObject | `get_object`, human `getObjectDetail` | **Renewal fix:** XOR ID/ref, positive version, current-parent visibility before historical lookup tested; full envelope and shared human contract remain incomplete |
| searchGraph | `search_graph`, human graph queries | **Renewal fix:** `states` filter accepted and applied; permission-negative all-query/shared human acceptance pending |
| traverseGraph | `traverse_graph`, `graph_neighbourhood` | Existing output budgets; full work budget and reliable `truncated` metadata missing |
| proposeCanonChange | `propose_canon_change` | Version/evidence/challenge-window DB test passed |
| challengeCanon | `challenge_canon` | Uses change ID; spec object-ID routing semantics need reconciliation |
| detectValueSignal | `detect_value_signal` | Typed record; complete source/authority evidence needed |
| scoreValueSignal | `score_value_signal` | Reads stored scoring fields; missing fields stay unscored, not scored from independent evidence |
| createValueMission | `create_value_mission` | Shared mission schema; spec nested bounds/field names not identical; organizational decision mandate unresolved |
| recommendValueCell | `recommend_value_cell` | Creates a cell rather than merely returning candidate roles; contract mismatch |
| startValueBurst | `start_value_burst` | Recorded bounded burst; phases not yet orchestrated |
| startFramingSession | human `startFramingSession`; agent human-only | Historical consent capture tests passed; trusted domain mandate and real two-person flow pending |
| recordConsent | human consent operation | Not exposed as agent-authored consent; person/attestation semantics preserved |
| ingestArtifact | human capture/artifact operations; agent human-only | Live media/transcription missing; exact spec operation shape differs |
| reclassifyStatement | human correction; agent human-only | Cannot give agents human confirmation authority; domain-authority resolution pending |
| confirmMaterialItems | human session confirmation | Confirmation preservation/authority negative tests passed; independent real positive flow pending |
| reextractSession | human extraction; agent human-only | Preserves confirmations; returns different revision summaries; live latency/evaluation pending |
| addBehaviorStatement | `add_behavior_statement` | Draft typed intent record; mission/span contract parity and source integrity pending |
| confirmBehaviorStatement | human confirmation; agent human-only | By design agents cannot confirm; full human/MCP contract separation required |
| recordDecision | human decision/council/session operations; agent human-only | Exact question/source/rationale/author semantics and source resolution pending |
| searchCapabilityFabric | `search_capability_fabric`, `record_reuse_check` | Search alone returns array; spec promises combined results/reuse-check ID; gap remains |
| publishReusableCapability | `publish_reusable_capability` | Contract must be pre-recorded by ID rather than inline contract; publication DB checks passed |
| composeCapabilities | `compose_capabilities` | Stronger permission intersection/part validity; spec shape partly differs; every-hop use still needed |
| compileCreationPrompt | `compile_creation_prompt` | Typed compiler and DB guards passed; extra explicit fields/platform vs spec shorthand |
| dispatchBuild | `dispatch_build` | Correlation/retry fixes verified with mocks/rollback fixtures, not real external builds |
| recordIteration | `record_iteration` | Described diff between two runs rather than actual diff_ref extraction; user approved described-diff interim |
| evaluateAuthority | `evaluate_authority`, `evaluateAction` | **Fixed** shared action-aware evaluation; bare object-ID history lookup removed; scoped grants fail closed |
| requestExposureAuthority | `request_exposure_authority` | Creates HumanDecisionRequest; human grant separately required; typed evidence reference mismatch remains |
| requestHumanDecision | `request_human_decision` | Builds exact stored HDR but input alternatives/reversibility/evidence are narrower; contract completion pending |
| withdrawAuthority | `withdraw_authority` | **Renewal fix:** supplied `evidence_refs` accepted, visibility checked and preserved in authority write; complete shared contract and trusted evidence acceptance pending |
| explainCapability | `explain_capability` | Nine question enums/citations implemented and DB fixture query passed |
| monitorOutcomeEvidence | `monitor_outcome_evidence` | Reads outcomes/value/incidents; requested window ignored/missing — gap |
| getIntentToValueTime | `get_intent_to_value_time` | Capability only, no mission alternative/path parity; synthetic graph test exactly 54h |
| detectLegacyBehavior | `detect_legacy_behavior` | Returns regex matches, not persisted owned DetectorFinding[]; mismatch |
| generateBriefing | `generate_briefing` | Morning brief for agent identity; input purpose/focus not fully honored; individual recipient boundaries retained |

The complete 95-tool current contracts are saved in `docs/audit/tool-contracts.json`. The full 126 human-operation source inventory is in `docs/audit/human-operations.json`. Every catalogue tool was statically inventoried; not every tool was executed successfully. That difference remains a release blocker.

## Fix-by-fix proof

| Fix | Prior failure | Current proof | Limit |
|---|---|---|---|
| Low-confidence/observer execution | Low confidence or moderate observe could return proceed | `phase3.test.ts`; 1,008 authority matrix cases | Pure deterministic engine; real scoped-grant journey pending |
| Shared agent evaluation | Returned history, no action/PolicyEvaluation | Shared core, required action contract, output schema regression | Authenticated agent write/read-back pending |
| Current confidence evidence | Arbitrary string refs and unrelated subject checkbox | UUID input/currentness/readability checks; explicit evidence UI | Actual applicability/verified receipts not fully complete |
| Actor null fail-closed | SQL NULL could evade kind condition | Applied migration and audit selftest missing-kind rejection | Verified session remains caller boundary |
| Historical/metadata permissions | Tautological reads/current access not intersected | Applied ALTER POLICY and catalog; zero anon grants | Two-identity all-path tests still pending |
| Composition scopes | Empty roles broadened part scope; duplicates/missing accepted | Common-predicate/current-part checks; duplicate negative test; Phase4 suite | Dynamic heterogeneous intersection not implemented |
| Assurance currentness | Expired/retired sources could support a pass | Current evidence function and object trigger; ten-check audit suite | Live label is not authenticated execution; no independent assurance certification |
| Compliance walkthrough | Any live-labeled evidence could pass | Passed walkthrough refused until real execution adapter exists | Intentionally pending real officer/execution proof |
| Live build identity/race/retry | external ID never persisted; callback expected absent run ID | Typed dispatch ID; ledgered binding; callback hash/lock; race+retry+conflict rollback checks | Five real platforms still not connected |
| Ambiguous live dispatch | Timeout falsely recorded failed; duplicate retry risk | Explicit reconciliation-required outcome | Reconciliation UX/operator automation pending |
| Tool sync/receipt failure | Ignored DB errors claimed success; second-completion hazard | Mocked failure tests verify one attempt and uncertain-effects response | End-to-end authenticated MCP pending |
| Executable output contracts | Description-only schema; undefined could disappear | Real JSON Schema/required-fields, malformed output rejection tests | Nested business types partial |
| Hidden injection variants | Zero-width separators bypassed phrase scan | Normalization + five artifact-origin tests | Corpus remains agent-authored and recall imperfect |
| Required deep links | Missing /evidence/ID and /sessions/ID | Exact route/params tests; browser auth redirects without page errors | Signed-in record-specific visual acceptance pending |
| Detector repeated work | Full candidate scan rerun for every open finding | Candidate set computed once; Phase10 suite passes | Phase1 still exceeds 30s due repeated graph/framing sweeps |
| Generic canon bodies | Human generic creator accepted arbitrary body | Seven explicit schemas; privileged unsupported type fails closed | Full registry/all-write validation not finished |
| Table privilege layer | anon SELECT and auth DML broadly granted behind RLS | Zero anonymous app tables; direct canonical INSERT false | Owner follow writes intentionally preserved |

## Full anti-wiki acceptance set

| ID | Verdict | Evidence / blocker |
|---|---|---|
| AW-1 | BLOCKED | Registry/schema observations clean; complete field/semantic scan and negative isolated mutant pending |
| AW-2 | BLOCKED | All public enum/lifecycle labels clean; authenticated rendered state scan pending |
| AW-3 | BLOCKED | Authenticated Mission Runtime screenshot/OCR unavailable |
| AW-4 | BLOCKED | Eleven rejected measure rules tested; complete API/UI/schema output acceptance pending |
| AW-5 | FAIL | THRESHOLD_UNSET, open/null, zero usage sessions; no default |
| AW-6 | BLOCKED | Zero invalid live notification rows; isolated invalid-insert mutation proof pending |
| AW-7 | BLOCKED current acceptance | Historical Phase4/6 DB reuse refusal passed; fresh full authorized acceptance not executed; no unconditional pass |
| AW-8 | BLOCKED current acceptance | Historical Phase8 DB uncited-guidance refusal passed; fresh full authorized acceptance not executed; no unconditional pass |
| AW-9 | BLOCKED overall | DB actual generation surveillance requests refused; all query/MCP paths still needed |
| AW-10 | BLOCKED | Canon supremacy guard exists; exhaustive static dataflow and Phase1 test unresolved timeout |
| AW-11 | FAIL | 93 non-draft non-tombstoned orphan records; do not fabricate edges or delete evidence to pass |
| AW-12 | BLOCKED overall | Zero live rows missing expiration; all-type/write-path mutants pending |
| AW-13 | FAIL | run_adversarial_simulation remains pending execution; catalogue names are not executability |
| AW-14 | FAIL | No actual published intent-to-first-working-evidence rendition |
| AW-15 | BLOCKED overall | Zero open handoff findings and owned explicit-induction checks; full native recurrence acceptance pending |

## Remaining work — not hidden behind green tests

**Engineering gaps:** full registry schemas and every-write validation; trusted organizational/domain authority; real decision source existence/type/evidence; full purpose/context/attribute/permitted-use policy compiler; every-hop composition permissions; bounded traversal/path/closure work; coherent Section19 request/response semantics; live action-session writer/privacy-safe aggregate; actual first-evidence publication; safe automatic rendition regeneration; required surface interactions/onboarding/accessible graph views; native detector induction/recurrence and mutation acceptance; Phase1 performance/test repair; old contract reconciliation; orphan remediation with valid existing provenance, never invented relationships; complete mandatory enforcement from trusted facts.

**External/user-dependent blockers:** requester sign-in and second real human; approved organizational authority/SSO; five builder endpoints/tokens/signature secrets; Telemetry/FeatureFlags/transcription/embedding/media/execution adapters; isolated migrated test database and realistic load infrastructure; independent penetration/accessibility/compliance assessors; actual backup restore operator; human-reviewed corpus labels/test intent; real operational/retention controls and lawful disposition; Carey's AW-5 decision.

**No release approval:** this report does not certify penetration, compliance, recovery, WCAG, uptime, independent verification or target-scale capacity. Every unresolved item remains in the roadmap; no further work runs after this turn ends.

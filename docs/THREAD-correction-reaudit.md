# THREAD — correction-aware whole-build recheck

**18 October 2026 · Release verdict: FAIL / INCOMPLETE. No further capability phase accepted.**

This recheck uses Sections 1–19, Appendix A's corrected index, Appendix B and the complete Appendix C specification, with L-02–L-20 and S-01–S-07 taking precedence. Phase 12 implementation is not Phase 12 exit acceptance. Historical reports and receipts remain historical. This round does **not** claim every gap has been fixed or the complete Section 17 live acceptance suite executed.

## Current proof and limits

- **1,735 tests pass across 32 files**, including authority/lifecycle matrices, all current anti-wiki report tests, correction regressions, creation/gateway regressions and reservation migration assertions. Full transcript: `docs/audit/correction-reaudit-suite.txt`. Unit tests that enumerate detector facts are not native operating failure inductions.
- Signed-in Assurance was exercised: **Check and record integrity** returned receipt **#27550**; the SQL verifier subsequently checked **2,968 ledger entries**, `ok=true`, no divergence. The receipt's snapshot replay is simulated, not a real backup restore.
- Current database: **54 public tables, 379 public functions, 54 policies, 534 objects, 153 non-tombstoned objects**. Every public table has RLS enabled. There are **93 non-draft orphans**, versus **94 all-live orphans** in the caller's Assurance list. These are different populations, not a new orphan caused by the integrity check: that function writes only a ledger receipt. No objects/edges were fabricated or retired.
- Anonymous security-definer exposure: zero. Privileged `thread_*` write exposure: zero, excluding the deliberately callable read-only ledger/snapshot functions. Service-role UPDATE/DELETE on ledger and object_versions remain revoked. Direct application read of usage_sessions is denied; authenticated aggregate read succeeds without actor IDs.
- AW-5 remains **OPEN / THRESHOLD_UNSET / non-blocking warning**: 0 sessions; action and read-only ratios null. No threshold was set. A configured violation or invalid/missing configured evidence is now reported as a blocking failure rather than just unexecuted acceptance.
- **26 normalized span rows; zero scanned extracted objects without spans; zero model-route records.** Live model clearance remains unavailable and refuses before network; this does not establish source-attestation verification or live pilot success.
- **43 deployed detector rows**, not the required 37; six legacy controls remain. No detector/history was deleted merely to manufacture compliance.
- **95 tools: 75 labelled live, 10 pending, 10 human-only**. All 75 labelled-live tools have source handlers. This is source wiring, not 75 executed operation receipts, canonical semantic parity or complete human/server/MCP schema parity. Current per-tool contracts/bindings: `docs/audit/correction-reaudit-operations.json`.
- Signed-in repaired orphan references and OPEN warning were verified in the UI, with no page errors. Public A2A discovery now returns no registered private agents or mandates. Every concrete content route declares app-specific metadata; no leaf head gap was found.

## Fixes applied in this recheck

| Fix                                | Failure prevented                                                                                                                                  | Proof                                                                                                                                                                                                         | Remaining limit                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| L-02 correction-aware AW-5 verdict | Configured violations, unknown statuses and missing measurements could remain merely BLOCKED; malformed percentage settings could pass comparisons | audit-acceptance and phase10 tests cover OPEN, configured violation, absent evidence, invalid status, negative/>100/NaN percentage bounds                                                                     | OPEN remains unchanged; complete semantic usage collection is missing                                                |
| Empty acceptance fails closed      | An empty check list could return passed                                                                                                            | `auditVerdict([])` regression                                                                                                                                                                                 | Full receipt-backed 16-check production runner remains incomplete                                                    |
| Assurance setting display          | Invalid/missing settings were rendered as an OPEN non-blocking warning                                                                             | UI follows actual OPEN separately from release_blocking; signed-in OPEN path verified                                                                                                                         | Invalid/set paths tested through domain rules, not by changing Carey's live setting                                  |
| Assurance orphan projection        | SQL returns `ref/state`, while page expected `human_ref/lifecycle_state`; references/state labels disappeared                                      | Explicit mapping; signed-in CC-2026-0003 and state visible, screenshot checked                                                                                                                                | Human reconciliation remains; non-draft vs all-live scope disclosed above                                            |
| Live BuildPlatform configuration   | A live binding with absent endpoint/token silently dispatched simulated output                                                                     | shared dispatch refuses before run write; creation regression asserts no RPC                                                                                                                                  | Real platforms, model pinning and source outcome/state conversion remain incomplete                                  |
| Agent reservation serialization    | Concurrent quota/cost reservations and single-use-token checks were not serialized                                                                 | migration 0070 locks agent before quota/cost reads and confirmation before validation/consumption; rejects expiry at equality and negative/null cost; live definition/grants read back; three migration tests | No concurrent external execution/load receipt; per-tool rate limits and actual-cost reconciliation remain incomplete |
| Public discovery privacy           | Anonymous A2A response included every active agent's internal mandate/card                                                                         | Removed privileged agent read; browser asserts empty registered_agents and no mandate                                                                                                                         | Publication consent and full A2A standards interoperability still need implementation                                |
| MCP retrieval fail-closed          | Resources/prompts could return successful empty reads on retrieval errors                                                                          | Three handler regressions assert errors and absence of successful completion receipt                                                                                                                          | Two-identity permission and export corpus remains unexecuted                                                         |
| MCP output discovery               | Output contract was hidden in metadata rather than also published under outputSchema                                                               | Tools/list now includes outputSchema                                                                                                                                                                          | Nested output schemas remain too permissive                                                                          |
| Framing graph depth                | Need/dependency tools accepted four hops while SQL clamped to three                                                                                | Two schema regressions accept 3/reject 4; updated contract version                                                                                                                                            | Direct SQL budget/truncation/work bounds still incomplete                                                            |
| Dated audit evidence               | Downloaded historical counts and pre-L-02 failure reasons could appear current                                                                     | Separate current report, tests, evidence and operation files; historical evidence explicitly marked superseded                                                                                                | Historical transcripts are retained, not rewritten as fresh proof                                                    |

## Section-by-section: built, missing, mismatch

### 1. Objective

**Built:** canonical operating/evidence graph, action surfaces, creation/lineage and MCP operations. **Missing:** real signal→mission→cell→burst→confirmed intent→build→independent evidence→exposure→outcome→value chain and dogfooding. **Mismatch:** THREAD still owns build execution state. L-08/AW-16 overrides the historical source lifecycle. Phase checkmarks are not accepted exit gates.

### 2. Non-negotiable constraints

**Built:** canon/rendition and confidence/authority separation, immutable ledger/version controls, reuse/citation/consent guards, prohibited content and surveillance refusal, challenge path. L-10 private aggregates and L-11 whole-token guards retained. **Missing:** exhaustive P1–P15 runtime/mutation/two-user and rendered semantic tests. **Mismatch:** owned state, incomplete purpose/context permission compiler and non-atomic consequential policy persistence. AW-5 OPEN is a warning, never the reason for release FAIL.

### 3. Architecture

**Built:** TanStack server functions, caller-scoped read cores, privileged write functions, deterministic authority, SQL graph, adapters, serialized SQL hash chain. **Missing:** live transcription/telemetry/flags/identity/CI integrations, peak concurrency and verified graph-platform substitution. **Mismatch:** generation's live choice does not consistently obey adapter_bindings; eligibility task classification still uses free-text purpose. Live-build missing configuration now refuses instead of silently simulating.

### 4. Object model

**Built:** envelope/registry/lifecycle/relationship domain data, SQL seeds, UUID/human references, snapshots/tombstones, compatibility aliases and manifest. **Missing:** full depth-priority strict per-type schemas and final migrated-database manifest parity/every-type insertion/edge proof. **Mismatch:** registry allows additional properties; creation execution lifecycle remains; historical seed differences require final-state verification rather than inferred failure from an early seed alone.

### 5. Authority and guardrails

**Built:** pure deterministic engine, risk/confidence matrix, shared action-aware service, decision queue, promotion/demotion controls and independent Tier-4 judgment checks. **Missing:** actor/action/subject/version/input-bound PolicyEvaluation plus ledger in every consequential action transaction (L-16); trusted enterprise-scoped authority and actual independent execution evidence. **Mismatch:** a separately recorded evaluation is not action authorization; missing provider attestation cannot be replaced by stored declarations.

### 6. Framing capture/extraction

**Built:** consent/capture timeline, six-way classification/post-rules, authority mismatch, confirmation preservation, span-less observable discards, normalized span commit/range/immutability guards and eight views. **Missing:** real two-human enterprise pilot, full normalized-only read/write conversion, source/session/speaker/source-length validation, isolated negative commit mutants, changed-extractor DB receipt, per-class/type published quality and live latency. **Mismatch:** JSON compatibility span arrays remain consumers; gateway refusal becomes explicit simulated regression fallback, not successful live pilot evidence. L-03 cannot be deferred as an adapter dependency.

### 7. Evidence graph

**Built:** chain/completeness, nine explanation questions, ten trace functions, caller-scoped reads and creation decision guard. **Missing:** actual source-to-value chain, final-schema negative/positive lineage acceptance, two-identity hop leakage, index plans and budget receipts. **Mismatch:** decision source/state/authority/mission ancestry remains incompletely validated; list/counted records do not prove lineage.

### 8. Capability Fabric

**Built:** contracts, reuse checks, immutable reuse gate, discovery, composition and publication/lifecycle controls. **Missing:** embedding discovery quality, live usage/retirement continuity, final DB composition/permission/authority acceptance. **Mismatch:** representative combined search+reuse response remains split; bounded usage counts omit completeness disclosure.

### 9. Creation loop

**Built:** confirmed typed prompt fields, raw-text/reuse/safety checks, reproducibility keys, spending bounds, five platform dispatch interfaces, best-effort replay and change classification. **Fixed:** unusable live configuration no longer selects simulation. **Missing:** all five live builds/artifacts/replay receipts and real-diff analysis. **Mismatch:** writable build_runs.status and execution lifecycle/gates; source outcome and read-only mirrored_from conversion must cover sibling consumers safely, not hide the old field with a rename.

### 10. Generation

**Built:** non-canon renditions/citations, source versions, stale/expiry/purge, private retrieval, surveillance refusal, confidential/restricted authorized PDF exports and scheduled brief/sweep jobs. **Missing:** live per-user schedule execution/health, complete transitive canon fan-out, media generation and all-export privacy acceptance. **Mismatch:** generation model binding selection and free-text route task semantics; scripts are not rendered media. Timings remain provisional.

### 11. MCP

**Built:** 95 typed catalogue entries, 75 labelled-live handlers, quotas/cost reservations, confirmation hash binding, provenance, resources/prompts, subscriptions and A2A service card. **Fixed:** reservation locks, fail-closed resource/prompt reads, public mandate leak, outputSchema and depth mismatch. **Missing:** independent execution for pending kernels, every-contract human parity, strict nested outputs, per-tool rate-limit enforcement and concurrent execution receipts. **Mismatch:** request-only/record-only/lookup operations advertised as execution; consumed notifications declared read-only; POST-only transport is not proven push delivery. See operation review below.

### 12. Human surfaces

**Built:** Feed/Companion/Mission Runtime/Explorer/Evidence/Decision Queue/Fabric/Capture/Detectors/Simulation/Canon/Agents/Framing/Assurance and deep links. **Missing:** docked contextual Companion, complete action-first event Feed, generated mission panels, orchestration/account invitations, exhaustive keyboard/WCAG/OCR/eight-view export acceptance. **Mismatch:** some panels are rule-based or lists, not the specified generated operating loop; simulated probes are not executed tests. This round verifies Assurance, not every authenticated surface.

### 13. Compliance, consent and privacy

**Built:** consent gate, restricted permissions, activity-table revocation/aggregate-only path, surveillance refusal and audit/tombstones. **Fixed:** public agent mandates withheld. **Missing:** organizational identity/SSO/inherited controls, policy-owned retention/legal hold/erasure/storage, complete restricted-read auditing and two-user export/query tests. **Mismatch:** data visibility alone is not a complete purpose/context/attribute policy; JSON `live` is not trusted execution.

### 14. Measurement

**Built:** graph-derived flow/value/health/community queries, intent-to-value, aggregate ratios and rejection patterns. **Missing:** actual live primary measurement publication, privacy-safe semantic session recording, all four families at representative scope and verified independent denominator. **Mismatch:** some MCP scopes/windows are ignored, record_value_measure cannot satisfy its DB baseline/delta contract, and record_production_outcome drops fields. Fixing these must derive outcomes from verified evidence, not permit arbitrary manual value declarations.

### 15. Non-functional requirements

**Built:** request/batch limits, server layouts, cluster-first sparse view, node/edge caps and deep links. **Missing:** per-view layouts/summaries, incremental/LOD completion, all SQL boundary limits/truncation/work bounds, <300 ms first clustered paint, representative 20,000-node ≥30 FPS, 500-call/s ledger proof and tenfold load/accessibility/security receipts. **Mismatch:** historical synthetic median 30.1 FPS is not fresh real-corpus scale acceptance.

### 16. Sequence and exit gates

**Built:** phase implementation and historical simulated fixtures; corrections explicitly separate deferrable live adapters from the non-deferrable pilot. **Missing:** required real pilot, dogfooding and complete exit receipts. **Mismatch:** later phases were built without the real Phase 2B gate; subsequent implementation cannot retroactively satisfy it. No new capability phase is authorized by this audit.

### 17. Test and assurance

**Built:** 1,735 passing local tests, authority/lifecycle matrices, rollback acceptance procedures and correction-aware AW report rules. **Missing:** complete real Section 17/Part 21 acceptance: native detector induction/recurrence, isolated schema mutation, independent test authoring/source verification, mutation sampling/human cycle review, authenticated all-surface OCR/export, peak concurrency and live systems. **Mismatch:** independence trusts body declarations/nonempty references and a ≤1,000 caller-visible TestRun subset; all five controls/targets are represented but not actual independent enterprise verification. Unit tests and current catalog scans never become live acceptance.

### 18. Database layout/access

**Built:** all core Section 18 tables plus additive operation/projection tables; all 54 public tables RLS-enabled, role separation, ledger/history append-only, critical triggers, normalized spans and model projections. **Checked:** catalog/table policies and grants, privileged function execution, private usage reads, ledger verifier, expiration/notification/spans and state scanner. **Missing:** fresh isolated complete migration replay, every final registry/schema/verb/state parity insertion, all-source lineage legality and two-user policy mutants. **Mismatch:** 43 detector rows vs 37, writable execution state, permissive body schemas; operational findings versus canonical envelope representations. No role grants were widened to run privileged tests.

### 19. Representative and complete operations

**Built:** all 95 catalogue names examined; 75 labelled-live source bindings exist; strongest one-core parity is object read/search and creation/fabric/authority/human-operation subsets. **Missing:** one matching schema, server function and executable MCP binding for every required contract, typed nested output semantics and actual test-harness invocation of every core verb. **Mismatch:** Section 19 remains representative, not the full requirement. Human-only decisions must remain human-only; removing that boundary to make a count green would violate P7.

## AW-1–AW-16: current acceptance, not suite counts

| ID    | Verdict                | Current proof / unmet condition                                                                     |
| ----- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| AW-1  | BLOCKED                | Registry/schema implementation present; full field/semantic/mutation proof absent                   |
| AW-2  | BLOCKED                | Whole-token guards present; full authenticated rendered and direct-write mutants absent             |
| AW-3  | BLOCKED                | Full Mission Runtime OCR/work-object absence acceptance not executed                                |
| AW-4  | BLOCKED                | Current SQL schema checker passes; full schema/API/UI rejected-measure corpus absent                |
| AW-5  | WARNING — non-blocking | OPEN, 0 sessions, both ratios null, no default; aggregate verified                                  |
| AW-6  | BLOCKED                | 0 invalid current notifications; isolated invalid-insert induction absent                           |
| AW-7  | BLOCKED                | Reuse DB guards/historical rollback proof exist; current full authorized mutant receipt absent      |
| AW-8  | BLOCKED                | Generator/citation guards exist; current full uncited-generation induction absent                   |
| AW-9  | BLOCKED overall        | Direct activity read denied, aggregate verified; full query/export/two-identity corpus absent       |
| AW-10 | BLOCKED                | Canon/rendition controls present; complete static dataflow/direct mutant acceptance absent          |
| AW-11 | FAIL                   | 93 non-draft orphans; 94 in all-live UI population; no invented repair                              |
| AW-12 | BLOCKED                | 0 live rows missing expiration; every-type mutation proof absent                                    |
| AW-13 | FAIL                   | 10 pending kernels; actual adversarial/test execution harness and semantics missing                 |
| AW-14 | FAIL                   | No actual intent-to-first-working-evidence measurement publication                                  |
| AW-15 | BLOCKED                | Full native handoff induction/recurrence/threshold acceptance absent                                |
| AW-16 | FAIL                   | Signed-in scanner reports build_runs.status; lifecycle/rendered source-mirror conversion incomplete |

## Operation semantic exceptions (all remaining open)

The downloadable 95-row inventory includes each name, status, source handler presence and generated contract. The following exceptions supplement that inventory; a handler present is not semantic conformance.

| Operations                                     | Mismatch / needed correction                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| score_value_signal                             | Reads nullable stored scores; canonical computed ConfidenceBundle incomplete                                |
| recommend_value_cell                           | Creates a cell rather than merely recommends membership                                                     |
| search_capability_fabric                       | Combined representative results/reuse_check_id contract remains split                                       |
| request_exposure_authority                     | Creates a request rather than evaluated authorization with population/segments                              |
| monitor_outcome_evidence                       | No requested time window; body reference lookup may omit graph-linked outcomes                              |
| detect_legacy_behavior                         | Regex matches rather than persisted owned DetectorFindings                                                  |
| traverse_graph                                 | Missing explicit requested/effective depth and truncation; SQL boundary bounds incomplete                   |
| challenge_canon                                | Change-ID versus representative object-ID contract diverges                                                 |
| add_behavior_statement, log_behavior_statement | Mission/span contract and normalized-only source validation incomplete                                      |
| update_intent_model                            | Generic patch rather than complete typed intent body                                                        |
| record_build_run                               | Lookup, not a recording operation                                                                           |
| record_iteration                               | Two-run/described-diff versus representative run/diff_ref semantics                                         |
| request_human_decision                         | Abbreviated fields/synthesized parties/action versus exact Part 6.5                                         |
| evaluate_policy, check_guardrails              | Lists evaluations/text scan rather than full named deterministic evaluation                                 |
| record_production_outcome                      | Published outcome/measured_at payload discarded by differently named SQL inputs                             |
| record_value_measure                           | Published strict schema cannot provide required delta; verified baseline/source derivation needed           |
| start_shadow, raise_incident                   | Simulated/default evidence not a live telemetry receipt                                                     |
| execute_rollback, arm_kill_switch              | SQL records are not proven external rollback/stop execution                                                 |
| check_data_use_permission                      | Returns unrelated visible permission objects after visibility check                                         |
| check_capability_usage                         | First-200 subset lacks full-count/completeness disclosure                                                   |
| measure_flow, measure_value, measure_community | Scope accepted but ignored                                                                                  |
| get_intent_to_value_time                       | Capability-only; representative mission alternative/path absent                                             |
| generate_briefing                              | Caller scheduled-brief versus representative actor/purpose contract                                         |
| render_unresolved_frontier                     | Mission visible but questions/assumptions returned globally                                                 |
| list_notifications                             | Consumes records while declared read-only/idempotent                                                        |
| All consequential tools                        | Current actor/action/subject/version/input-bound policy evaluation must be atomic with action/ledger (L-16) |
| All output contracts                           | Many nested fields accept arbitrary JSON rather than exact canonical typed outputs                          |
| Transport/resources                            | Strict JSON-RPC request/notification/protocol validation and real push delivery incomplete                  |

Pending execution tools remain refused: run_adversarial_simulation, attach_artifact, escalate_to_council, record_discrepancy, run_test_suite, run_simulation, run_adversarial, run_model_evaluation, scan_security, evaluate_accessibility. Human-only tools remain restricted: confirm_behavior_statement, record_decision, grant_exposure_authority, start_framing_session, capture_artifact, extract_from_artifact, classify_statement, confirm_object, confirm_relationship, close_framing_session.

## Correction/source-gap disposition

L-02: retained OPEN behavior; configured verdict/display/percentage validation fixed here. L-03: real pilot still blocked on people/condition/time/enterprise target, plus engineering receipts. L-04/L-05: domain manifest exists, final replay/parity and 43→37 control reconciliation missing. L-06: table guards exist, normalized-only conversion/source and commit mutants missing. L-07: SQL chain verified current; peak concurrency/tamper and nightly verifier missing. Three active schedules exist (hourly rendition sweep, 05:00 morning brief, hourly detection reconciliation); no nightly ledger verifier appeared in the safe schedule listing. L-08: AW-16 FAIL, not accepted. L-09: targets represented; independent evidence/source validation incomplete. L-10: direct usage read denied/current aggregate verified; full export coverage missing. L-11: guards/unit proof retained; isolated mutants missing. L-12: equivalent canon tables retained; transitive dependent fan-out/drift evidence incomplete. L-13: exhaustive source inventory refreshed; executable semantic/human parity incomplete. L-14: eight views retained; all interaction/export acceptance incomplete. L-15/L-20: projections/pre-network gates exist; no approved routes or verified attestations/all-source lineage proof. L-16: atomic policy/action persistence incomplete. L-17/L-18: graph completion and pre-session/burst-contained workflow incomplete. L-19: corrected index retained; full canonical Appendix C remains governing.

S-01→L-12, S-02→L-05, S-03→L-06, S-04→L-18, S-05→L-04, S-06→L-08, S-07→L-14. Source contradictions do not excuse missing implementation or acceptance.

## Remaining blockers and ownership

**Engineering (not credentials blockers):** strict schemas/final migration parity; detector reconciliation; normalized provenance/source legality; state-ownership conversion across SQL/domain/adapters/surfaces; atomic policy/action/ledger; source-resolved independence; tool contracts/outcome/scopes/permission semantics; canon fan-out; routing task/binding/source validation; graph work bounds/LOD/incremental loading; preparation/burst orchestration and privacy-safe usage collection; complete receipt-backed AW runner; nightly ledger verification and operation/protocol tests.

**Human/outside evidence:** real enterprise pilot with named Co-Creator/Builder, actual business condition/time/target; authorized external adapters/attestations/live build/telemetry/flags/transcription; independent author/reviewer/mutation/accessibility/penetration/compliance proof; isolated replay/tamper/load/restore infrastructure and organizational identity/retention decisions. AW-5 decision is optional while OPEN, never an invented default or release blocker. Orphans require accountable disposition; prior request not to auto-retire is preserved.

**All unfinished engineering and acceptance remain in roadmap.md. This round fixes listed verified defects, not every identified gap.**

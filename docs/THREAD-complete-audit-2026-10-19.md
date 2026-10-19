# THREAD complete code and plan-conformance audit

**Audit date:** 19 October 2026, approximately 02:56–03:01 UTC.  
**Verdict: FAIL / INCOMPLETE — substantial implementation, not fully delivered as planned or release-accepted.**

This audit includes the original build, correction packet, prior repairs, approved visual redesign, live-capture/Microsoft ingestion plan, Signal Intake correction, SI-1 database self-test, and material-confirmation/access-policy follow-up. No application logic, policy, credentials, objects or relationships were repaired or changed during this audit. Rollback-only database fixtures were executed; none remained.

## 1. What was checked and what “complete” means here

Three independent read-only investigations covered phase/specification conformance, later changes, and server/access boundaries. Findings were reconciled with current source, deployed function definitions, database catalog checks, fresh tests and authenticated browser observations—not simply copied from old roadmap checkmarks.

Governing sources:
- `docs/THREAD-spec.md`: Sections 1–19, Section 2/P1–P15, Appendix A and binding Appendix C, including phase exit gates.
- `docs/THREAD-correction-packet.md`, `docs/THREAD-build-directives.md` and retained correction/audit evidence; corrections override identified original contradictions.
- `.lovable/plan/live-capture-teams-and-outlook-ingestion-2026-10-18.md` and the approved visual redesign plan.
- Available original and later uploaded prompts, including `THREAD-Lovable-Correction-Round-Signal-Intake.md` and `THREAD-Followup-Material-Confirm.md`.
- Root/nested `AGENTS.md`, `roadmap.md`, source, tests and migration history through **0075**.

**Inventory:** 230 files under `src`, 36 test files, 76 SQL migrations, 38 route files; current tool catalogue **101 tools: 81 labelled live, 10 pending, 10 human-only**. A live-labelled handler is not an executed, semantically conformant operation receipt.

This is a whole-project code/requirements audit with selective executable validation. It is **not** a claim that every statement, route, permission combination, tool or production integration has been exercised. No fresh isolated migration replay, destructive mutation, external penetration test, load rehearsal or Microsoft account ingestion was performed. Those are explicit remaining actions below. Final preview compiler telemetry reports **build OK at 03:02:14 UTC** after the audit documentation was added. No separate production deployment/typecheck/runtime acceptance was performed; successful preview compilation is not that evidence.

## 2. Fresh verification results

| Check | Result | Limit |
|---|---|---|
| Complete current test suite | **1,767/1,767 passed, 36/36 files**, 16.55 s | Includes mocks, pure rules and source-string assertions; not full live acceptance |
| Final preview compiler | **build OK, 03:02:14 UTC** | No new deployment or separate production runtime acceptance |
| Signed-in main pages | **19/19** remained on requested paths; zero page errors/error boundaries/document overflow at 1280×1800 | Page reads only, not every control submission or accessibility audit |
| Live ledger verification | **3,211 entries checked; ok=true; first_bad_seq=null** | No concurrent load or deliberate tamper induction |
| SI-1 deployed self-test | **PASS**: ledger-valid mission against detected signal raised **P0001 / MISSION_SIGNAL_NOT_PROMOTED** | One negative rule, not complete positive mission workflow |
| Actual authenticated-role intake SELECTs | Member restricted **0**, internal **1**; steward internal+restricted **2**, prohibited **0**; **all_ok=true** | Does not cover alternate duplicate-return path |
| Rollback fixtures | **0** remaining SI-1 objects and intake fixtures | Reference sequences may advance despite transactional rollback; test references are not persisted objects |
| RLS catalog | **56/56 public tables** have RLS enabled; **55 policies**, **384 functions** | RLS presence is not proof of every predicate's semantics |
| Privileged access | Zero anon-callable security-definers; authenticated `thread_*` access only ledger verifier/simulated restore reader; ledger/version UPDATE/DELETE denied even to service role | Other intended authenticated readers still require review |
| Usage privacy | anon/authenticated table SELECT **false**; **0 usage sessions** | Collection remains incomplete; no meaningful ratio proof |
| Database linter | **15 issues:** 2 informational no-policy tables, 1 mutable search path, 2 extension placement warnings, 10 authenticated security-definer warnings | `app_user_connections`/`usage_sessions` intentionally locked; most readers intentional; review, do not blindly widen/revoke grants |
| Static lint | **7,153 findings: 7,139 errors, 14 warnings**; 7,126 are formatting | Remaining 27 include 10 explicit-any errors, const/style errors, dependency warnings and unused suppressions; not 7,153 security vulnerabilities |
| Dependency advisory scan | **3 high advisory rows** via transitive `source-map-js` and `js-yaml` | Known advisory scan, not demonstrated exploitable production attack |
| Operating data | 538 objects; 157 non-tombstoned; 95 non-draft orphans; UI lists 96 all-live orphans; 43 detectors; 26 normalized spans; 0 model routes | Different orphan populations; not a contradiction |
| Missions/participants | **0 live missions**, **1 promoted signal**, **1 actual human role identity**, despite 3 role-bearing identities (steward 1/member 2) | Agent identities do not qualify as the second human |
| Active schedules | Rendition sweep hourly, morning briefs 05:00 UTC, detection hourly | No nightly ledger-verification job; schedule presence is not job-health proof |

Checked pages: Feed, Signals, Missions, Framing, Canon, Graph, Fabric, Creation, Shadow, Generation, Agents, Assurance, Detection, Measurement, Evidence, Authority, Decisions, Simulation and Whole-build audit. Signals shows the promoted signal and “Establish mission from this signal”; Assurance shows empty independent evidence and OPEN AW-5 warning. The existing Whole-build audit page still displays the older report; this dated report is the current audit, not a claim that the older page was updated.

## 3. Original phase-by-phase validation

**Implemented** below means code exists; it does not mean all exit gates passed.

| Phase | Present | Not delivered/proved as planned |
|---|---|---|
| 1 Canon/envelope | Hash chain, provenance, snapshots/tombstones, registry/lifecycle, role separation | Strict every-type bodies, final database replay/parity, isolated mutants, actual backup restore |
| 2 Graph/canon | SQL graph, server layouts, canon challenge/change path, relationship registry | Accountable orphan disposition, every-hop two-identity proof, bounded direct SQL work, transitive canon invalidation, real-corpus rendering proof |
| 2B Framing | Capture/extraction, six-way classification, eight views, spans and confirmation controls | **Earliest non-deferrable unmet gate:** real two-human enterprise pilot, trusted attribution/authority, source legality, changed-extractor database proof, quality/latency acceptance |
| 3 Authority | Deterministic engine, risk/confidence split, judgments/decision queue | Atomic actor/action/subject/version/input-bound policy+action+ledger and trusted enterprise authority/source verification |
| 4 Fabric | Contracts, reuse search/check and creation gate, composition/publication | Combined contract parity, semantic discovery, complete usage/retirement, final permissions/authority proof |
| 5 Evidence | Chain/explanation/trace operations, current-parent guarded history | Decision-source validity/state/ancestry, all-source legality, actual signal-to-value chain, query budgets/permission mutants |
| 6 Creation | Typed compilation, reuse/routing gates, five dispatch interfaces, replay records | **L-08 violation persists:** THREAD owns `build_runs.status` and execution lifecycle; five live platform builds and source/artifact/replay receipts absent |
| 7 Shadow/outcome | Shadow/exposure/value records and simulation controls | Real telemetry/flags/stop/rollback, verified outcomes, payload parity and evidence-derived baseline/delta/value |
| 8 Generation | Separate cited renditions, stale/expiry controls, authorized PDF, schedules | Binding/task/attestation correctness, transitive invalidation, actual media, job health and all-export privacy |
| 9 MCP | 101 contracts, authenticated gateway, reservation locks, shared subsets and refusals | Ten execution kernels, complete semantic parity, strict nested output/protocol behavior, push, per-tool limits and actual cost/concurrency receipts |
| 10 Detection/measurement | Owned findings, resolver/sweep, private aggregate, honest AW verdicts | **43 vs canonical 37 controls**, native induction/recurrence, semantic usage collection, scope/window/value measures and representative quality/performance |
| 11 Human operating loop | Feed/Companion/Missions/Simulation/deep links and forms | Real two-person mission/cell/burst/outcome, contextual/generated operating surfaces, account invitations, preparation/burst orchestration, full WCAG/keyboard/export acceptance |
| 12 Assurance | Assessor/cited evidence controls, bounded context, hardening and runbooks | Actual independent ≥70% overall/100% compliance evidence, penetration, restore/RPO/RTO, load, accessibility, compliance, retention/SSO/availability and complete AW acceptance |

Later phases were implemented despite the missing real Phase 2B gate; code added later cannot retroactively satisfy that gate. Earlier phase checkmarks mean implementation, not accepted full release.

## 4. New/reconfirmed concrete defects in later changes

Severity expresses practical priority, not a penetration-test certification. “Source-confirmed” identifies a demonstrable path; cross-account exploitation has not been performed with unauthorized identities.

| ID | Priority / finding | Evidence and required correction |
|---|---|---|
| N01 | **P0 — audio sent before session/consent authorization** | `src/lib/framing.functions.ts:1334–1351` transcribes before `captureUtteranceImpl`; session/capturing/speaker checks are at `:1105–1109`, consent lookup at `:1138–1144`. Verify caller/session, valid speaker, capture state and applicable unwithdrawn audio consent **before external audio transmission**. Test zero external calls on every refusal. |
| N02 | **P0 — permission-blind duplicate lookup** | `drizzle/migrations/0072_signal_intake.sql:106–119`; fresh deployed definition confirms no caller-read predicate in duplicate branch. Security-definer search can return a hidden signal's title/ID/reference and create a lower-classification duplicate reference. Gate matching and response/event references by caller visibility; prove restricted and purpose-denied duplicate refusals under two identities. Migration 0075 does not fix this alternate path. |
| N03 | **P0 — attachment bytes not classified** | `src/lib/framing.functions.ts:3299–3329` classifies filename/MIME only, uploads bytes, then uses empty consent basis/pending extraction. Inspect supported content, quarantine unknown content, preserve valid consent and storage access/provenance; test PHI/PAN hidden in benign-named files. |
| N04 | **P0 — audio queue not account-scoped** | `src/lib/live-capture.ts:8–24,190–200`; `LiveCapturePanel.tsx:53–62,77–85` retries all stored chunks with current identity. Bind owner/session, forbid cross-account retry, define safe logout/recovery and local retention; test shared-browser account switching. |
| N05 | **P1 — zero-loss guarantee overstated** | `src/lib/live-capture.ts:146–185`: buffer cleared before durable write; small nonempty tail dropped as “silence”; persistence failure outside upload catch; interval work not drained on stop. Serialize, preserve data on quota/abort/storage failures, retain short speech and drain in-flight operations; failure-injection tests required. |
| N06 | **P1 — timing/identity not as planned** | Recorder offsets restart at zero (`live-capture.ts:135,156–160`); panel computes but never uses session offset (`LiveCapturePanel.tsx:49–51,98–106`); any listed speaker selectable (`:129–140`). Use sample-based/session-relative timing; authenticated participant/delegated attribution and explicit shared-mic unconfirmed mode; simultaneous two-human/restart proof. |
| N07 | **P1 — Signal “Live dictation” is typed input** | `signals.tsx:98–110,144–155` starts text capture and asks for pasted/typed transcript; `signal-intake.server.ts:78–99` returns an unpersisted UUID and accepts completion without owner/state/consent validation. Integrate actual microphone flow and durable owned consent-gated attempts; reject fabricated/foreign/reused IDs. Existing framing speech adapter is not integration on Signals. |
| N08 | **P1 — not every intake attempt ledgered** | `signal-intake.server.ts:60–75,84–106` returns successful proposals without events; no-proposal/abandoned attempts and rejected confirmation are not recorded. Define attempt/event terminal states, exactly-once retry/multi-proposal behavior and audit every required channel outcome. |
| N09 | **P1 — intake gates incomplete free text** | `signal-intake.server.ts:50–56` checks condition only and PAN only; population/value/title/source fields may also persist sensitive content. Apply approved PHI/PAN policy to every persisted input and sensor path; include metadata-only negative tests. |
| N10 | **P1 — promotion suggestion can falsely report success** | `0072_signal_intake.sql:167–179` equates ownership/steward with eligibility and swallows suggestion revision errors. Resolve trusted named Co-Creator/domain authority; reliable append-only suggestions must either commit or return failure. |
| N11 | **P1 — Teams import is incomplete bounded pull** | `framing.functions.ts:3149–3193`: no pagination/replies, 4,000-character truncation, display-name/fallback attribution, blocked messages counted ingested, weak durable source metadata. Preserve message/chat/channel/sender IDs, report truncation/block counts and support continuation/idempotency. No connector meeting bot or automatic live sync exists. |
| N12 | **P1 — Outlook partial imports cannot reliably resume** | `framing.functions.ts:3257–3277`: email truncation, single-message path; duplicate email skips attachment retry. Preserve complete thread/source evidence and independently retry attachment extraction/storage; mission linkage and real-account validation required. |
| N13 | **P1 — OAuth account-binding proof missing** | `framing.functions.ts:2944–2976`: returned authorization session ID is discarded; code exchange returns connector/key without local caller-binding check. Gateway may enforce this, so **not a proven exploit**. Verify documented gateway binding or persist/validate user-bound one-time OAuth state/session; negative code-swapping/replay tests. |

### Dependency and code-quality debt

Three high advisory rows were found by the production dependency scanner: `source-map-js` via `@tailwindcss/vite` (fixed dependency 1.2.2), and two `js-yaml` advisories via `@tanstack/react-start` (fixed dependency versions 4.3.1/4.3.2). Upgrade through compatible upstream packages or verified dependency resolution, rerun scanner/full tests and published-runtime validation. Toolchain reachability must be assessed; do not equate scanner severity with proven production exploitability.

Lint failure is largely formatting debt. Separately review explicit `any` in Microsoft handlers/Canon, unused expression in Creation, Graph memo dependency and development refresh warnings. Generated integration files are not editable remediation targets. `thread_intake_read_selftest` is the one SQL function without a fixed search path; it is invoker/service-only and correctly uses authenticated roles, but should use schema-qualified dependencies/fixed path in a follow-up. Do not turn it into security-definer or widen grants.

## 5. Later change status and honest deviations

| Change | Current conclusion |
|---|---|
| Approved visual-only redesign | Present; fresh desktop surface reads clean. Historical approval/17-page desktop+narrow checks preserved. This audit did not reperform complete narrow/keyboard/assistive-technology acceptance. |
| Live transcription | Real gateway adapter exists, adapter tests pass, prior smoke/fake-mic evidence retained. Not self-hosted OpenWhisper; approved model substitution stands. Fresh multi-person/zero-loss acceptance absent and N01/N04–N06 contradict unconditional completion. Deployed Transcription binding still says simulated; live endpoint directly selects live adapter. |
| Teams | Per-user connect/import code exists. User explicitly deferred connecting; reminder date today is not an automatic notification. No linking card reopened. No real-account chat/channel proof, no meeting-attendance bot, no continuous sync. |
| Outlook | Per-user email/attachment code exists, unlinked and unproved. N03/N12 must be repaired before sensitive real-account imports. |
| Signal Intake | Register/detail/Feed/Companion/promoted-only form and promotion code present; detected/promoted signals visible. SI-1 real DB negative test and classification RLS now freshly pass. All channels/authority/attempt privacy remain incomplete (N02/N07–N10). |
| Mission from promoted signal | Still unproved: no live mission and only one actual human. Two members are not evidence of two actual humans. Do not use an agent or invent a participant to bypass the rule. |
| Material confirmation | Existing capability, not missing due to naming divergence. Unauthorized material handler refusal has regression tests. MCP intentionally returns **HUMAN_ONLY**, not PARTICIPANT_REQUIRED; pre-action authority requirement remains conditional. Follow-up asked verify-only: no parallel mechanism or rebuild authorized. |
| Intake read policy | **Resolved** by additive 0075, preserving occupied 0074/original 0072; real role-based counts freshly pass. Separate dedupe leak remains. |
| SI-1 automated DB regression | **Resolved** by 0074 and freshly executed rollback-only test. Local string assertions alone are not DB execution; this audit supplies separate live result. Repeat it automatically during release/replay checks. |
| GitHub/data backup | Prior chat could not trigger/inspect GitHub synchronization. No fresh remote commit comparison or data/storage backup was performed. Code sync is not data/storage backup. |

## 6. Correction directive acceptance

| Directives | Status / remaining action |
|---|---|
| L-02 | OPEN AW-5 warning correct; no threshold/default set. Meaningful private usage collection missing. Carey's choice is **optional/non-blocking while OPEN**. |
| L-03 | Real enterprise Co-Creator/Builder pilot and associated source/latency/quality/re-extraction receipts missing; cannot defer as adapter dependency. |
| L-04 / S-05 | Manifest exists; strict bodies, fresh full migration replay and final every-type/state/verb/write parity missing. |
| L-05 / S-02 | Canonical 36 blocking-capable detectors + one warning; deployed 43 require accountable reconciliation, no history destruction. |
| L-06 / S-03 | Normalized persistence/commit/range/immutability implemented; table-only consumers and every source/session/speaker/range negative proof missing. |
| L-07 | Fresh ledger hash pass; nightly verifier/job health, concurrent 500/s and tamper proof missing. |
| L-08 / S-06 | **Contradiction persists:** owned execution status/lifecycle. Convert all sibling consumers to source outcome/read-only mirror, then rerun AW-16. |
| L-09 | Five independence controls/targets represented; source-resolved authors/routes/reviewers/mutation proof and complete denominator missing. |
| L-10 | Activity-table privacy verified; all-query/export corpus and meaningful aggregate-only collection missing. |
| L-11 | Whole-token state guards present; isolated direct-write and rendered mutant acceptance missing. |
| L-12 / S-01 | Equivalent canon storage/change path exists; complete transitive rendition/capability invalidation/drift proof missing. |
| L-13 | 101 handlers/contracts inventoried; executable semantics, one-schema human/MCP parity and strict nested outputs missing. |
| L-14 / S-07 | Eight views exist; all interaction/export/keyboard acceptance missing. |
| L-15 / L-20 | Simulation/model projections and refusal gates exist; zero eligible routes. Trusted attestations/evaluation/logging/pinning, binding-driven typed tasks and all-source lineage validation missing. |
| L-16 | Pure engine exists; atomic policy+consequential action+ledger enforcement missing. |
| L-17 | Server layouts/caps/sparse foundations exist; direct SQL bounds, LOD/incremental/per-view behavior and real-corpus budgets missing. |
| L-18 / S-04 | Full preparation then burst-contained framing/phase orchestration missing. |
| L-19 | Corrected navigational index retained; complete cited Appendix C remains authoritative. |
| L-22 / S-09 | Intake code and SI-1/RLS repairs present; N02/N07–N10 and real mission acceptance prevent blanket completion. |

## 7. AW-1–AW-16 disposition

These are release acceptance dispositions, not a substitute fresh execution of every AW test.

| Check | Verdict | Remaining proof |
|---|---|---|
| AW-1 | Incomplete | Strict schemas, field semantics and isolated mutants |
| AW-2 | Incomplete | Full direct-write/rendered forbidden-state induction |
| AW-3 | Incomplete | Authenticated Mission Runtime operating-loop/OCR acceptance |
| AW-4 | Incomplete | Full API/UI/schema rejected-measure corpus |
| AW-5 | **Non-blocking warning** | OPEN, zero sessions, null ratios; never invent a threshold |
| AW-6 | Incomplete | Invalid notification induction and recurrence |
| AW-7 | Incomplete | Full fresh reuse refusal/positive and mutation receipts |
| AW-8 | Incomplete | Uncited generation induction and export checks |
| AW-9 | Incomplete | Private table read fixed; complete two-identity query/export/capture/dedupe corpus missing |
| AW-10 | Incomplete | Full canon/rendition dataflow/direct mutants |
| AW-11 | **Fail** | 95 non-draft / 96 all-live orphan dispositions |
| AW-12 | Incomplete | Every-type expiration mutation proof |
| AW-13 | **Fail** | Ten execution kernels plus contract/effect parity |
| AW-14 | **Fail** | Actual published intent-to-first-working-evidence measurement |
| AW-15 | Incomplete | Native handoff induction/resolution/recurrence |
| AW-16 | **Fail** | `build_runs.status`/execution lifecycle ownership persists |

## 8. Complete consolidated remaining-action register

The permanent `roadmap.md` remains the item-level historical register, including provisional choices and specifically named cleanup fixtures. Nothing there was silently removed. The following consolidates duplicate/stale entries into actionable work packages; **all packages below remain open** unless a narrower resolved subcontrol is expressly identified above.

### A. Fix code and safety first — no external credentials required to begin

1. **N01:** enforce caller/session/state/speaker/audio consent before sending any audio externally; regression refusals make no gateway call.
2. **N02:** permission-safe duplicate matching/responses/events; isolated two-identity tests and concurrency-safe dedupe.
3. **N03:** content-inspected/quarantined attachments with lawful consent, private storage and extractable provenance.
4. **N04–N06:** owner-scoped durable audio queue, quota/abort recovery, short-tail retention, serialized drain, trustworthy session timing/identity and shared-mic unconfirmed attribution.
5. **N07–N09:** actual Signals dictation; persisted consent/owner/one-time attempts; every channel/outcome ledgered; all persisted fields PHI/PAN-gated.
6. **N10:** trusted promotion eligibility and suggestion transaction success/failure, without swallowed errors.
7. **N11–N12:** complete Teams/Outlook continuation/thread/provenance/block reporting and independently resumable attachment imports/mission linkage.
8. **N13:** prove gateway OAuth caller binding or add verified one-time local state/session binding and replay/code-swap tests.
9. Remove THREAD-owned execution states throughout database/domain/lifecycles/adapters/gates/UI/metrics; preserve only source outcomes/read-only `mirrored_from` status. Do not conceal it with renaming.
10. Atomically enforce consequential policy evaluation and action/ledger with actor, action, subject, version and input binding; source-resolve decision/judgment authority.
11. Complete purpose/context/attribute/permitted-use compiler and dynamic every-hop composition authorization; two-identity queries/history/exports fail closed.
12. Strict registered bodies/type/version parity and every write/revision validation; fresh clean full migration replay and valid/invalid type/verb/lifecycle fixtures.
13. Remove compatibility span arrays as authorities/consumers; validate all normalized source/session/speaker/length/range/immutability/commit paths and changed-extractor database behavior.
14. Resolve blank/dangling/wrong-type/tombstoned decision/evidence sources, usable decision states, ancestor selection and mission ancestry across scalar/array/JSON lineage.
15. Canonical 43→37 detector reconciliation preserving monitoring/history; canonical Detector/DetectorFinding envelope/status reconciliation and actual native failure induction/recurrence.
16. Complete transitive canon/rendition/capability invalidation, meaningful drift and regeneration queue processing.
17. Correct every operation contract/effect: production-outcome payloads; evidence-derived value baseline/delta; policy/guardrail execution; exposure request vs authorization; record-build/iteration semantics; recommendation vs creation; persistent legacy findings; exact decision fields.
18. Correct scope/window/completeness for flow/value/community/outcome monitoring/data-use permission/unresolved frontier/capability usage/intent-to-value alternatives; publish typed nested outputs and one shared schema across human/MCP paths.
19. Execute ten pending kernels: adversarial simulation, artifact attachment, council escalation, discrepancy recording, test suite, simulation, adversarial, model evaluation, security scan, accessibility evaluation. Keep ten human-only tools human-only.
20. Strict JSON-RPC/protocol/notification semantics; separate list/ack effects, real push/subscriptions and explicit private-agent publication consent.
21. Per-tool rate limits, external/actual cost reconciliation, same-token reservation and peak concurrency receipts.
22. Binding-driven typed model/task selection, attestation/evaluation/logging/pinning source verification; classify/gate before permitted model processing and expose honest simulated fallback.
23. Direct SQL limits/depth/node/edge/work bounds, requested/effective/truncation metadata, dense closure/path protection and index/query-plan proof; per-view incremental/LOD/precomputed mission layouts.
24. Full privacy-safe semantic usage collection and complete aggregate denominators; actual intent-to-first-working-evidence/value/community publication, never actor-level surveillance or draft-progress counts.
25. Contextual Companion, full action-first Feed/push/narratives/generated mission panels, account directory/invitations, preparation and orchestrated burst clocks/framing/capture/expiry.
26. Actual media generation where kinds currently return scripts; scheduled per-user execution, purge/brief/regeneration health and restricted-read/export audit completeness.
27. Nightly SQL ledger verifier with alert/health receipts; repeat rollback-only SI-1/access checks in release/replay automation; schema-qualify/fix self-test search path without widening privileges.
28. Complete receipt-backed P1–P15/AW-1–AW-16 runner with native inductions, resolution/recurrence, isolated mutants and real rendered/export workflows—not source-string checks alone.
29. Resolve dependency advisories, non-generated static-analysis defects/format debt and deprecated validator warnings; run fresh compiler/tests/advisory scan and hosted-runtime verification.

### B. Real people, services and operational evidence — do not invent or silently substitute

30. **Real Phase 2B enterprise pilot:** named distinct Co-Creator/Builder, actual business condition, approved deployment target/time; capture authority mismatch/contradiction, confirmation preservation, per-class/type human-labelled quality and extraction ≤3 s/contradiction ≤5 s budgets.
31. **Real promoted-signal mission → cell → burst → outcome**, source-to-working-evidence/exposure/value chain and THREAD dogfooding; second actual human required. Signed-in page reads are no longer blocked, but this workflow remains blocked.
32. Complete user-deferred Teams connector setup and real-account chat/channel acceptance when requested; real in-meeting capture on participant devices, no nonexistent attendance bot.
33. Link Outlook and prove actual emails/conversations/attachments/mission artifacts after safety repairs; no credentials in chat.
34. Five live platform builds/artifact callbacks/best-effort replays and real-diff evidence; real telemetry/FeatureFlags/stop/rollback/live demotion signals and approved model route attestations.
35. Independent authors/routes/reviewers, blind test generation, source-verified TestRun references, mutation sampling/human cycle reviews: ≥70% overall and 100% compliance. Tier 3/4 adversarial and genuine two-human Tier 4 positive authorization.
36. Independent authorized penetration assessment/remediation/annual process; authenticated WCAG 2.2 AA assistive-technology/keyboard/OCR/export audit and retest.
37. Actual backup restore/replication/PITR, RPO ≤15 min/RTO ≤4 h and checkpoint comparison in isolated environment—not simulated snapshot replay.
38. Isolated tenfold scale rehearsal: 5M operating objects, 30M relationships, 15M evidence, 1M live renditions, 2,000 peak humans, 5,000 agent calls/s; real 20,000-node ≥30 FPS and latency/concurrent 500/s ledger proof.
39. Actual compliance officer/external assessor under-one-hour cited walkthrough; organizational identity/SSO-only transition, inherited controls, environment credential isolation/safe observability and availability evidence.
40. Approved per-class canon-owned retention, six-year compliance/legal hold default, lawful personal-data erasure, physical storage purge and job-health execution evidence.
41. Human review of provisional risk/confidence/promotion/demotion, exposure steps/kill-switch time, last-review period/explanation mapping/added verbs, detector semantics/expiry/sweep, rendition retention/brief timings, agent authority/quota/cost/token defaults and quality/injection corpora; preserve already confirmed confidential platform clearance/best-effort replay/PDF decisions.
42. Accountable orphan/legacy/practice-data disposition—including the named existing fixtures in roadmap—without invented edges, unauthorized deletion or auto-retirement; reconcile stale tool-contract rows and specification discrepancies.
43. Decide whether the material-confirmation verify-only discrepancies need a separate correction; preserve HUMAN_ONLY boundary and existing mechanism, do not add a parallel confirmation path.
44. Verify connected GitHub remote/branch commit against current source and separately export/verify Cloud records/storage/backups; current chat/source evidence does not establish remote sync or complete data backup.
45. Obtain Carey’s AW-5 decision **only if desired**; until then preserve OPEN, no default, non-blocking warning. Collection/denominator engineering still required independently of the optional threshold.

### C. Audit record reconciliation

46. Publish this dated report alongside earlier reports rather than rewriting them as fresh proof; reconcile the existing Whole-build audit page, stale signed-out blockers, old “27 tools pending”/95-tool counts, “speech simulated today,” and unconditional live-dictation/zero-loss checkmarks. Current actual human count and mission blocker must stay explicit.

## 9. What is already resolved and must not be reopened as missing

- SI-1 actual trigger regression and intake classification RLS: freshly executed successfully here.
- Normalized span persistence/commit/range/immutability guards: present; remaining consumers/source tests distinct.
- Activity table denial and safe aggregate read path: present; complete measurement collection distinct.
- Existing material-confirmation mechanism and authority refusal: present; naming/error-copy/UI expectations distinct.
- Companion → Signals and promoted-only mission selection: present; completed two-human mission distinct.
- Live-builder missing-config refusal, agent reservation locks, withheld public mandates, fail-closed MCP resources/prompts, outputSchema publication, three-hop contract alignment and orphan reference display: retained repairs, not full semantic/execution acceptance.
- Dedicated evidence/session deep links exist (`src/routes/_authenticated/evidence_.$capabilityId.tsx`, `sessions.$sessionId.tsx`); older “route absent” wording is stale. Content leaf metadata exists; mission/authenticated layout wrappers correctly delegate to leaf heads, so missing wrapper metadata is not a content-route finding.

## Bottom line

The repository contains a serious, working implementation with passing local tests and verified ledger/access protections. **It has not been created completely as planned:** mandatory real gates remain unmet, multiple later completion claims are overstated, concrete safety/reliability defects remain, and operation/authorization/schema/measurement/state-ownership work is unfinished. Fix Section 8A items first, then satisfy real-person/service/independent evidence tracks, and only accept release after the full receipt-backed gate passes. AW-5 OPEN is not the cause of failure.
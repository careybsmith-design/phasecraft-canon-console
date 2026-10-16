# THREAD roadmap

## Whole-build audit — Sections 1–19 (authorized 16 October 2026)
- [x] Re-read full specification and Appendices A–C; all 19 sections inventoried in docs/THREAD-build-audit.md.
- [x] Run complete automated suite and available database groups; report every AW-1–AW-15 as pass/fail/blocked, not full execution. Full release FAIL.
- [x] Inspect live database layout/grants and static API inventory: 126 human operations, 95 MCP tools (75 advertised live / 10 pending / 10 human-only). Not all executed.
- [x] Apply verified forward-only safety fixes; proof and remaining engineering gaps in docs/THREAD-build-audit.md and /build-audit.
- [ ] Complete every remaining gap and full acceptance. Blockers: engineering gaps listed below, requester sign-in, trusted organizational authority, execution/Factory adapters, isolated test/load environment, independent humans and Carey's AW-5 decision.

**Phase checkmarks below mean implemented, not all live exit evidence accepted; full build release remains FAIL.**

- [x] Phase 1 — Canon and envelope
- [x] Phase 2 — Operating Graph core; 20,000-node benchmark met (median 30.1 fps, ledger #1150)
- [x] Phase 2B — Framing session capture and extraction
- [x] Phase 3 — Authority, guardrails and decisions; exit evidence ledger #1788
- [x] Phase 4 — Capability Fabric; exit evidence ledger #3674
- [x] Phase 5 — Evidence graph; exit evidence ledger #4906
- [x] Phase 6 — Creation loop and platform integration (waiting for user approval); exit evidence ledger #7282
- [x] Phase 7 — Shadow, exposure and production outcome (waiting for user approval); exit evidence ledger #7462
- [x] Phase 8 — Generation layer (waiting for user approval); exit evidence ledger #10434
- [x] Phase 9 — Agent-executable surface (waiting for user approval); exit evidence ledger #10660
- [ ] Phase 10 — Detection and measurement implemented; signed-in validation and remaining exit evidence below
- [ ] Phase 11 — Human surfaces added; partial implementation, validation and exit blockers below; awaiting user review
- [ ] Phase 12 — Hardening controls and assurance surface added; live exit evidence and signed-in validation remain open

## Open items — keep until addressed at the end (never delete without resolving)

Phase 1
- [ ] Real platform-backup restore (`pending_live_adapter`; only snapshot-replay rehearsal done)
- [ ] AW-5 action-ratio thresholds — OPEN for Carey Smith; no default may be set

Phase 2
- [ ] Spec discrepancy: exit summary says 15 Canon-family types, Part 4.3 lists 9
- [ ] Mission Constellation view — waits for missions
- [ ] 20,000-node benchmark on real canon data (`pending_live_adapter`; synthetic met)

Phase 2B
- [ ] Real framing session between two different people (Co-Creator + Builder accounts)
- [ ] Live latency budgets (extraction 3 s, contradiction 5 s) — currently ~6–9 s
- [ ] Human relabelling of the extraction quality set (agent-authored)
- [ ] Live speech transcription adapter (simulated today)
- [ ] Dogfooding: record THREAD's own build inside THREAD (Part 21)
- [ ] Test leftovers: practice sessions FS-2026-0003 … FS-2026-0008

Phase 3
- [ ] Human confirmation of provisional choices: risk scoring, confidence rule, promotion thresholds, demotion severity
- [ ] Human relabel of the PHI/PAN corpus (agent-authored)
- [ ] Live shadow/production evidence, model-route attestations, live demotion signals
- [ ] Test leftovers: CC-2026-0003, HD-2026-0002

Phase 4
- [ ] Meaning-based (embedding) capability discovery — needs an embedding service
- [ ] Live usage telemetry (Phase 7; simulated today)
- [ ] Test leftover: CC-2026-0016 "Claim intake routing" (retire if user agrees)

Phase 5
- [ ] Performance budgets proven at target scale (measured only at current small corpus; `pending_live_adapter`)
- [ ] Steward to set the "last review period" (90 days provisional) and confirm the question mapping (decision = why it exists, authority = which decision authorised it)
- [ ] Confirm the three added chain verbs: decided_from, built, renews
- [x] MCP exposure of explain_capability / trace_* — live through /api/public/mcp (Phase 9, ledger #10660)
- [ ] Real chains: no live object yet has a full signal-to-value chain (builds Phase 6, production/value Phase 7)

Phase 6
- [ ] Live builds on all five platforms (`pending_live_adapter`): needs URL + token + webhook secret per platform; simulated evidence attached
- [x] Live best_effort replay confirmed by user 16 Oct 2026 (see confirmation below).
- [x] Confidential clearance for all five builders confirmed by user 16 Oct 2026; restricted goes nowhere (supersedes original narrower Lovable choice).
- [ ] Iteration class is detected from a described diff (obligations / results / contracts / wording); real diff analysis needs live artifacts
- [ ] Test leftovers: practice chain BS-2026-0018, EO-2026-0001, TP-2026-0001, CP-2026-0001, BR-2026-0001…0006, IT-2026-0001
- [x] CONFIRMED 16 Oct 2026: live replays are best_effort on all five platforms; iteration class from described diff
- [x] CONFIRMED 16 Oct 2026 with change: Lovable is cleared up to confidential (not just public/internal); restricted goes nowhere

Phase 7
- [ ] Live Telemetry and FeatureFlags adapters (`pending_live_adapter`; simulated today, so no real authority can be earned yet)
- [ ] Steward to confirm provisional exposure steps 1→5→25→50→100% and the 60 s kill-switch bound
- [ ] Test leftovers: SH-2026-0001…0007, EA-2026-0001…0002, PO-2026-0001…0002, IN-2026-0001…0002, VA-2026-0001…0002, RB-2026-0001…0002 (self-test runs)

Phase 8
- [ ] Steward to confirm provisional timings: renditions live 7 days, stale ones are purged 24 h later; hourly deletion sweep; brief at 05:00 UTC
- [ ] Audio, video, interactive and live-demonstration kinds produce a script only (`pending_live_adapter`: no media adapter)
- [ ] CanonFragmentation finding (conflicting definitions across agents) — detector arrives with Phase 10
- [ ] Regeneration queue is recorded but stale renditions are not regenerated automatically (regenerated on request)
- [ ] Prohibited-inference detector is a fixed phrase list (agent-authored); needs human review and a query-side check (Phase 9/10)
- [ ] Test leftovers: practice renditions RN-2026-0005 and RN-2026-0008 (expire on their own)

- [x] Rendition PDF download (user request, after Phase 8): open-permission checks, ledger entry per download (e.g. #10440), confidential allowed, restricted allowed whenever the person may open it (confirmed by user 16 Oct 2026). Verified in browser with RN-2026-0009.

Phase 9
- [ ] 27 tools are registered with contracts but not yet runnable: 18 wait for later kernels (missions/cells/bursts and simulation in Phase 11, detectors and measures in Phase 10, live assurance adapters in Phase 12, council adapter, artifact webhooks) and 9 are people-only (consented framing capture, confirming intent, recording decisions). AW-13 is only partly met until they run.
- [ ] DESIGN DECISIONS to confirm: agents cannot confirm, decide or grant (enforced on the ledger); members may register agents up to "recommend", stewards up to "act_bounded", never autonomous; K3 confirmation tokens are single-use, 15 minutes, bound to agent + tool + exact arguments; high-consequence tools = production effects, publishing and dispatch_build; signal scores stay empty when the signal lacks the field; default quota 60/min, 2000/day, cost cap 10 units/day; tool cost units are provisional.
- [ ] MCP latency: p50 ~690 ms, p95 ~1.3 s on simulated builds versus the Part 16.4 budget p95 < 300 ms (non-generation). Needs session caching across isolates and fewer round trips.
- [ ] Injection detection recall 0.88, precision 1.00 on an agent-authored 50-item corpus; needs human relabelling and a larger corpus. Paraphrased attempts are missed (blocking still holds by typed schemas).
- [ ] Notifications are taken by polling (list_notifications); no server push stream yet.
- [ ] One shared implementation exists for compile, dispatch, reuse check, fabric search and rendition generation; the remaining tools mirror the page logic through the same database functions rather than a single shared schema.
- [ ] Older tool_contracts rows from Phases 1–8 (e.g. create_object, graph_*) remain with short contracts; reconcile names with Part 12.2.
- [ ] Test leftovers: agent "Claims intake agent"; VS-2026-0002…0005; BS-2026-0022 (confirmed by the agent before the people-only rule existed — retire it), BS-2026-0023…0025; CP-2026-0002…0003; build runs from the agent; HD-2026-0009…0012.

Phase 10
- [x] Required Section 2, full Appendix A, Parts 1.3.11, 8A.12, 11.9, 14.3, 15 and Phase 10 source re-read. Detection and Measurement surfaces added; six Phase 10 MCP operations connected.
- [x] 176 domain/routing tests passed, including 62 Phase 10 checks; preview build OK. Database acceptance checked during migrations 0044–0048: 37 explicit-observation inductions with assigned owners, schema guard, 54-hour connected-graph intent-to-value fixture, native unframed-signal detection, rejected/draft measure refusal, accepted-risk approver/expiry/refused-past-expiry/reopening. Fixtures roll back; no persistent test observations.
- [x] CanonFragmentation detector implemented for conflicting active definitions with identical type, title and scope; broader semantic conflicts remain below.
- [x] Query-side surveillance/rejected-measure refusal added across MCP read-only tools, with hash-only owned finding; the human-review item for the fixed phrase corpus remains open from Phase 8.
- [ ] Signed-in end-to-end validation: observation → owned finding → resolve/accept risk → refresh; Measure and record; measurement drill-through; external MCP calls. Blocker: browser is signed out, session mint found multiple accounts and no account matching the requester. User must sign in or identify an account for an approved test session. Signed-out pages were tested and correctly reached Sign in with no browser errors.
- [ ] Native operating failure induction for every ValueOS mode, beyond the 37 explicit-observation fixtures. Blocker: mission/feed/mechanical-work evidence kernels and live adapters; current semantic conditions require explicit observations or typed fields, not inferred personal activity. The exit gate is not claimed fully met.
- [ ] Full live intent-to-value chain and independently sourced production measurements. Blocker: live Telemetry/FeatureFlags/build adapters from earlier phases; simulated data must not become realised value. Connected graph calculation proved 54 hours in rollback-only fixtures, not real production.
- [ ] Remaining community/compounding measures (bounded mission ownership, business participation, future creation-time reduction) and cross-object stage timing where links are absent. Blocker: Phase 11 mission/cell evidence; missing evidence is displayed rather than guessed.
- [ ] Steward review of provisional detection choices: same-title/scope definition comparison, explicit semantic observations expiring after 7 days, and hourly reconciliation (24/day; event checks immediate, time-based conditions within 1 hour). No AW-5 threshold was supplied.
- [ ] Target-scale sweep cost, performance and independent human-labelled false-positive/false-negative tests. Blocker: representative corpus/live integrations; full sweeps currently run transactionally on object, edge and rendition changes.
- [ ] AW-5 aggregate session recording completeness and Carey’s recorded thresholds remain unresolved; ratios are computed only from available permission-scoped usage evidence and return THRESHOLD_UNSET without a decided setting.
- [ ] Extend canonical Detector/DetectorFinding envelope objects alongside operational registry/findings and reconcile finding statuses; currently operational findings preserve Phase 1 open/resolved/accepted_risk states. Blocker: specification reconciliation needed without breaking existing finding consumers.

Phase 11
- [x] Required Section 2, Appendix A and cited Parts 5.3–5.5, 11, 18 and 21.4 re-read; Feed, Companion, Mission Runtime, Simulation Studio and direct Capture entry added. Existing Fabric, Canon, Decision Queue and graph/evidence surfaces remain available.
- [x] 195 domain/routing tests passed, including 19 Phase 11 rules. Build OK. Migration 0052 ran 11 rollback-only database checks: distinct humans, proof, burst lower/upper bounds, ledger-backed burst edge, substantive-output refusal, simulated/not-executed probe, simulated-output refusal, cited guidance, wrong-purpose refusal and source-change staleness. No persistent fixture objects were created.
- [ ] Signed-in end-to-end checks and accessibility review of every new surface. Blocker: requester has no matching account for session mint; all seven new destinations were tested signed out and reached Sign in without browser errors. User must sign in or authorize an identified account. WCAG 2.2 AA is not claimed verified.
- [ ] Real two-person mission → cell → burst → substantive outcome acceptance. Blocker: no second human account available; agent accounts are explicitly excluded from human Co-Creator/Builder roles. Single-identity rollback fixtures exercise negative rules, not a two-person operating loop.
- [ ] Complete Part 21.4 exit suite, live intent-to-working-evidence compression, participation evidence and action ratios. Blockers: real human usage, live build/telemetry/exposure adapters, Carey's AW-5 decision (no threshold default set). Phase 11 exit is not claimed passed.
- [ ] Companion is evidence-grounded but rule-based, not a full conversational planning agent; contextual mission recommendation and automatic action selection remain unimplemented. Simulation Studio is rule-based adaptive feedback, not independently assessed or model-driven. Blocker: human validation of behaviour and scenario quality, followed by agreed scope for a conversational implementation.
- [ ] Companion signal creation currently opens Canon rather than creating directly; a multi-source permission-intersection write is required before enabling the shortcut. Blocker: permission-preserving action integration.
- [ ] Capability simulation/adversarial execution remains pending: probes can be recorded with simulated provenance and `not_executed`; MCP simulation tools intentionally remain `pending_kernel` rather than claiming recorded probes passed. Blocker: capability execution harness and live artifacts.
- [ ] Full Feed event coverage (reuse events and stopped-mission narratives), continuous push updates and evidence-linked generated mission panels remain incomplete. Current Feed is a permission-scoped recent-object list, capped at 200; Mission Runtime shows canon evidence and connected requests. Blocker: representative operating events and complete event/rendering integration.
- [ ] Mission Constellation entry added as three-hop Focus over the mission, but mission-specific precomputed layouts, historical graph replay, dedicated `/evidence/$capabilityId` and `/sessions/$sessionId` destinations remain unimplemented. Existing `/evidence` and `/framing/$sessionId` remain unchanged. Blocker: Phase 11 graph/route completion, not Phase 12 authorization.
- [ ] Human account selection currently uses account IDs; authenticated account directory/invitation UX remains incomplete. Burst clocks record the planned end and phases but do not orchestrate phase transitions, capture or automatic expiry. Blocker: consent-aware session integration and real two-person workflow validation.

Phase 12
- [x] Re-read Section 2, full Appendix A, Phase 12 source and Parts 14.1–14.7, 16.3–16.4, 19, 21.1–21.5. Earlier unfinished slices are preserved, not represented as Phase 12 authorization to complete them.
- [x] Closed anonymously/authenticated-callable privileged Phase 7 write functions and self-tests; security-definer trigger helpers are not API-callable. Preserved authenticated RLS predicates. Actual database catalog query now returns zero exposed privileged thread writes and zero anon-callable security-definer functions. Linter improved from 57 to 9 warnings (two extension placement warnings and seven intentionally authenticated read/RLS functions); no security certification is claimed.
- [x] MCP transport bounds: 256 KiB including chunked requests and 20 batch messages before dispatch, empty/oversized batches refused, no-store on successful session-dependent responses. Build callback body is bounded and its external run ID must match the recorded platform run.
- [x] Human-surface context now uses bounded three-hop breadth-first retrieval, RLS before node admission, maximum 200 nodes/1,000 returned edges, explicit truncation and active directional indexes. This fixes unbounded neighborhood materialization; it is not a tenfold load pass or a replacement for every graph query's scale review.
- [x] Tier 4 promotion/grant and every Tier 4 exposure require a real current capability-linked ConfirmedDecision by the actual authorizing human distinct from the named Builder and creator; null/unrelated/nonhuman/simulated judgments refused. Positive independent two-human acceptance remains blocked below.
- [x] Added Assurance surface, caller-permission assessor chain/answer queries, source links, steward/compliance-only internal check receipts and cited ControlChecks. Passed assurance conditions require current live evidence, purpose/role predicate equality, appropriate source fields for penetration/WCAG/recovery/load/independent tests. Recorded evidence is explicitly not proof that evidence is true. Assurance authoring is human-only; no live execution adapter is fabricated.
- [x] Internal database acceptance in migrations 0053–0056: 10 catalog/integrity/bounded-context checks, seven rollback-only assurance checks and the existing 11 Phase 11 rollback checks passed. Ledger/version snapshot integrity passed in the migration; snapshot replay remains simulated. No persistent fixture objects were created.
- [x] All 208 domain/routing tests passed (13 Phase 12 tests); Phase 12 tests rerun after transport refactor. Preview build OK. Fresh browser verification: /assurance redirects signed-out to /auth, no error boundary or page errors; MCP without token returns 401, unknown build platform returns 404. These are public-path checks only.
- [x] Operational procedures saved in docs/THREAD-operator-runbooks.md: integrity incidents, actual backup restore, authorized penetration/remediation, retention/legal hold/erasure, representative scale rehearsal, compliance walkthrough and accessibility audit. Procedures are not represented as completed execution evidence.
- [ ] Signed-in Assurance → internal receipt → cited condition read-back → assessor query end-to-end and authenticated accessibility. Blocker: session mint for requester fails (no matching human account); user must sign in or authorize a specifically identified account. No account was selected arbitrarily.
- [ ] Independent authorized penetration test and remediation/owner-accepted findings before platform production exposure, then annual testing. Blocker: independent assessor and authorized testing scope; internal negative tests do not qualify. Mark pending_live_adapter with existing synthetic evidence.
- [ ] Actual platform backup restore, replication/PITR evidence, timed RPO ≤15 min/RTO ≤4 h, post-restore ledger checkpoint comparison. Blocker: inherited infrastructure backup/restore operator and isolated restore environment; current snapshot check is simulated, not a DR rehearsal pass.
- [ ] Full authenticated WCAG 2.2 AA audit with assistive technology and remediated/retested findings. Blocker: signed-in representative flows and independent accessibility review; signed-out render is not the audit.
- [ ] Tenfold upper year-one load rehearsal: 5M operating objects, 30M relationships, 15M evidence, 1M live renditions, 2,000 peak humans, 5,000 agent calls/s; Part 16.4 budgets and real 20,000-node graph test. Blocker: isolated representative corpus, load infrastructure and live execution inputs. Targets alone are not capacity evidence; remaining graph traversals require budget review.
- [ ] Tier 3/4 live adversarial execution, compliance/safety/financial/rights independent verification, two-human Tier 4 positive authorization, mutation sampling and human test-intent review. Blocker: independent execution/generation routes and real Builder/independent authorizer identities. ≥70% overall/100% compliance-scoped independent verification is not measured or claimed.
- [ ] Compliance-officer walkthrough and real external assessor question answered with cited evidence in under one hour. Blocker: actual officer/assessor and representative real chain. Displayed query milliseconds do not establish this exit condition.
- [ ] Complete per-class canon-owned retention schedules, six-year compliance retention/legal hold by default, personal-data erasure disposition, physical storage purge and restricted-read audit completeness. Blocker: approved policy/lawful disposition and storage execution integration. Existing hourly rendition purge and 05:00 briefs remain unchanged/provisional; no evidence/ledger physical purge introduced. Scheduled-job execution health remains unverified.
- [ ] Factory-inherited controls/attestations, SSO-only transition (local accounts still exist), production credentials isolation, safe observability and platform availability targets (99.9% reads/writes/tools; 99.5% generation). Blocker: organizational identity/control owners and live hosting evidence; source code does not establish hosted settings.
- [ ] Full AW-1…AW-15 release-blocking acceptance and operating-model dogfooding; Carey AW-5 action thresholds remain NULL/open with no default. Blocker: real usage, unfinished Phase 10/11 items, live builds/telemetry and human decisions. Phase 12 exit is not claimed passed.

Whole-build audit — permanent open items
- [ ] Full registered body-schema/type/version parity and validation of every write/revision; generic human creation is protected for seven contracts only. No external blocker; unfinished engineering.
- [ ] Trusted domain-scoped participant decision authority and actual ConfirmedDecision source existence/type/authority/provenance; current declarations/nonempty references insufficient. Blocker: organizational identity/authority integration plus engineering.
- [ ] Purpose/context/attribute/permitted-use predicate compiler, every-hop dynamic composition permissions and all-query two-identity leakage tests. Blocker: trusted organizational claims and isolated acceptance environment; engineering remains.
- [ ] Section19 request/response parity for every function/tool; nested typed output schemas, combined fabric search/reuse, real legacy finding, scopes/windows, complete HDR/evidence fields, contract reconciliation. No external blocker for interface correction; execution adapters still required for pending kernels.
- [ ] Privacy-safe semantic usage sessions and safe aggregate measurement, set/open vs decided status correction, actual intent-to-first-evidence publication. AW-5 stays NULL/open until Carey decides; do not infer defaults. Engineering plus real usage.
- [ ] All remaining graph/path/closure work bounds and depth-truncation disclosure; Phase1 current database suite exceeds 30 seconds from repeated full graph/framing sweeps. Candidate materialization improved one source but did not solve total cost. No pass claimed.
- [ ] Orphan remediation with real source relationships/retirement disposition; current 92 non-draft orphans. No invented edges or silent evidence deletion. Preserve audit-created legacy regression leftovers and prior practice records until accountable cleanup.
- [ ] Full P1–P15 runtime acceptance, guardrail positive/negative, native detector induction/recurrence, isolated schema mutation, independent test-route/human-review evidence, authenticated Mission Runtime OCR/surface flows and dogfooding. Blocker: isolated environment, requester/second human, independent reviewer and live adapters.
- [ ] Generic live evidence receipts/assessor execution verification; JSON adapter_mode='live' is not verified execution. Compliance walkthrough passing intentionally blocked without execution proof; full real assurance remains pending.
- [ ] Complete regeneration/orchestrated burst/accessible surface/account onboarding workflows; lifecycle adjacency/evidence shortcut and source inconsistencies reconciliation. No invented policy values; engineering plus real workflow review.

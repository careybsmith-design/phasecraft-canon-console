# THREAD roadmap

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
- [ ] Phase 12 — Hardening, assurance and scale (in progress; user authorized 16 October 2026)

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
- [ ] Confirm DESIGN DECISION: live replays are `best_effort` on every platform (none guarantees determinism)
- [ ] Confirm platform clearance: Lovable gets public/internal only; self-hosted get up to confidential; restricted goes nowhere
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

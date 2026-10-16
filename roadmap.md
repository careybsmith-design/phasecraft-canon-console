# THREAD roadmap

- [x] Phase 1 — Canon and envelope
- [x] Phase 2 — Operating Graph core; 20,000-node benchmark met (median 30.1 fps, ledger #1150)
- [x] Phase 2B — Framing session capture and extraction
- [x] Phase 3 — Authority, guardrails and decisions; exit evidence ledger #1788
- [x] Phase 4 — Capability Fabric; exit evidence ledger #3674
- [x] Phase 5 — Evidence graph; exit evidence ledger #4906
- [x] Phase 6 — Creation loop and platform integration (waiting for user approval); exit evidence ledger #7282
- [x] Phase 7 — Shadow, exposure and production outcome (waiting for user approval); exit evidence ledger #7462
- [ ] Phase 8 … Phase 12 per Section 16

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
- [ ] MCP exposure of explain_capability / trace_* (contracts recorded; endpoint arrives in Phase 9)
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

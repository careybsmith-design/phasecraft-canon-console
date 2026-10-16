# Authority engine (Phase 3) rules

- The authority engine is pure TS in `src/server/authority/engine.ts` (no I/O, callers pass `now`); server functions in `src/lib/authority.functions.ts` load it inside handlers. Why: Section 5, the same deterministic module runs in tests and in production.
- Authority changes only through `thread_set_authority` / `thread_authority_event`; `authority_guard` rejects any `authority_level` change without a same-transaction `authority_history` row. SQL `_demotion_target` must mirror `demote()` in the engine. Why: 6.2 demotion is automatic and auditable.
- DESIGN DECISION: risk tier = max of per-input floors; confidence rule cr-1.0.0 = weakest required dimension; promotion thresholds are provisional values in the `human_oversight` guardrail params; reset-to-observe vs step-down split for demotion triggers. Part 6 gives none of these numbers.
- `decision_queue_guard` enforces the exact Part 6.5 field set on HumanDecisionRequest and the four responses (decide, one clarification, reduce authority, stop) on Decision. Council engagements are ConfirmedDecision with source governance_council.
- The Phase 3 seed (`scripts/seed-phase3.ts`) is generated from engine constants; change both together.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# THREAD build rules

- The spec lives in `docs/THREAD-spec.md` (full) and `docs/THREAD-build-directives.md` (Sections 1–19). Re-read Section 2, Appendix A and the cited Appendix C parts before every phase; build one phase at a time and wait for user approval.
- All writes to `objects` go through the `thread_*` security-definer functions (service role only), called from `src/lib/canon.functions.ts` with the actor taken from the verified session. Why: triggers then guarantee ledger-first provenance (P9).
- `enforce_provenance` requires a ledger row in the same transaction with matching chain, version and content hash. Why: a provenance gap or forged entry is impossible, not just discouraged.
- Ledger and `object_versions` are append-only (revoked grants plus rejecting triggers). Objects are tombstoned, never deleted.
- Lifecycle families are ordered ranks in `src/domain/lifecycle.ts`; a transition may go only to a strictly later rank. DESIGN DECISION: Part 4.4 lists sequences; reversals become new versions (P15), never state regressions. Types without a Part 4.4 family use `canon`, `evidence_record` (recorded→superseded→retired) or `framing_extract` (draft→confirmed→superseded).
- The DB seed for registry and lifecycles must mirror `src/domain/lifecycle.ts` and `src/domain/registry.ts`; change both together.
- WorkingCapability, ExposurePopulation and AuthorityGrant are registered because Part 4.2 verbs reference them although Part 4.3 has no row for them.
- The first account to sign up becomes `steward`; everyone is `member`. DESIGN DECISION until the IdentityProvider adapter exists.
- Restore rehearsal is a snapshot-replay check (`thread_restore_rehearsal`) recorded as simulated; a platform backup restore stays `pending_live_adapter`.
- `/` redirects to `/canon` until the Feed surface (Phase 11) exists.
- Relationship verbs are data in `src/domain/relationships.ts`; the DB seed (`scripts/gen-phase2-seed.ts`) must mirror it. Why: edge type checks in `thread_create_edge` and the UI agree.
- Edges are written only via `thread_create_edge` / `thread_retire_edge`; `edges_guard` requires a same-transaction ledger entry and allows only retirement. Why: P9 applies to relationships too.
- DESIGN DECISION: each verb has an `impact` direction (forward/reverse/both/none) for blast radius; Part 4.2 does not state propagation. `derives_from` is registered because Part 4.5 rule 6 names it.
- Graph reads are SQL functions (`graph_*`) run as the caller so permissions apply. Nebula positions are precomputed server-side in `graph_layouts` (deterministic cluster ring + golden spiral, clustered by type family until missions exist) and refreshed after each write. Why: Part 16.5, the browser never solves a large layout.
- Active Canon-family objects change content only through `thread_propose_canon_change` -> challenge window (min 24 h, default 72 h) -> steward `thread_decide_canon_change`, which records a ConfirmedDecision; the `canon_change_path` trigger blocks anything else. Drafts are edited directly. Why: P15.
- DESIGN DECISION: the Challenge Agent is rule-based until ModelGateway exists (Phase 2B).
- Graph-integrity detectors (GraphOrphan, DependencyCycle, CanonDrift, CanonWithoutSteward) are owned by the first steward and swept after writes; Phase 10 owns the full detector suite.
- The browser build pins the bare `events` / `node:events` import to the `events` npm package (plugin in `vite.config.ts`). Why: the toolchain otherwise stubs it, breaking sigma's EventEmitter base class.
- Framing (Phase 2B) logic lives in `src/domain/framing.ts` (pure post-rules, materiality, entry test, P/R) and `src/server/framing/extractor.ts` (ModelGateway calls); server functions in `src/lib/framing.functions.ts`. Why: the DB triggers, the tests and the UI share one rule set.
- `framing_guard`, `creation_source_guard` and `session_events_guard` enforce consent-before-capture, decisions only from authority holders, human-only promotion of context/question, confirmation preservation, and close-with-no-unrecorded-items in the database. Why: Part 8A NON-NEGOTIABLEs must not depend on the UI.
- FramingSession uses the `framing_session` lifecycle (planned→capturing→closed→retired); extracted items use `framing_extract` (draft→confirmed|rejected→superseded). A decision becomes a ConfirmedDecision only when its authority holder confirms it.
- Tier B content is classified by in-boundary rules (no external model call); Tier C is never stored or sent anywhere. Speech goes through the simulated Transcription adapter and is ledgered `adapter_mode='simulated'` (enforced in `thread_create_object`).
- DESIGN DECISION: prior-object surfacing uses trigram + full-text similarity (`framing_related_objects`) until an embedding route is warm; participants without accounts have consent attested by the Builder.
- The authority engine is pure TS in `src/server/authority/engine.ts` (no I/O, callers pass `now`); server functions in `src/lib/authority.functions.ts` load it inside handlers. Why: Section 5, the same deterministic module runs in tests and in production.
- Authority changes only through `thread_set_authority` / `thread_authority_event`; `authority_guard` rejects any `authority_level` change without a same-transaction `authority_history` row. SQL `_demotion_target` must mirror `demote()` in the engine. Why: 6.2 demotion is automatic and auditable.
- DESIGN DECISION: risk tier = max of per-input floors; confidence rule cr-1.0.0 = weakest required dimension; promotion thresholds are provisional values in the `human_oversight` guardrail params; reset-to-observe vs step-down split for demotion triggers. Part 6 gives none of these numbers.
- `decision_queue_guard` enforces the exact Part 6.5 field set on HumanDecisionRequest and the four responses (decide, one clarification, reduce authority, stop) on Decision. Council engagements are ConfirmedDecision with source governance_council.
- The Phase 3 seed (`scripts/seed-phase3.ts`) is generated from engine constants; change both together.

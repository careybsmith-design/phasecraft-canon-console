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

- Read docs/THREAD-spec.md Section 2, Appendix A and cited Appendix C before each approved phase. docs/THREAD-correction-packet.md overrides its specified contradictions; report directive evidence separately. Why: implementation is not exit acceptance.
- Privileged `thread_*` writes and trigger helpers are service-role-only; actors come from verified sessions. Authenticated RLS predicates remain callable. Why: public keys cannot forge writes (P9).
- `enforce_provenance` requires a ledger row in the same transaction with matching chain, version and content hash. Why: a provenance gap or forged entry is impossible, not just discouraged.
- Ledger and `object_versions` are append-only (revoked grants plus rejecting triggers). Objects are tombstoned, never deleted.
- Lifecycle families are ordered ranks in `src/domain/lifecycle.ts`; a transition may go only to a strictly later rank. DESIGN DECISION: Part 4.4 lists sequences; reversals become new versions (P15), never state regressions. Types without a Part 4.4 family use `canon`, `evidence_record` (recorded→superseded→retired) or `framing_extract` (draft→confirmed→superseded).
- The DB seed for registry and lifecycles must mirror `src/domain/lifecycle.ts` and `src/domain/registry.ts`; change both together.
- WorkingCapability, ExposurePopulation and AuthorityGrant are registered because Part 4.2 verbs reference them although Part 4.3 has no row for them.
- The first account to sign up becomes `steward`; everyone is `member`. DESIGN DECISION until the IdentityProvider adapter exists.
- Restore rehearsal is a snapshot-replay check (`thread_restore_rehearsal`) recorded as simulated; a platform backup restore stays `pending_live_adapter`.
- `/` redirects to the protected `/feed` surface and sign-in opens it. Why: home is a place to act without duplicating the root route.
- Relationship verbs are data in `src/domain/relationships.ts`; the DB seed (`scripts/gen-phase2-seed.ts`) must mirror it. Why: edge type checks in `thread_create_edge` and the UI agree.
- Edges are written only via `thread_create_edge` / `thread_retire_edge`; `edges_guard` requires a same-transaction ledger entry and allows only retirement. Why: P9 applies to relationships too.
- DESIGN DECISION: each verb has an `impact` direction (forward/reverse/both/none) for blast radius; Part 4.2 does not state propagation. `derives_from` is registered because Part 4.5 rule 6 names it.
- Graph reads are SQL functions (`graph_*`) run as the caller so permissions apply. Nebula positions are precomputed server-side in `graph_layouts` (deterministic cluster ring + golden spiral, clustered by type family until missions exist) and refreshed after each write. Why: Part 16.5, the browser never solves a large layout.
- Active Canon-family objects change content only through `thread_propose_canon_change` -> challenge window (min 24 h, default 72 h) -> steward `thread_decide_canon_change`, which records a ConfirmedDecision; the `canon_change_path` trigger blocks anything else. Drafts are edited directly. Why: P15.
- DESIGN DECISION: the Challenge Agent is rule-based until ModelGateway exists (Phase 2B).
- Graph-integrity detectors (GraphOrphan, DependencyCycle, CanonDrift, CanonWithoutSteward) are owned by the first steward and swept after writes; Phase 10 owns the full detector suite.
- The browser build pins the bare `events` / `node:events` import to the `events` npm package (plugin in `vite.config.ts`). Why: the toolchain otherwise stubs it, breaking sigma's EventEmitter base class.

- Read nested `AGENTS.md`, including components presentation rules, before changes.
- Fabric rules are pure in `src/domain/fabric.ts`, mirrored in SQL (`_capability_gaps`, `reuse_checks_guard`, `fabric_search`, `thread_fabric_sweep_scoped`); change both together. Creation (CreationPrompt/BuildRun objects, `creation_prompts`) is blocked in the DB without a reuse check that allows it. Why: P11 by system, not convention.
- Self-test fixtures for every registered type come from `_selftest_body` / `_selftest_refs` / `_selftest_next_state`; extend these when a new guard is added, not the phase self-tests.
- Evidence graph rules: see src/server/evidence/AGENTS.md (read before changing evidence/trace DB functions).
- Shadow/exposure rules: see src/server/shadow/AGENTS.md.
- Generation (renditions) rules: see src/server/generation/AGENTS.md.
- Read src/server/detection/AGENTS.md for measurement changes; use anti_wiki_action_ratio, never usage_sessions directly. Why: only windowed aggregates may leave measurement.
- Human surfaces and Phase 12 assurance: read src/server/ops/AGENTS.md first. Why: shared schemas, caller RLS and ledger-first writes distinguish simulated checks from live assurance.
- Generic human creation accepts only `generic-body.ts` contracts; other types require dedicated operations. Why: placeholder registry schemas cannot authorize arbitrary bodies.
- Bundle downloadable audit test transcripts as `.txt`, never ignored `.log` files. Why: ignored files disappear from deployment source and break raw imports.
- Live speech capture uses `src/server/adapters/transcription/live.server.ts` (gateway Whisper-class model); the browser records WAV chunks with a durable IndexedDB outbox (`src/lib/live-capture.ts`). Why: 8A.13 zero-loss and no GPU self-hosting on the edge runtime.
- Per-user Microsoft connector code lives in `src/lib/framing.functions.ts` (connect/ingest server fns) with helpers in `src/integrations/lovable/appUserConnector.ts` and `src/server/appUserConnections.server.ts`; `.functions.ts` files must never statically import server-only modules or export plain helpers — both break the client/server split (import-protection 500s).

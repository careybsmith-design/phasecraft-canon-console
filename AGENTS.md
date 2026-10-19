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

- Read docs/THREAD-spec.md Section 2, Appendix A and cited Appendix C before each approved phase. docs/THREAD-correction-packet.md overrides its specified contradictions; report directive evidence separately.
- Privileged `thread_*` writes and trigger helpers are service-role-only; actors come from verified sessions. Authenticated RLS predicates stay callable. Why: public keys cannot forge writes (P9).
- `enforce_provenance` requires a same-transaction ledger row with matching chain, version and content hash. Why: a provenance gap or forged entry is impossible, not just discouraged.
- Ledger and `object_versions` are append-only (revoked grants plus rejecting triggers). Objects are tombstoned, never deleted.
- Lifecycle families are ordered ranks in `src/domain/lifecycle.ts`; transitions go only to a strictly later rank (reversals become new versions, P15). Types without a Part 4.4 family use `canon`, `evidence_record` or `framing_extract`. The DB seed must mirror `lifecycle.ts` and `registry.ts`; change both together.
- WorkingCapability, ExposurePopulation and AuthorityGrant are registered because Part 4.2 verbs reference them though Part 4.3 has no row for them.
- The first account to sign up becomes `steward`; everyone else is `member` until the IdentityProvider adapter exists.
- Restore rehearsal is a snapshot-replay check (`thread_restore_rehearsal`) recorded as simulated; a platform backup restore stays `pending_live_adapter`.
- `/` redirects to the protected `/feed` surface and sign-in opens it. Why: no duplicate root route.
- Relationship verbs are data in `src/domain/relationships.ts`; the DB seed (`scripts/gen-phase2-seed.ts`) must mirror it. Edges are written only via `thread_create_edge` / `thread_retire_edge`; `edges_guard` requires a same-transaction ledger entry and allows only retirement. Why: P9 applies to relationships too.
- DESIGN DECISION: each verb has an `impact` direction (forward/reverse/both/none) for blast radius; Part 4.2 does not state propagation. `derives_from` is registered because Part 4.5 rule 6 names it.
- Graph reads are SQL functions (`graph_*`) run as the caller so permissions apply. Nebula positions are precomputed server-side in `graph_layouts` and refreshed after each write. Why: Part 16.5, the browser never solves a large layout.
- Active Canon-family objects change only via `thread_propose_canon_change` -> challenge window (min 24 h, default 72 h) -> steward `thread_decide_canon_change` (records a ConfirmedDecision); the `canon_change_path` trigger blocks anything else. Drafts are edited directly. Why: P15.
- The Challenge Agent is rule-based until ModelGateway exists (Phase 2B).
- Graph-integrity detectors (GraphOrphan, DependencyCycle, CanonDrift, CanonWithoutSteward) are owned by the first steward and swept after writes; Phase 10 owns the full suite.
- The browser build pins `events` / `node:events` to the `events` npm package (plugin in `vite.config.ts`). Why: the toolchain otherwise stubs it, breaking sigma's EventEmitter base class.

- Fabric rules are pure in `src/domain/fabric.ts`, mirrored in SQL (`_capability_gaps`, `reuse_checks_guard`, `fabric_search`, `thread_fabric_sweep_scoped`); change both together. Creation is blocked in the DB without an allowing reuse check. Why: P11 by system, not convention.
- Extend `_selftest_body` / `_selftest_refs` / `_selftest_next_state` for new guards. SI-1 uses rollback-only ledger-valid inserts in `thread_signal_intake_selftest`. Why: only its trigger exception may pass.
- Read nested AGENTS.md files (including src/components and src/server/{evidence,shadow,generation,detection,ops}) before changing those areas. Measurement uses anti_wiki_action_ratio, never usage_sessions directly. Why: only windowed aggregates may leave measurement.
- Generic human creation accepts only `generic-body.ts` contracts; other types need dedicated operations. Why: placeholder schemas cannot authorize arbitrary bodies.
- Bundle audit test transcripts as `.txt`, never ignored `.log` files. Why: ignored files disappear from deployment source and break raw imports.
- Live speech capture: `src/server/adapters/transcription/live.server.ts` (gateway Whisper-class model) + WAV-chunk recorder with durable IndexedDB outbox (`src/lib/live-capture.ts`). Why: 8A.13 zero-loss; no GPU on the edge runtime.
- Per-user Microsoft connectors (Teams/Outlook) live in `src/lib/framing.functions.ts` with helpers in `src/integrations/lovable/appUserConnector.ts` and `src/server/appUserConnections.server.ts`. `.functions.ts` files never statically import server-only modules or export plain helpers — both break the client/server split.
- Signal intake: thread_signal_intake creates signals; mission_signal_gate requires a promoted signal. Events are append-only; intake_event_id links non-object events. Reads combine membership and can_read_object classification. thread_intake_read_selftest uses authenticated-role SELECTs and rollback-only rows, with invoker rights. Why: enforce intake and prevent audit-reference leakage without admin-bypass tests.

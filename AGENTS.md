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

# Material confirmation and intake visibility — 19 October 2026

Executed the uploaded `THREAD-Followup-Material-Confirm.md`. Confirmation was verified, not rebuilt; no second confirmation path was added. Companion and mission-form controls were left unchanged.

## Item 1 — three evidence results

1. **Requested MCP participant exception is not the current behavior.** `confirm_object` is registered as human-only (`src/domain/mcp-tools.ts:193`) and `tools/call` reaches `callTool` (`src/server/mcp/gateway.server.ts:203–206`). The gateway refuses it with `HUMAN_ONLY` before handler dispatch (`:127–130`), not `PARTICIPANT_REQUIRED`. The existing handler (`src/server/mcp/tools.server.ts:339–340`) calls `thread_transition_object`, not the framing confirmation function. The new gateway regression exercises the JSON-RPC dispatch and asserts `structuredContent.code = HUMAN_ONLY` and no handler execution.
2. **Material-item authority refusal passes in the existing framing function.** `confirmObject` (`src/lib/framing.functions.ts:1681–1708`) refuses a draft marked material from a participant without decision authority with `AUTHORITY_REQUIRED_TO_CONFIRM`, before any write. A new mocked server-function regression executes this handler and verifies the exact refusal and zero RPC writes. Additional negative cases document current ordering: a nonmaterial draft from a nonparticipant session owner yields `PARTICIPANT_REQUIRED`; a material draft from that owner yields `AUTHORITY_REQUIRED_TO_CONFIRM` first; an unrelated nonparticipant yields `AUTHORITY_INSUFFICIENT` at session access. These are handler regressions, not a real second-human acceptance session.
3. **Confirmation is visible, but an unconditional pre-action authority requirement is absent.** `src/routes/_authenticated/framing.$sessionId.tsx:813–824` exposes Confirm for drafts. It displays a warning only when `body.authority_mismatch` exists (`:783–785`); it does not independently display the material/decision/NeedStatement authority requirement before Confirm. Signed-in browser inspection of `/framing/01a142d7-6f2c-7c68-9d54-339904ce9c81` showed XS-2026-0022, its Confirm/Edit/Reject controls and its conditional authority-mismatch text. No page errors occurred. This does not establish that every material draft has a pre-action warning; source inspection establishes the missing unconditional requirement. No UI behavior was changed, per the verify-only instruction.

## Item 2 — actual RLS counts

Applied `drizzle/migrations/0075_intake_read_classification.sql`. Number 0074 was already occupied by the SI-1 database self-test, so it was preserved rather than edited or reused. Migration 0072 was not changed.

`intake_read` now requires both `_is_current_member(auth.uid())` and `can_read_object('{}'::jsonb, data_classification)`.

`thread_intake_read_selftest()` inserts one internal, one restricted and one prohibited content-free rejected audit fixture, switches to the authenticated database role with existing plain-member and steward identities, and executes actual intake SELECTs by fixture ID. It is invoker-rights, privileged-runner-only; the fixtures, role and claims changes roll back in a subtransaction. The migration runs it fail-closed, and it was executed again through the privileged data-query runner.

| Caller | Selected fixtures | Count |
|---|---|---:|
| Plain member | Restricted | **0** |
| Plain member | Internal | **1** (full fixture count) |
| Steward | Internal + restricted | **2** (both fixtures) |
| Steward | Prohibited (additional negative check) | **0** |

Result: `all_ok = true`. A subsequent independent query returned **0 persisted fixture rows**. The reader-only query tool could not execute the privileged self-test; its permission-denied response was expected, and no grant was widened to accommodate it.

## Scope and remaining discrepancies

P8 / Part 14.2 retrieval classification is exercised at RLS, not by an administrator read or a predicate-only check. Appendix C 8A.10 confirmation remains the existing mechanism. This follow-up does not resolve the separately recorded trusted organizational authority or real two-human acceptance gaps.

The MCP exception mismatch and absence of an unconditional pre-action authority warning remain recorded in roadmap.md; this prompt explicitly requested evidence rather than rebuilding Item 1.
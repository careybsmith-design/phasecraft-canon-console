# MCP gateway rules (Phase 9)

- `src/domain/mcp-tools.ts` is the single tool catalogue; contracts in `tool_contracts` are generated from it (`thread_sync_tool_contracts`, on initialize). Add a tool there and a handler in `tools.server.ts`. Why: one schema drives validation and the published contract.
- Every tools/call goes begin (`thread_agent_begin_call`: token, ceiling, quota, cost cap, K3 token) -> schema -> injection scan -> handler -> end (`thread_agent_end_call` writes the provenance ledger entry). Never call a handler outside `callTool`.
- Agents are their own sign-in-less accounts; reads use `agentReadClient` so row permissions apply at retrieval. Writes use thread_* with actor kind agent plus agent_id and call_id.
- Agents cannot confirm, decide or grant: the `ledger_agent_human_only` trigger refuses it. Why: confirmation and authority belong to people (K3).
- K3 token input hash = sha-256 of `canonicalJson` of the schema-parsed arguments minus `confirmation_token`; `issueConfirmation` must hash the same way.
- Shared operation cores live in `src/server/ops`; pages and the gateway both call them.
- Mission, cell and burst inputs use the human-surface schemas and `thread_human_operation`; probe-only simulation records are not executable simulations. Why: callers cannot bypass the bounds or mistake a recorded scenario for a passed test.
- Notifications fan out from a deferred ledger trigger, so the object exists when permissions are checked.
- MCP HTTP accepts at most 256 KiB and 20 batch messages before dispatch; session-dependent replies are no-store. Why: resource use must be bounded.
- Completion errors return `CALL_COMPLETION_FAILED` with call ID and uncertain effects; never issue a second completion or replay automatically. Why: a lost receipt does not prove the operation rolled back.
- `evaluate_authority` uses the shared action-aware authority core, verified agent ceiling, and actor/action-scoped grants; it only records evaluation or escalation. Why: lookup is not evaluation and confidence never grants execution authority.
- Published output schemas validate required fields and finite plain JSON before receipts/results; artifact injection scans normalize compatibility and zero-width text. Why: serialization and hidden characters cannot silently bypass the gateway boundary.
- Object reads require one identity; historical snapshots require current-parent visibility, search honors state filters, and withdrawal preserves caller-readable evidence. All multi-read handlers reject read errors. Why: missing access or failed retrieval must not masquerade as empty successful evidence.

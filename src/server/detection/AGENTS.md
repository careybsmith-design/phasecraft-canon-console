# Detection and measurement
- Native detector conditions and explicit evidence observations are distinct; mirror SQL catalogue fact keys in src/domain/detection.ts. Why: semantic observations must never be presented as machine-inferred facts.
- Measurement reads run as the caller via phase10_measurements/get_intent_to_value_time, shared by pages and MCP; null means missing live evidence. Why: outcomes cannot be replaced by manual reports or activity measures.
- Object, edge and rendition triggers run sweeps with recursion protection; hourly reconciliation handles time-based conditions. Why: no permanent event polling.
- Finding resolution and accepted risk go through thread_resolve_finding; accepted risk requires a human approver and future expiry. Why: owned, auditable exceptions never become permanent exemptions.
- Each sweep materializes the current candidate set once for reconciliation and insertion. Why: repeating the complete detector query for every finding caused the canon self-test to time out.
- Action-ratio readers recognize canon settings status `set`, and require a non-null value; `open` always fails unset. Why: the reader must agree with Section 18 without inventing Carey's thresholds.
- Acceptance suites aggregate check verdicts with `IS DISTINCT FROM 'true'` and recorders combine every suite's `passed` flag fail-closed (migration 0064). Why: SQL three-valued logic skips NULL assertions, and appended checks without their verdict let a failed suite accompany a passed receipt.

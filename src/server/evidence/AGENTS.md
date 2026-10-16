# Evidence graph (Phase 5) rules

- Evidence graph (Part 5) is SQL: `evidence_chain`, `chain_completeness`, `explain_capability(_all)` and the ten `trace_*` functions run as the caller; `src/domain/evidence.ts` mirrors links, questions and budgets. Why: one query per question, same code for the view and the future MCP tools.
- Part 5.2 link rules live in triggers (`chain_link_guard`, `chain_edge_guard`, `creation_decision_gate`): no decision without a signal, no unframed signal promotion, no creation without a Confirmed Decision ancestor, no exposure without authorisation, no "producing value" without a value measure. Phase 6 `compile_creation_prompt` must not bypass them.
- DESIGN DECISION: verbs `decided_from`, `built`, `renews` were added for chain links Part 4.2 lacks; "review period" is 90 days until a steward sets it; question "decision" = why it exists, "authority" = which decision authorised it.
- Phase 5 self-test rolls its fixtures back inside the function, leaving no test objects behind.

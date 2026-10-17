# Shared operations

- Human-surface operations use `human-surfaces.ts` schemas and `thread_human_operation` for atomic ledger-first mission, cell, burst and simulation-evidence writes. Why: the human and MCP paths must enforce the same bounds and provenance.
- Simulation Studio choices are private, expiring scenario renditions, not employee assessments or production evidence. Why: practice cannot earn authority, count as realised value or become surveillance.
- Capability probes are ledgered as simulated with `results: not_executed`; simulation tools remain pending until an execution harness exists. Why: a planned test is not test evidence.
- Assurance uses `AssuranceInput` and `thread_record_assurance`; passing requires current live evidence and subject/evidence permission equality. Why: simulations and permission aggregation cannot manufacture assurance.
- `human_surface_context` bounds breadth-first expansion with RLS before frontier admission and exposes truncation. Why: a small response must not hide unbounded traversal work.
- Evidence/session deep links reuse their existing surfaces with explicit IDs; metadata reads require current parent visibility. Why: alternate URLs and historical snapshots must not bypass access.
- Authority evaluations share `authority.server.ts` and `authority-input.ts`; missing policy context or failed risk writes stop evaluation. Why: human and MCP policy outcomes must agree and fail closed.
- Whole-build audit report is a bundled Markdown artifact at `/build-audit`, linked from Assurance; acceptance status distinguishes implementation, rollback fixtures and live proof. Why: green unit tests cannot conceal release blockers.
- Human and agent object lookup/search share `object-read.ts` schemas and `object-read.server.ts` caller-scoped cores returning the universal envelope; history requires a visible current parent. Why: alternate interfaces cannot omit provenance or bypass current access.
- Compilation and dispatch stop on failed guardrail, reuse, prompt or adapter-binding reads, and missing reuse rows. Why: unavailable safety context must not compile empty constraints or silently choose simulation.
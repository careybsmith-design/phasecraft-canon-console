# Shared operations

- Human-surface operations use `human-surfaces.ts` schemas and `thread_human_operation` for atomic ledger-first mission, cell, burst and simulation-evidence writes. Why: the human and MCP paths must enforce the same bounds and provenance.
- Simulation Studio choices are private, expiring scenario renditions, not employee assessments or production evidence. Why: practice cannot earn authority, count as realised value or become surveillance.
- Capability probes are ledgered as simulated with `results: not_executed`; simulation tools remain pending until an execution harness exists. Why: a planned test is not test evidence.
- Assurance uses `AssuranceInput` and `thread_record_assurance`; passing requires current live evidence and subject/evidence permission equality. Why: simulations and permission aggregation cannot manufacture assurance.
- `human_surface_context` bounds breadth-first expansion with RLS before frontier admission and exposes truncation. Why: a small response must not hide unbounded traversal work.
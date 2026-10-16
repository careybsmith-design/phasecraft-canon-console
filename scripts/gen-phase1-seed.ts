// Generates the registry + lifecycle seed SQL from src/domain so DB and code never drift.
// Run: bun scripts/gen-phase1-seed.ts > /tmp/seed.sql
import { LIFECYCLE_FAMILIES, transitions, initialState, type LifecycleFamily } from "../src/domain/lifecycle";
import { REGISTRY, bodySchema, discoveryDescriptor } from "../src/domain/registry";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const lines: string[] = [];
for (const fam of Object.keys(LIFECYCLE_FAMILIES) as LifecycleFamily[]) {
  lines.push(`insert into public.lifecycle_initial_states values (${q(fam)}, ${q(initialState(fam))});`);
  for (const [f, t] of transitions(fam)) {
    lines.push(`insert into public.lifecycle_transitions values (${q(fam)}, ${q(f)}, ${q(t)});`);
  }
}
for (const r of REGISTRY) {
  lines.push(
    `insert into public.object_type_registry values (${q(r.type)}, ${q(r.family)}, ${q(r.ref_prefix)}, ${q(r.lifecycle_family)}, ${q(JSON.stringify(bodySchema(r)))}::jsonb, ${q(JSON.stringify(discoveryDescriptor(r)))}::jsonb, '1.0.0');`,
  );
}
console.log(lines.join("\n"));

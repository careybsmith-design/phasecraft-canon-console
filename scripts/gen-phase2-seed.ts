// Generates the relationship_verbs seed SQL from src/domain/relationships.ts so DB and code never drift.
// Run: bun run ./scripts/gen-phase2-seed.ts
import { VERBS, expandedSignatures } from "../src/domain/relationships";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const rows = VERBS.map((d) => {
  const sigs = expandedSignatures(d);
  const from = [...new Set(sigs.flatMap((x) => x.from))];
  const to = [...new Set(sigs.flatMap((x) => x.to))];
  const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
  return `(${q(d.verb)},${arr(from)},${arr(to)},${d.directed},${q(JSON.stringify(sigs))}::jsonb,${q(d.impact)},${!!d.computed},${!!d.acyclic})`;
});
console.log(
  "insert into public.relationship_verbs (verb, from_types, to_types, directed, signatures, impact, computed, acyclic) values\n" +
    rows.join(",\n") +
    "\non conflict (verb) do update set from_types = excluded.from_types, to_types = excluded.to_types, directed = excluded.directed,\n" +
    "  signatures = excluded.signatures, impact = excluded.impact, computed = excluded.computed, acyclic = excluded.acyclic;",
);

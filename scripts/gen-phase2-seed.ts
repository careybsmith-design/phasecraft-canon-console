// Generates the compact relationship_verbs seed rows from src/domain/relationships.ts so DB and code never drift.
// Group names are expanded in SQL by public._expand_type_group (mirrors TYPE_GROUPS).
// Run: bun run ./scripts/gen-phase2-seed.ts
import { VERBS } from "../src/domain/relationships";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const rows = VERBS.map((d) => {
  const sig = d.signatures.map((s) => `${s.from.join("|")}>${s.to.join("|")}`).join(";");
  return `(${q(d.verb)},${q(sig)},${d.directed},${q(d.impact)},${!!d.computed},${!!d.acyclic})`;
});
console.log(rows.join(",\n"));

// Generates the registry + lifecycle seed SQL from src/domain so DB and code never drift.
// Run: bun run ./scripts/gen-phase1-seed.ts
import {
  LIFECYCLE_FAMILIES,
  transitions,
  initialState,
  type LifecycleFamily,
} from "../src/domain/lifecycle";
import { REGISTRY } from "../src/domain/registry";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const fams = Object.keys(LIFECYCLE_FAMILIES) as LifecycleFamily[];
const out: string[] = [];
out.push(
  "insert into public.lifecycle_initial_states values\n" +
    fams.map((f) => `(${q(f)},${q(initialState(f))})`).join(",") +
    ";",
);
out.push(
  "insert into public.lifecycle_transitions values\n" +
    fams.flatMap((f) => transitions(f).map(([a, b]) => `(${q(f)},${q(a)},${q(b)})`)).join(",") +
    ";",
);
out.push(
  "insert into public.object_type_registry (type, family, ref_prefix, lifecycle_family, body_schema, discovery_descriptor, schema_version)\n" +
    "select v.t, v.f, v.p, v.l,\n" +
    " jsonb_build_object('$schema','https://json-schema.org/draft/2020-12/schema','title',v.t,'type','object','additionalProperties',true,\n" +
    "   'properties',(select coalesce(jsonb_object_agg(trim(k),'{}'::jsonb),'{}') from unnest(string_to_array(v.k, ',')) k)),\n" +
    " jsonb_build_object('purpose',v.u,'family',v.f,'lifecycle_family',v.l,'ref_format',v.p||'-YYYY-NNNN',\n" +
    "   'key_fields',(select jsonb_agg(trim(k)) from unnest(string_to_array(v.k, ',')) k),\n" +
    "   'how_to_use','Read the envelope statement and machine_description; body carries '||v.t||' key fields from Part 4.3.'),\n" +
    " '1.0.0'\nfrom (values\n" +
    REGISTRY.map(
      (r) =>
        `(${q(r.type)},${q(r.family)},${q(r.ref_prefix)},${q(r.lifecycle_family)},${q(r.key_fields.join(","))},${q(r.purpose)})`,
    ).join(",\n") +
    ") as v(t,f,p,l,k,u);",
);
console.log(out.join("\n"));

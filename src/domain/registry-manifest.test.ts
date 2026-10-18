import { expect, it } from "vitest";
import manifest from "../../docs/audit/registry-manifest.json";
import { REGISTRY } from "./registry";
import { VERBS, TYPE_GROUPS, ORIGINS } from "./relationships";
import { LIFECYCLE_FAMILIES, transitions } from "./lifecycle";
import { DETECTOR_MANIFEST } from "./detection";

it("L-04 registry manifest matches every domain type", () => expect(REGISTRY).toEqual(manifest.types));
it("L-04 every verb and endpoint group matches the manifest", () => { expect(VERBS).toEqual(manifest.verbs); expect(TYPE_GROUPS).toEqual(manifest.type_groups); });
it("L-04 every legal transition matches the manifest", () => expect(Object.keys(LIFECYCLE_FAMILIES).flatMap(family => transitions(family as keyof typeof LIFECYCLE_FAMILIES).map(([from,to]) => ({family,from,to})))).toEqual(manifest.transitions));
it("L-05 canonical detector inventory matches the manifest", () => expect(DETECTOR_MANIFEST).toEqual(manifest.detectors));
it("L-20 all eight ordered relationship sources match the manifest", () => { expect(ORIGINS).toHaveLength(8); expect(ORIGINS).toEqual(manifest.origins); });
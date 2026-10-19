import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ENVELOPE_COLUMNS, type ObjectLookup, type GraphSearch } from "@/domain/object-read";
import { opErr } from "./context";

export type ObjectEnvelope = Omit<Database["public"]["Tables"]["objects"]["Row"], "search">;

export async function lookupObjectCore(
  sb: SupabaseClient<Database>,
  input: ObjectLookup,
): Promise<ObjectEnvelope> {
  let query = sb.from("objects").select(ENVELOPE_COLUMNS);
  query = input.id ? query.eq("id", input.id) : query.eq("human_ref", input.human_ref ?? "");
  const current = await query.maybeSingle();
  if (current.error) throw opErr(current.error.message);
  if (!current.data) throw opErr("NOT_FOUND: object not visible to the caller");
  const parent = current.data as unknown as ObjectEnvelope;
  if (input.version === undefined) return parent;
  const snapshot = await sb
    .from("object_versions")
    .select(ENVELOPE_COLUMNS)
    .eq("id", String(parent["id"]))
    .eq("version", input.version)
    .maybeSingle();
  if (snapshot.error) throw opErr(snapshot.error.message);
  if (!snapshot.data) throw opErr("NOT_FOUND: version not visible to the caller");
  return snapshot.data as unknown as ObjectEnvelope;
}

export async function searchGraphCore(
  sb: SupabaseClient<Database>,
  input: GraphSearch,
): Promise<ObjectEnvelope[]> {
  let query = sb
    .from("objects")
    .select(ENVELOPE_COLUMNS)
    .eq("is_tombstone", false)
    .textSearch("search", input.q, { type: "websearch" })
    .limit(input.limit);
  if (input.types?.length) query = query.in("type", input.types);
  if (input.states?.length) query = query.in("lifecycle_state", input.states);
  const result = await query;
  if (result.error) throw opErr(result.error.message);
  return (result.data ?? []) as unknown as ObjectEnvelope[];
}

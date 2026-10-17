import { z } from "zod/v4";

export const ObjectLookupInput = z.object({
  id: z.uuid().optional(),
  human_ref: z.string().regex(/^[A-Z]{2}-\d{4}-\d{4}$/).optional(),
  version: z.number().int().positive().optional(),
}).strict().refine((input) => Boolean(input.id) !== Boolean(input.human_ref), "Provide exactly one of id or human_ref");
export type ObjectLookup = z.infer<typeof ObjectLookupInput>;
export const GraphSearchInput = z.object({
  q: z.string().trim().min(1).max(200),
  types: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  states: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();
export type GraphSearch = z.infer<typeof GraphSearchInput>;
/** Universal envelope, excluding the internal full-text vector. */
export const ENVELOPE_COLUMNS = "id,human_ref,type,schema_version,title,statement,body,machine_description,version,supersedes,superseded_by,derived_from,created_at,created_by,updated_at,updated_by,lifecycle_state,effective_from,review_date,expiration_condition,expires_at,retired_at,retirement_reason,retirement_path,owner_id,co_creator_id,builder_id,steward_id,risk_tier,authority_level,confidence_bundle,consequence_class,permission,data_classification,permitted_uses,evidence_refs,citations,open_questions,content_hash,provenance_chain_id,is_tombstone";
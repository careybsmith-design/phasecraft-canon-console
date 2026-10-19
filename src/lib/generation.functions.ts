/**
 * Phase 8 server functions: renditions (Part 10). Writes go through thread_generate_rendition, which stamps,
 * scopes and refuses; this module only composes the body (live model for public/internal, in-boundary otherwise).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  RENDITION_KINDS,
  prohibitedInference,
  generationRoute,
  type RenditionKind,
} from "@/domain/generation";

const uuid = z.string().uuid();
function err(message: string): Error {
  const code = message.split(":")[0]?.trim() || "ERROR";
  return new Error(JSON.stringify({ code, explanation: message }));
}
const human = (id: string) => ({ kind: "human", id, authority_used: "observe" });
const KIND_KEYS = Object.keys(RENDITION_KINDS) as [RenditionKind, ...RenditionKind[]];
type Cls = "public" | "internal" | "confidential" | "restricted";
const RANK: Cls[] = ["public", "internal", "confidential", "restricted"];

export const listGeneration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [rends, objs] = await Promise.all([
      sb
        .from("renditions")
        .select(
          "id,human_ref,kind,state,generated_at,expires_at,stale_reason,deleted_at,generator,permission_context,generated_from,citations,marker",
        )
        .order("generated_at", { ascending: false })
        .limit(50),
      sb
        .from("objects")
        .select("id,human_ref,type,title,data_classification,version")
        .eq("is_tombstone", false)
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);
    if (rends.error) throw err(rends.error.message);
    if (objs.error) throw err(objs.error.message);
    return { renditions: rends.data ?? [], objects: objs.data ?? [] };
  });

const SECTION_SCHEMA = {
  name: "rendition",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["sections"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["heading", "text", "cites"],
          properties: {
            heading: { type: "string" },
            text: { type: "string" },
            cites: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
};

export const generateRendition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(KIND_KEYS),
        purpose: z.string().trim().min(1).max(200),
        request_text: z.string().trim().max(1000).default(""),
        source_ids: z.array(uuid).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateRenditionCore } = await import("@/server/ops/generation.server");
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    return generateRenditionCore(
      { sb: context.supabase, db, actor: human(context.userId) as never, userId: context.userId },
      data,
    );
  });

export const serveRendition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, purpose: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_serve_rendition", {
      p_actor: human(context.userId),
      p_id: data.id,
      p_purpose: data.purpose,
    });
    if (error) throw err(error.message);
    return r as unknown as {
      id: string;
      human_ref: string;
      kind: string;
      marker: string;
      body: {
        title?: string;
        sections?: Array<{ heading: string; text: string; cites: string[] }>;
        media?: { status: string; note: string };
        note?: string;
      };
      generated_from: Array<{ id: string; human_ref: string; version: number }>;
      generator: { model: string; route: string; adapter_mode: string };
      generated_at: string;
      permission_context: { purpose: string };
    };
  });

/** Records a PDF download of a rendition (same identity/purpose checks as opening it) in the ledger. */
export const recordRenditionDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, purpose: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: r, error } = await db.rpc("thread_record_rendition_download", {
      p_actor: human(context.userId),
      p_id: data.id,
      p_purpose: data.purpose,
    });
    if (error) throw err(error.message);
    const reader = String((context.claims as { email?: string }).email ?? context.userId);
    return { ...(r as object), reader } as unknown as {
      reader: string;
      classification: string;
      ledger_seq: number;
      downloaded_at: string;
      rendition: { expires_at: string };
    };
  });

export const generateMyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await db.rpc("thread_generate_morning_brief", {
      p_user: context.userId,
    });
    if (error) throw err(error.message);
    return data as {
      skipped?: boolean;
      reason?: string;
      human_ref?: string;
      rendition_id?: string;
    };
  });

export const getPhase8Evidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ledger")
      .select("seq,occurred_at,payload")
      .eq("action", "phase8.exit_evidence")
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const runPhase8Evidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await db.rpc("thread_record_phase8_evidence", {
      p_actor: human(context.userId),
      p: {} as never,
    });
    if (error) throw err(error.message);
    return data as unknown as {
      ledger_seq: number;
      selftest: { passed: boolean; checks: { name: string; pass: boolean; detail: string }[] };
    };
  });

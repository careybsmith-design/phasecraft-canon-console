import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  RecordSignalInput,
  ExtractSignalInput,
  CaptureStartInput,
  CaptureCompleteInput,
  CaptureAbandonInput,
  ConfirmDraftInput,
  PromoteSignalInput,
  LinkSignalInput,
} from "@/domain/signal-intake";

const actor = (id: string) => ({ kind: "human" as const, id, authority_used: "observe" });
async function core() {
  const mod = await import("@/server/ops/signal-intake.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ...mod, supabaseAdmin };
}

export const recordValueSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RecordSignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { recordSignalCore, supabaseAdmin } = await core();
    return recordSignalCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const extractSignalFromArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtractSignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { extractSignalCore, supabaseAdmin } = await core();
    return extractSignalCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const startSignalCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CaptureStartInput.parse(d))
  .handler(async ({ data, context }) => {
    const { startCaptureCore, supabaseAdmin } = await core();
    return startCaptureCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const abandonSignalCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CaptureAbandonInput.parse(d))
  .handler(async ({ data, context }) => {
    const { abandonCaptureCore, supabaseAdmin } = await core();
    return abandonCaptureCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const completeSignalCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CaptureCompleteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { completeCaptureCore, supabaseAdmin } = await core();
    return completeCaptureCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const confirmDraftSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmDraftInput.parse(d))
  .handler(async ({ data, context }) => {
    const { confirmDraftCore, supabaseAdmin } = await core();
    return confirmDraftCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const promoteSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromoteSignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { promoteSignalCore, supabaseAdmin } = await core();
    return promoteSignalCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

export const linkSignalToMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LinkSignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { linkSignalCore, supabaseAdmin } = await core();
    return linkSignalCore(
      {
        sb: context.supabase,
        db: supabaseAdmin,
        actor: actor(context.userId),
        userId: context.userId,
      },
      data,
    );
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEST_MODE, isTestEligible } from "@/lib/test-mode";

/**
 * TEST MODE ONLY. Grants the steward role to a disposable anonymous test
 * session so the signed-out build has full CRUD.
 *
 * Guards: runs only while TEST_MODE is true, and only for callers whose
 * verified token is flagged anonymous. Real accounts are unreachable from
 * here. The privileged client is imported inside the handler after those
 * checks, never at module scope.
 */
export const ensureTestStewardRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!TEST_MODE) return { granted: false as const };
    const claims = context.claims as Record<string, unknown> | null | undefined;
    if (!isTestEligible(claims)) return { granted: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "steward" });
    if (error) throw new Error(error.message);
    return { granted: true as const };
  });

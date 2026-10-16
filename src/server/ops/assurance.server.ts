import { AssuranceInput } from "@/domain/hardening";
import { opErr, type OpCtx } from "./context";
export async function recordAssuranceCore(ctx: OpCtx, input: unknown) {
  const parsed = AssuranceInput.parse(input);
  const { data, error } = await ctx.db.rpc("thread_record_assurance", { p_actor: ctx.actor, p: parsed as never });
  if (error) throw opErr(error.message);
  return data as unknown as { id: string; human_ref: string; result: string };
}
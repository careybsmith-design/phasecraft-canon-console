import { describe, expect, it, vi } from "vitest";
import { confirmObject } from "./framing.functions";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const fake = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fake }));
const caller = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const statementId = "33333333-3333-4333-8333-333333333333";
type Handler = (args: {
  data: { statement_id: string };
  context: { userId: string };
}) => Promise<unknown>;
function fixture(material: boolean, participant: boolean, owner = caller) {
  fake.rpc.mockReset();
  fake.from.mockImplementation((table: string) => {
    let selectedId = "";
    const chain = {
      select: () => chain,
      eq: (key: string, value: string) => {
        if (key === "id") selectedId = value;
        return chain;
      },
      maybeSingle: async () => ({
        error: null,
        data:
          table === "user_roles"
            ? null
            : selectedId === statementId
              ? {
                  id: statementId,
                  lifecycle_state: "draft",
                  body: { material, origin_session_ref: sessionId },
                }
              : {
                  id: sessionId,
                  type: "FramingSession",
                  owner_id: owner,
                  body: {
                    participants: participant
                      ? [
                          {
                            id: caller,
                            user_id: caller,
                            name: "Test participant",
                            decision_authority: false,
                          },
                        ]
                      : [],
                  },
                },
      }),
    };
    return chain;
  });
  return (confirmObject as unknown as Handler)({
    data: { statement_id: statementId },
    context: { userId: caller },
  });
}
describe("Existing framing confirmation refusals (8A.10)", () => {
  it("rejects a material draft from a participant without decision authority", async () => {
    await expect(fixture(true, true)).rejects.toThrow("AUTHORITY_REQUIRED_TO_CONFIRM");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("rejects a nonmaterial draft from a nonparticipant session owner with PARTICIPANT_REQUIRED", async () => {
    await expect(fixture(false, false)).rejects.toThrow("PARTICIPANT_REQUIRED");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("currently checks material authority before nonparticipant membership", async () => {
    await expect(fixture(true, false)).rejects.toThrow("AUTHORITY_REQUIRED_TO_CONFIRM");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
  it("rejects an unrelated nonparticipant at session access before confirmation", async () => {
    await expect(fixture(false, false, sessionId)).rejects.toThrow("AUTHORITY_INSUFFICIENT");
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

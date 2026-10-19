import { describe, expect, it, vi } from "vitest";
import { linkSessionMissionCore } from "./session-mission.server";
import type { OpCtx } from "./context";
const session_id = "11111111-1111-4111-8111-111111111111";
const mission_id = "22222222-2222-4222-8222-222222222222";
function fixture(data: unknown, error: {message: string} | null = null) {
  const rpc = vi.fn().mockResolvedValue({data:{recorded_as:"suggestion",edge:null,decision_id:null},error:null});
  const chain = {select:vi.fn(),in:vi.fn(),eq:vi.fn(),then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({data,error}).then(resolve)};
  for (const method of [chain.select,chain.in,chain.eq]) method.mockReturnValue(chain);
  const ctx = {sb:{from:()=>chain},db:{rpc},actor:{kind:"human",id:session_id,authority_used:"observe"},userId:session_id} as unknown as OpCtx;
  return {ctx,rpc};
}
describe("session mission shared operation",()=>{
  it("does not write when one object is hidden",async()=>{
    const {ctx,rpc}=fixture([{id:session_id,type:"FramingSession"}]);
    await expect(linkSessionMissionCore(ctx,{session_id,mission_id,rationale:"Scope intent"})).rejects.toThrow("NOT_FOUND");expect(rpc).not.toHaveBeenCalled();
  });
  it("does not write on failed permission reads",async()=>{
    const {ctx,rpc}=fixture(null,{message:"permission denied"});
    await expect(linkSessionMissionCore(ctx,{session_id,mission_id,rationale:"Scope intent"})).rejects.toThrow("permission denied");expect(rpc).not.toHaveBeenCalled();
  });
  it("passes verified actor rather than caller authority and preserves suggestion result",async()=>{
    const {ctx,rpc}=fixture([{id:session_id,type:"FramingSession"},{id:mission_id,type:"ValueMission"}]);
    expect(await linkSessionMissionCore(ctx,{session_id,mission_id,rationale:"Scope intent"})).toEqual({recorded_as:"suggestion",edge:null,decision_id:null});
    expect(rpc).toHaveBeenCalledWith("thread_link_session_to_mission",{p_actor:ctx.actor,p_session:session_id,p_mission:mission_id,p_rationale:"Scope intent",p_reverse:false});
  });
});
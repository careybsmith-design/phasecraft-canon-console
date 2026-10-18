/** L-03 recorded regression fixture only; these fictional participants are NOT the real pilot. */
export const FRAMING_PILOT_FIXTURE = {
  mode: "recorded_fixture", deployment_target: "regression_only", extractor_revisions: ["xv1", "xv2"],
  participants: [
    {id:"co-creator",name:"Fixture Co-Creator",role:"co_creator" as const,decision_authority:true},
    {id:"builder",name:"Fixture Builder",role:"builder" as const,decision_authority:false},
  ],
  prior_confirmed: "Coverage checks always use the eligibility feed",
  transcript: [
    {speaker:"co-creator",start:0,end:2000,text:"We need members to see coverage",classification:"suggestion",type:"NeedStatement"},
    {speaker:"builder",start:2000,end:4000,text:"We will skip the eligibility feed",classification:"suggestion",type:"BehaviorStatement"},
    {speaker:"co-creator",start:4000,end:6000,text:"Coverage checks never use the eligibility feed",classification:"confirmed_behavior",type:"BehaviorStatement"},
    {speaker:"builder",start:6000,end:8000,text:"Who owns the eligibility feed?",classification:"question",type:"OpenQuestion"},
    {speaker:"builder",start:8000,end:10000,text:"I assume the feed is current",classification:"assumption",type:"Assumption"},
    {speaker:"co-creator",start:10000,end:12000,text:"We have decided to use a bounded trial",classification:"decision",type:"ConfirmedDecision"},
    {speaker:"builder",start:12000,end:14000,text:"Members currently call the service desk",classification:"context",type:null},
  ],
  whiteboard: {text:"Coverage view depends on the eligibility feed",span:{kind:"region",start:[0.1,0.1],end:[0.8,0.6]}},
  confirmation: {id:"fixture-confirmation",object_ref:"fixture-behavior",version:1,actor:"co-creator"},
};
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSessionMissionOptions, linkSessionToMission, reverseSessionMission } from "@/lib/session-mission.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { errorText } from "@/components/human-surfaces";

export function SessionMissionPanel({ sessionId, missionId }: { sessionId?: string; missionId?: string }) {
  const read = useServerFn(getSessionMissionOptions);
  const link = useServerFn(linkSessionToMission);
  const reverse = useServerFn(reverseSessionMission);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["session-mission", sessionId, missionId], queryFn: () => read({ data: { session_id: sessionId, mission_id: missionId } }) });
  const [selected, setSelected] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const scope = q.data?.scope;
  async function act(undo = false, attachedSession?: string) {
    const sid = sessionId ?? attachedSession ?? selected;
    const mid = missionId ?? (undo ? scope?.id : selected);
    if (!sid || !mid) return;
    setBusy(true);
    try {
      const result = await (undo ? reverse : link)({ data: { session_id: sid, mission_id: mid, rationale } });
      toast[result.recorded_as === "suggestion" ? "warning" : "success"](result.recorded_as === "suggestion" ? "Recorded as a suggestion — mission authority is required." : undo ? "Association reversed; confirmations preserved." : "Mission association recorded as a decision.");
      await Promise.all([qc.invalidateQueries({ queryKey: ["session-mission"] }), qc.invalidateQueries({ queryKey: ["framing-session"] }), qc.invalidateQueries({ queryKey: ["human-surface"] }), qc.invalidateQueries({ queryKey: ["framing-view"] })]);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }
  const linkedSessions = q.data?.sessions.filter(s => s.mission?.id === missionId) ?? [];
  return <section className="space-y-3 border-y py-4" aria-label="Mission association">
    <h2 className="label-caps">{missionId ? "Framing sessions" : "Mission association"}</h2>
    {q.error && <p role="alert" className="text-sm text-destructive">{errorText(q.error)}</p>}
    {sessionId && (scope ? <p className="text-sm"><Link to="/missions/$missionId" params={{ missionId: scope.id }} className="underline"><span className="ident">{scope.human_ref}</span> · {scope.title}</Link> <span className="text-xs text-muted-foreground">· {scope.origin}</span></p> : <p className="text-sm text-muted-foreground">No mission associated</p>)}
    {missionId && linkedSessions.map(s => <div key={s.id} className="flex flex-wrap items-center gap-3 text-sm"><Link to="/framing/$sessionId" params={{ sessionId: s.id }} className="underline">{s.human_ref} · {s.title}</Link><span className="text-xs text-muted-foreground">{s.mission?.origin}</span>{s.mission?.origin !== "containment" && <Button size="sm" variant="outline" disabled={busy || rationale.trim().length < 3} onClick={() => act(true, s.id)}>Reverse association</Button>}</div>)}
    {(!scope || missionId) && <div className="space-y-1"><Label htmlFor={`scope-${sessionId ?? missionId}`}>{missionId ? "Attach an existing framing session" : "Associate with a mission"}</Label><select id={`scope-${sessionId ?? missionId}`} value={selected} onChange={e => setSelected(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm"><option value="">{missionId ? "Select unassociated session" : "Select active mission"}</option>{(missionId ? q.data?.sessions.filter(s => !s.mission) : q.data?.missions)?.map(o => <option key={o.id} value={o.id}>{o.human_ref} · {o.title}</option>)}</select></div>}
    <div className="space-y-1"><Label htmlFor={`scope-rationale-${sessionId ?? missionId}`}>Association / reversal rationale</Label><Textarea id={`scope-rationale-${sessionId ?? missionId}`} value={rationale} maxLength={2000} onChange={e => setRationale(e.target.value)} /></div>
    <div className="flex flex-wrap gap-2">{(!scope || missionId) && <Button variant="outline" disabled={busy || !selected || rationale.trim().length < 3} onClick={() => act()}>{missionId ? "Attach session" : "Associate with mission"}</Button>}{sessionId && scope && scope.origin !== "containment" && <Button variant="outline" disabled={busy || rationale.trim().length < 3} onClick={() => act(true)}>Reverse association</Button>}</div>
    {q.data?.frontier.filter(f => f.detector_key === "AuthorityMismatch").map(f => <p key={f.id} className="text-sm text-warn">{f.why}</p>)}
  </section>;
}

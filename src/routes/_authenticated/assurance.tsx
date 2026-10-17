import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Search, ShieldCheck } from "lucide-react";
import { assuranceQuery, acceptanceBlockers, recordAssurance, runHardeningChecks, assessorPack } from "@/lib/assurance.functions";
import { ASSURANCE_KINDS, SCALE_TARGET, type AssuranceInput } from "@/domain/hardening";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/components/human-surfaces";

const options = queryOptions({ queryKey: ["assurance"], queryFn: () => assuranceQuery() });
const blockerOptions = queryOptions({ queryKey: ["acceptance-blockers"], queryFn: () => acceptanceBlockers() });
export const Route = createFileRoute("/_authenticated/assurance")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(options), context.queryClient.ensureQueryData(blockerOptions)]),
  head: () => ({ meta: [{ title: "Assurance and recovery · THREAD" }, { name: "description", content: "Cited assurance evidence, ledger integrity, recovery conditions and independent verification in THREAD." }, { property: "og:title", content: "Assurance and recovery · THREAD" }, { property: "og:description", content: "Evidence-linked hardening with explicit live assurance gaps and recovery checks." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Assurance,
});

const EXIT_BLOCKERS: Array<{ item: string; needs: string }> = [
  { item: "AW-5 action-ratio threshold", needs: "Steward decision (proposed: ≥60% action sessions, ≤25% read-only; changeable later via canon change)" },
  { item: "Orphan objects", needs: "Human reconciliation — connect, retire, or keep each with a recorded reason" },
  { item: "Live builds on all five platforms", needs: "Platform URL, token and webhook secret per builder" },
  { item: "Real backup restore", needs: "Timed platform restore with post-restore ledger verification" },
  { item: "Independent penetration test and WCAG 2.2 AA audit", needs: "External assessors" },
  { item: "Two-person acceptance tests", needs: "A second authorized person" },
  { item: "Human relabeling of extraction and PHI/PAN test corpora", needs: "Human reviewers" },
  { item: "Target-scale performance proof", needs: "Tenfold load rehearsal" },
  { item: "Retention and legal-hold policy; SSO/org identity", needs: "Policy decision and identity provider" },
];

function Assurance() {
  const { data } = useSuspenseQuery(options); const { data: blockers } = useSuspenseQuery(blockerOptions); const qc = useQueryClient();
  const run = useServerFn(runHardeningChecks); const record = useServerFn(recordAssurance); const query = useServerFn(assessorPack);
  const [subject, setSubject] = useState(""); const [kind, setKind] = useState<(typeof ASSURANCE_KINDS)[number]>("penetration");
  const [result, setResult] = useState<AssuranceInput["result"]>("pending_live_adapter");
  const [evidence, setEvidence] = useState<string[]>([]); const [rationale, setRationale] = useState(""); const [busy, setBusy] = useState(false);
  const [internal, setInternal] = useState<Awaited<ReturnType<typeof runHardeningChecks>> | null>(null);
  const [pack, setPack] = useState<Awaited<ReturnType<typeof assessorPack>> | null>(null);
  const selectClass = "h-10 w-full rounded-md border bg-background px-2 text-sm";
  async function action(work: () => Promise<void>) { setBusy(true); try { await work(); } catch (error) { toast.error(errorText(error)); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-5xl space-y-6 p-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck />Assurance</h1><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/build-audit">Whole-build audit</Link></Button>{data.can_record && <Button variant="outline" disabled={busy} onClick={() => action(async () => setInternal(await run()))}><ClipboardCheck />Check and record integrity</Button>}</div></header>
    <section aria-label="Assurance limitation" className="border-y py-4 text-sm"><p>THREAD can prove that a decision was recorded, evidence was attached, authority was granted and an outcome was observed. It cannot prove evidence is true, a control is effective, or a decision was wise.</p></section>
    {internal && <section aria-live="polite" className="space-y-2 border-b pb-4 text-sm"><h2 className="font-semibold">{internal.passed_internal_checks ? "Internal checks passed" : "Internal findings require attention"}</h2><p>Exposed privileged writes: {internal.exposed_privileged_writes} · Tables without row permissions: {internal.tables_without_rls} · Missing expiration: {internal.live_objects_without_expiration}</p><p>Ledger: {internal.ledger.ok ? "verified" : "integrity failure"} across {internal.ledger.entries_checked} entries. Receipt #{internal.ledger_seq}.</p><p className="text-warn">Snapshot replay: {internal.snapshot_replay.ok ? "matched" : "mismatch"}. Simulated; not a platform-backup restore.</p><Link className="underline" to="/canon">Inspect the ledger evidence</Link></section>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Assessor evidence</h2><Label htmlFor="assessor-subject">Subject</Label><select id="assessor-subject" className={selectClass} value={subject} onChange={(e) => { setSubject(e.target.value); setPack(null); }}><option value="">Select permitted canon object</option>{data.sources.map((s) => <option key={s.id} value={s.id}>{s.human_ref} · {s.title}</option>)}</select><Button variant="outline" disabled={busy || !subject} onClick={() => action(async () => setPack(await query({ data: { subject_id: subject } })))}><Search />Query evidence</Button>
    {pack && <div aria-live="polite" className="space-y-2 border-y py-3 text-sm"><h3>{pack.subject.human_ref} · v{pack.subject.version}</h3><p>{pack.marker} · Query time {pack.elapsed_ms} ms</p><p>{pack.limitation}</p><details><summary className="cursor-pointer">Cited answers, chain and assurance evidence</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(pack, null, 2)}</pre></details><Link to="/evidence" className="underline">Inspect evidence chains</Link></div>}</section>
    {data.can_record && <section className="space-y-3 border-t pt-4"><h2 className="text-lg font-semibold">Record assurance evidence</h2><form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void action(async () => { const r = await record({ data: { subject_id: subject, kind, result, evidence_refs: evidence, rationale } }); toast.success(`${r.human_ref} recorded`); await qc.invalidateQueries({ queryKey: ["assurance"] }); setRationale(""); }); }}>
    <div><Label htmlFor="assurance-kind">Condition</Label><select id="assurance-kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{ASSURANCE_KINDS.map((k) => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}</select></div><div><Label htmlFor="assurance-result">Evidence result</Label><select id="assurance-result" className={selectClass} value={result} onChange={(e) => setResult(e.target.value as typeof result)}><option value="pending_live_adapter">Pending live evidence</option><option value="failed">Failed</option><option value="passed">Passed with live evidence</option></select></div>
    <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">Cited evidence</legend><div className="max-h-48 overflow-auto border-y py-2">{data.sources.map((s) => <label key={s.id} className="flex items-start gap-2 py-1 text-sm"><input type="checkbox" checked={evidence.includes(s.id)} disabled={!evidence.includes(s.id) && evidence.length >= 20} onChange={(e) => setEvidence(e.target.checked ? [...evidence, s.id] : evidence.filter((id) => id !== s.id))} /><span>{s.human_ref} · {s.title}</span></label>)}</div></fieldset><div className="sm:col-span-2"><Label htmlFor="assurance-rationale">Evidence interpretation</Label><Textarea id="assurance-rationale" required maxLength={2000} value={rationale} onChange={(e) => setRationale(e.target.value)} /></div><Button disabled={busy || !subject || !evidence.length} className="justify-self-start">Record cited condition</Button></form></section>}
    <section className="space-y-2 border-t pt-4"><h2 className="text-lg font-semibold">Recorded conditions</h2>{data.checks.length === 0 && <p className="text-sm text-muted-foreground">No assurance conditions recorded.</p>}<ul className="divide-y">{data.checks.map((c) => <li key={c.id} className="space-y-2 py-3 text-sm"><Link to="/canon" search={{ id: c.id }} className="underline">{c.human_ref} · {c.title}</Link><p>{c.body.result} · Review {c.review_date}</p><p>{c.body.rationale}</p><div className="flex flex-wrap gap-2">{c.body.evidence.map((id) => <Link key={id} to="/canon" search={{ id }} className="ident underline">{data.sources.find((s) => s.id === id)?.human_ref ?? "Cited evidence"}</Link>)}</div></li>)}</ul></section>
    <section className="space-y-2 border-t pt-4 text-sm"><h2 className="text-lg font-semibold">Live exit evidence still required</h2><p>Independent penetration test; timed backup restore and post-restore ledger verification; WCAG 2.2 AA audit; compliance-officer walkthrough; independent verification; tenfold load rehearsal.</p><p>Recovery targets: no more than 15 minutes of data loss and 4 hours to recover. These are targets, not measured results.</p><details><summary className="cursor-pointer">Tenfold scale targets</summary><pre className="mt-2 overflow-auto text-xs">{JSON.stringify(SCALE_TARGET, null, 2)}</pre></details></section>
  </main>;
}
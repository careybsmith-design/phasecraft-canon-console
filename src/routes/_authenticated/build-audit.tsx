import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import report from "../../../docs/THREAD-build-audit.md?raw";
import corrections from "../../../docs/THREAD-correction-status.md?raw";
import correctionTests from "../../../docs/audit/correction-suite.txt?raw";
import currentAudit from "../../../docs/THREAD-correction-reaudit.md?raw";
import currentTests from "../../../docs/audit/correction-reaudit-suite.txt?raw";
import currentEvidence from "../../../docs/audit/correction-reaudit-evidence.json?raw";
import currentOperations from "../../../docs/audit/correction-reaudit-operations.json?raw";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/build-audit")({
  head: () => ({ meta: [
    { title: "Whole-build audit and proof · THREAD" },
    { name: "description", content: "Section-by-section THREAD audit, anti-wiki acceptance, verified fixes and unresolved release blockers." },
    { property: "og:title", content: "Whole-build audit and proof · THREAD" },
    { property: "og:description", content: "Honest compliance findings and evidence for Sections 1–19 of the THREAD specification." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AuditPage,
});
function AuditPage() {
  function download(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="mx-auto max-w-6xl space-y-5 p-4">
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={() => download(currentAudit, "THREAD-current-audit.md", "text/markdown;charset=utf-8")}><Download />Download audit</Button>
      <Button variant="outline" onClick={() => download(currentTests, "THREAD-current-test-results.txt", "text/plain;charset=utf-8")}><Download />Test results</Button>
      <Button variant="outline" onClick={() => download(currentEvidence, "THREAD-current-audit-evidence.json", "application/json;charset=utf-8")}><Download />Evidence bundle</Button>
      <Button variant="outline" onClick={() => download(currentOperations, "THREAD-current-operations.json", "application/json;charset=utf-8")}><Download />Operation inventory</Button>
      <Button variant="outline" onClick={() => download(corrections, "THREAD-correction-status.md", "text/markdown;charset=utf-8")}><Download />Correction proof</Button>
      <Button variant="outline" onClick={() => download(correctionTests, "THREAD-correction-tests.txt", "text/plain;charset=utf-8")}><Download />Correction tests</Button>
    </div>
    <article className="space-y-4 break-words text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        h1: ({ children }) => <h1 className="border-b pb-3 text-2xl font-semibold">{children}</h1>,
        h2: ({ children }) => <h2 className="border-t pt-5 text-xl font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="pt-4 text-lg font-semibold">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
        table: ({ children }) => <div className="max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
        th: ({ children }) => <th className="min-w-36 border-b bg-muted p-3 align-top font-semibold">{children}</th>,
        td: ({ children }) => <td className="min-w-36 border-b p-3 align-top">{children}</td>,
        code: ({ children }) => <code className="break-all text-xs text-muted-foreground">{children}</code>,
      }}>{currentAudit + "\n\n---\n\n# Historical correction round\n\n" + corrections + "\n\n---\n\n# Historical whole-build audit (superseded where corrected above)\n\n" + report}</ReactMarkdown>
    </article>
  </main>;
}
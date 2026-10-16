import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import report from "../../../docs/THREAD-build-audit.md?raw";
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
  function download() {
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "THREAD-build-audit.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="mx-auto max-w-6xl space-y-5 p-4">
    <div className="flex justify-end"><Button variant="outline" onClick={download}><Download />Download audit</Button></div>
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
      }}>{report}</ReactMarkdown>
    </article>
  </main>;
}
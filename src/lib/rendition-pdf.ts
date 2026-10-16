/** Browser-only: builds the offline PDF of a rendition with marker, context, sources and an offline warning. */
type Section = { heading: string; text?: string; cites?: string[]; items?: Array<{ text: string; ref: string }> };
export type PdfInput = {
  human_ref: string; marker: string; title: string; note?: string; sections: Section[];
  generated_from: Array<{ id: string; human_ref: string; version: number }>;
  generator: { model: string; route: string; adapter_mode: string };
  generated_at: string; expires_at: string; purpose: string; reader: string;
  classification: string; ledger_seq: number; downloaded_at: string;
};

export async function buildRenditionPdf(r: PdfInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48;
  let y = M;
  const footer = () => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(110);
    doc.text(`${r.marker} | ${r.classification.toUpperCase()} | ${r.human_ref} | Offline copy, may be out of date | ledger #${r.ledger_seq}`, M, H - 24);
    doc.setTextColor(0);
  };
  const write = (text: string, size = 10, bold = false, gap = 4) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, W - 2 * M) as string[]) {
      if (y > H - 56) { footer(); doc.addPage(); y = M; doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); }
      doc.text(line, M, y); y += size * 1.3;
    }
    y += gap;
  };
  const ref = (id: string) => r.generated_from.find((g) => g.id === id)?.human_ref ?? id;
  const d = (s: string) => new Date(s).toUTCString();

  write(r.marker.toUpperCase(), 9, true, 2);
  write(`Classification: ${r.classification.toUpperCase()}`, 9, true, 8);
  write(`${r.title} (${r.human_ref})`, 16, true, 8);
  write(`Made for: ${r.reader}  |  Purpose: "${r.purpose}"`, 9);
  write(`Generated ${d(r.generated_at)} by ${r.generator.model} via ${r.generator.route} (${r.generator.adapter_mode}). Expires in the app ${d(r.expires_at)}.`, 9);
  write(`Downloaded ${d(r.downloaded_at)}, recorded as ledger #${r.ledger_seq}.`, 9);
  write("OFFLINE COPY: this file does not update or expire. If a source record changes, this copy becomes out of date without warning. Check THREAD for the current version.", 9, true, 12);
  if (r.note) write(r.note, 10);
  for (const s of r.sections) {
    write(s.heading, 12, true, 2);
    if (s.items) {
      if (!s.items.length) write("Nothing here.", 10);
      for (const it of s.items) write(`- ${it.text} [${it.ref}]`, 10, false, 2);
      y += 6;
    } else write(`${s.text ?? ""} [${(s.cites ?? []).map(ref).join(", ")}]`, 10, false, 8);
  }
  write("Sources (exact versions used)", 12, true, 2);
  for (const g of r.generated_from) write(`${g.human_ref} v${g.version}`, 10, false, 1);
  footer();
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  downloadBlob(blob, filename);
}

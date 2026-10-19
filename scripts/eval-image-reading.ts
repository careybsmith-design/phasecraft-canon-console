/**
 * Image-reading route evaluation (N03 / ModelRoute clearance). Sends each golden image through the
 * exact production instructions and schema, then classifies the read text with the deterministic gate.
 * Usage: bun scripts/eval-image-reading.ts <dir-with-cases.json>
 */
import { readFileSync } from "node:fs";
import { VLM_INSTRUCTIONS, VLM_SCHEMA } from "@/server/framing/extractor";
import { LIVE_MODEL } from "@/server/adapters/model-gateway/live";
import { inspectImageText } from "@/domain/inspection";

const dir = process.argv[2]!;
const cases = JSON.parse(readFileSync(`${dir}/cases.json`, "utf8")) as Array<{
  name: string;
  expected: "A" | "B" | "C";
}>;
const key = process.env["LOVABLE_API_KEY"]!;
const rows: unknown[] = [];
let correct = 0;
let cTotal = 0;
let cCaught = 0;
for (const c of cases) {
  const b64 = readFileSync(`${dir}/img/${c.name}.png`).toString("base64");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: LIVE_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "drawing", strict: true, schema: VLM_SCHEMA } },
      input: [
        { role: "developer", content: [{ type: "input_text", text: VLM_INSTRUCTIONS }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe the drawing." },
            { type: "input_image", image_url: `data:image/png;base64,${b64}` },
          ],
        },
      ],
    }),
  });
  const raw = await res.text();
  let text = "";
  for (const l of raw.split("\n"))
    if (l.startsWith("data:")) {
      try {
        const ev = JSON.parse(l.slice(5));
        if (ev.type === "response.output_text.delta") text += ev.delta;
      } catch {
        /* skip */
      }
    }
  const o = JSON.parse(text) as { visible_text: string; description: string; statements: { text: string }[] };
  const read = [o.visible_text, o.description, ...o.statements.map((s) => s.text)].join("\n");
  const r = inspectImageText(c.name, read);
  const got = r.tier;
  if (got === c.expected) correct++;
  if (c.expected === "C") {
    cTotal++;
    if (r.action === "block") cCaught++;
  }
  rows.push({ case: c.name, status: res.status, expected: c.expected, got, action: r.action, visible_text: o.visible_text.replace(/\d(?=\d{4})/g, "•") });
}
console.log(JSON.stringify({ model: LIVE_MODEL, n: cases.length, accuracy: correct / cases.length, tier_c_recall: cTotal ? cCaught / cTotal : null, rows }, null, 1));

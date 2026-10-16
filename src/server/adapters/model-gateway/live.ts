/**
 * Live ModelGateway: Lovable AI Gateway, OpenAI Responses API, streamed, strict json_schema output.
 * Server-only. Restricted content never reaches this route (checked here as well as by the caller).
 */
import {
  ModelGatewayError,
  type CompleteRequest,
  type CompleteResult,
  type ModelGateway,
} from "./contract";

export const LIVE_MODEL = "openai/gpt-6-astra";
const BASE = "https://ai.gateway.lovable.dev/v1";

export function liveModelGateway(apiKey: string): ModelGateway {
  return {
    async complete(req: CompleteRequest): Promise<CompleteResult> {
      if (req.data_classification === "restricted" || req.data_classification === "confidential") {
        throw new ModelGatewayError(
          451,
          "TIER_ROUTE_REFUSED: confidential or restricted content routes in-boundary only",
        );
      }
      const t0 = Date.now();
      const input = req.messages.map((m) => ({
        role: m.role === "system" ? "developer" : "user",
        content:
          typeof m.content === "string" ? [{ type: "input_text", text: m.content }] : m.content,
      }));
      const res = await fetch(`${BASE}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: LIVE_MODEL,
          input,
          stream: true,
          store: false,
          reasoning: { effort: "low" },
          ...(req.schema
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: req.schema.name,
                    strict: true,
                    schema: req.schema.schema,
                  },
                },
              }
            : {}),
        }),
      });
      if (!res.ok || !res.body) {
        let msg = `${res.status}`;
        try {
          const j = await res.json();
          msg = j?.error?.message ?? j?.message ?? msg;
        } catch {
          /* keep status */
        }
        throw new ModelGatewayError(res.status, `MODEL_UNAVAILABLE: ${msg}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text = "";
      let model = LIVE_MODEL;
      let tokens: CompleteResult["tokens"] = null;
      let refused: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = frame
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!data || data === "[DONE]") continue;
          let ev: {
            type?: string;
            delta?: string;
            response?: { model?: string; usage?: { input_tokens: number; output_tokens: number } };
            error?: { message?: string };
            refusal?: string;
          };
          try {
            ev = JSON.parse(data);
          } catch {
            continue;
          }
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
          else if (ev.type === "response.refusal.delta")
            refused = (refused ?? "") + (ev.delta ?? "");
          else if (ev.type === "response.completed" && ev.response) {
            model = ev.response.model ?? model;
            if (ev.response.usage)
              tokens = {
                input: ev.response.usage.input_tokens,
                output: ev.response.usage.output_tokens,
              };
          } else if (ev.type === "error" || ev.type === "response.failed") {
            throw new ModelGatewayError(
              502,
              `MODEL_UNAVAILABLE: ${ev.error?.message ?? "the model run failed"}`,
            );
          }
        }
      }
      if (refused) throw new ModelGatewayError(422, `MODEL_REFUSED: ${refused}`);
      if (!text) throw new ModelGatewayError(502, "MODEL_EMPTY: the model returned no output");
      let output: unknown = text;
      if (req.schema) {
        try {
          output = JSON.parse(text);
        } catch {
          throw new ModelGatewayError(502, "MODEL_SCHEMA: output was not valid JSON");
        }
      }
      return {
        output,
        model: LIVE_MODEL,
        model_version: model,
        route_id: req.route,
        tokens,
        cost: null,
        latency_ms: Date.now() - t0,
        adapter_mode: "live",
      };
    },
  };
}

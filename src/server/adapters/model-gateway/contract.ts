/** ModelGateway contract (Section 3.4). Provider-agnostic; data classification gates the route. */
export type ContentPart = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };
export interface CompleteRequest {
  route: string;
  messages: Array<{ role: "system" | "user"; content: string | ContentPart[] }>;
  schema?: { name: string; schema: Record<string, unknown> };
  purpose: string;
  data_classification: "public" | "internal" | "confidential" | "restricted";
}
export interface CompleteResult {
  output: unknown;
  model: string;
  model_version: string;
  route_id: string;
  tokens: { input: number; output: number } | null;
  cost: number | null;
  latency_ms: number;
  adapter_mode: "live" | "simulated";
}
export interface ModelGateway { complete(req: CompleteRequest): Promise<CompleteResult> }

export class ModelGatewayError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

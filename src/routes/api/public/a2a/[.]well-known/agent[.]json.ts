/**
 * Public THREAD service discovery only. Registered agents and mandates remain private
 * until an explicit publication/consent contract exists.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/a2a/.well-known/agent.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { TOOLS, TOOL_CONTRACT_VERSION } = await import("@/domain/mcp-tools");
        const origin = new URL(request.url).origin;
        const card = {
          protocolVersion: "0.3.0", name: "THREAD", description: "MASA Global's canonical Enterprise Operating Graph and evidence graph. One canon, many agents.",
          url: `${origin}/api/public/mcp`, preferredTransport: "MCP", version: TOOL_CONTRACT_VERSION,
          securitySchemes: { agentToken: { type: "http", scheme: "bearer", description: "Agent token issued when a person registers the agent in THREAD" } }, security: [{ agentToken: [] }],
          defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"],
          skills: TOOLS.filter((t) => t.status === "live").map((t) => ({ id: t.name, name: t.name, description: t.purpose, tags: [t.kernel, t.side_effects] })),
          registered_agents: [],
          canon_rule: "Agents reference canon types by name; no agent may define its own (conflicting definitions are refused at registration).",
        };
        return Response.json(card, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=60" } });
      },
    },
  },
});

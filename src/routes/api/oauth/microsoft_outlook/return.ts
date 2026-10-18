// OAuth return endpoint for the Microsoft Outlook App User Connector.
// Plain HTML, no authentication: the popup has no app session in the editor
// preview. It posts the one-time code to the opener, which exchanges it
// through an authenticated server function.
import { createFileRoute } from "@tanstack/react-router";
import { oauthReturnHtml } from "@/lib/oauth-return-html";

export const Route = createFileRoute("/api/oauth/microsoft_outlook/return")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(oauthReturnHtml(new URL(request.url)), {
          headers: { "Content-Type": "text/html" },
        }),
    },
  },
});

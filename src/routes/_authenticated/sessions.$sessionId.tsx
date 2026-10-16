import { createFileRoute } from "@tanstack/react-router";
import { SessionSurface } from "./framing.$sessionId";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId")({
  head: () => ({ meta: [
    { title: "Co-creation session · THREAD" },
    { name: "description", content: "Consented live capture, extracted statements, evidence and human confirmation for a co-creation session." },
    { property: "og:title", content: "Co-creation session · THREAD" },
    { property: "og:description", content: "Correct captured understanding and inspect its provenance while the session is live." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  return <SessionSurface sessionId={sessionId} />;
}
import { createFileRoute } from "@tanstack/react-router";
import { FramingHome } from "./framing.index";
export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Semantic Capture · THREAD" },
      {
        name: "description",
        content:
          "Consent-aware co-creation with speaker authority, live extraction, contradictions and human confirmation.",
      },
      { property: "og:title", content: "Semantic Capture · THREAD" },
      {
        property: "og:description",
        content: "Open a consented framing session and preserve what the enterprise learned.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Capture,
});
function Capture() {
  return (
    <>
      <h1 className="px-4 pt-4 text-lg">Semantic Capture</h1>
      <FramingHome />
    </>
  );
}

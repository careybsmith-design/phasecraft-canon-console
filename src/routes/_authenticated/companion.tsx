import { createFileRoute } from "@tanstack/react-router";
import { CompanionPanel } from "@/components/human-surfaces";
export const Route = createFileRoute("/_authenticated/companion")({
  head: () => ({
    meta: [
      { title: "Value Companion · THREAD" },
      {
        name: "description",
        content: "Challenge a business condition with cited evidence and take a bounded action.",
      },
      { property: "og:title", content: "Value Companion · THREAD" },
      {
        property: "og:description",
        content: "Evidence-grounded, outcome-first guidance for the current condition.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanionPage,
});
function CompanionPage() {
  return (
    <main className="mx-auto max-w-3xl p-4">
      <CompanionPanel />
    </main>
  );
}

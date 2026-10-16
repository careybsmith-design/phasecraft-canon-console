import { createFileRoute } from "@tanstack/react-router";
import { EvidencePage } from "./evidence";

export const Route = createFileRoute("/_authenticated/evidence_/$capabilityId")({
  head: () => ({ meta: [
    { title: "Capability evidence chain · THREAD" },
    { name: "description", content: "Inspect this capability's decisions, tests, authority, production outcomes and value evidence." },
    { property: "og:title", content: "Capability evidence chain · THREAD" },
    { property: "og:description", content: "Permission-scoped evidence and cited answers for one capability." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CapabilityEvidence,
});

function CapabilityEvidence() {
  const { capabilityId } = Route.useParams();
  const navigate = Route.useNavigate();
  return <EvidencePage capabilityId={capabilityId} onSelect={(id) => { void navigate({ to: "/evidence/$capabilityId", params: { capabilityId: id } }); }} />;
}
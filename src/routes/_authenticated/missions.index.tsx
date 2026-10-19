import { createFileRoute, Link } from "@tanstack/react-router";
import { MissionForm, useSurface, errorText } from "@/components/human-surfaces";
export const Route = createFileRoute("/_authenticated/missions/")({
  head: () => ({
    meta: [
      { title: "Value Missions · THREAD" },
      {
        name: "description",
        content:
          "Bounded missions to change measurable business conditions, with evidence and named decision authority.",
      },
      { property: "og:title", content: "Value Missions · THREAD" },
      {
        property: "og:description",
        content: "Inspect current conditions and establish an evidence-bounded mission.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MissionsPage,
});
function MissionsPage() {
  const q = useSurface();
  const objects = q.data?.objects ?? [];
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-lg">Value Missions</h1>
      <MissionForm objects={objects} />
      {q.error && (
        <p role="alert" className="text-destructive">
          {errorText(q.error)}
        </p>
      )}
      <ul className="divide-y">
        {objects
          .filter((o) => o.type === "ValueMission")
          .map((o) => (
            <li key={o.id} className="space-y-2 py-3">
              <Link className="underline" to="/missions/$missionId" params={{ missionId: o.id }}>
                <span className="ident">{o.human_ref}</span> · {o.title}
              </Link>
              <p className="text-sm">{o.statement}</p>
              <p className="text-xs text-muted-foreground">
                {o.lifecycle_state} · {o.authority_level} · review {o.review_date}
              </p>
            </li>
          ))}
      </ul>
    </main>
  );
}

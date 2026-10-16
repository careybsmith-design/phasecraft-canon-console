import { createFileRoute, redirect } from "@tanstack/react-router";

// Home opens the permission-scoped Feed; its named route preserves the existing root URL.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/feed" });
  },
  head: () => ({
    meta: [
      { title: "THREAD · Live enterprise value" },
      { name: "description", content: "Reuse and remix capabilities from permission-scoped signals and enterprise value evidence." },
      { property: "og:title", content: "THREAD · Live enterprise value" },
      { property: "og:description", content: "Act on signals, current mission decisions and reusable capabilities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

import { createFileRoute, redirect } from "@tanstack/react-router";

// Phase 1: home opens the canon console. The Live Value Feed replaces this in Phase 11 (Section 12).
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/canon" });
  },
  head: () => ({
    meta: [
      { title: "THREAD · MASA Global operating graph" },
      { name: "description", content: "THREAD: the canonical, versioned operating and evidence graph for MASA Global." },
      { property: "og:title", content: "THREAD · MASA Global operating graph" },
      { property: "og:description", content: "The canonical, versioned operating and evidence graph for MASA Global." },
    ],
  }),
});

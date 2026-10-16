// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// sigma's base class extends EventEmitter from the bare "events" import. The toolchain rewrites
// that to "node:events", an empty stub in the browser, so sigma throws "Super expression must
// either be null or a function". In the browser build, pin it to the `events` npm package.
const eventsShim = fileURLToPath(new URL("./node_modules/events/events.js", import.meta.url));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "thread-browser-events",
        enforce: "pre",
        resolveId(id) {
          if (this.environment?.name !== "client") return null;
          return id === "events" || id === "node:events" ? eventsShim : null;
        },
      },
    ],
    // The graph renderer is imported lazily; pre-bundle it so the dev server never re-optimizes mid-session.
    optimizeDeps: { include: ["sigma", "graphology"] },
  },
});

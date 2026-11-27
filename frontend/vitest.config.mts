import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // a simulated browser (DOM, cookies, window) inside Node
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Run in Boston's time zone, like the app's users, so date tests meet daylight saving time (Nov 1, 2026).
    env: { TZ: "America/New_York" },
  },
  // Vite compiles JSX itself; this tells it to use React 17+'s automatic runtime (no `import React` needed).
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});

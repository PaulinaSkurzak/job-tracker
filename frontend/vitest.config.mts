import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // a simulated browser (DOM, cookies, window) inside Node
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  // Vite compiles JSX itself; this tells it to use React 17+'s automatic runtime (no `import React` needed).
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});

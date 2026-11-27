import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a self-contained server for the Docker image (see frontend/Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

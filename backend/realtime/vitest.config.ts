import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          BACKEND_API_BASE_URL: "https://backend.test",
          REALTIME_ACTIVITY_SECRET: "test-activity-secret",
          OPENAI_API_KEY: "test-openai-key",
        },
      },
    }),
  ],
  test: {
    include: ["src/**/*.worker.test.ts"],
  },
});

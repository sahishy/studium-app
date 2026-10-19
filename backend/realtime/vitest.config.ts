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
          GAME_ADMISSION_SECRET: "test-only-admission-signing-secret",
          REALTIME_V4_PERCENT: "100",
          REALTIME_METRICS_PERCENT: "0",
        },
      },
    }),
  ],
  test: {
    include: ["src/**/*.worker.test.ts"],
  },
});

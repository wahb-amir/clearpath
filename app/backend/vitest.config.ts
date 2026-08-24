import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    globals: true,
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEY: "dummy_secret_key_that_is_long_enough",
      SUPABASE_PUBLISHABLE_KEY: "dummy_publishable_key",
      INTERNAL_API_KEY: "dummy_internal_api_key_16_chars",
      GROQ_API_KEY: "gsk_dummy_api_key",
      TAVILY_API_KEY: "tvly_dummy_api_key",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/workers/**/*.ts"],
      exclude: [
        "src/workers/__tests__/**",
        "src/workers/run.ts",
        "src/workers/runClearpathAnalysisWorker.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});

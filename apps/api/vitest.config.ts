import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 20000,
    // Integration tests share one real Postgres instance; running test files
    // concurrently would race on shared demo-data state (e.g. exact seeded totals).
    fileParallelism: false,
  },
});

import { defineConfig } from "vitest/config";
process.env.INTEGRATION_TEST_MODE = "true";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      // Count untested source files against coverage so packages without any
      // tests (e.g. packages/app-store) don't look artificially fine.
      all: true,
      include: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/.turbo/**",
        "**/*.d.ts",
        "**/*.{test,spec}.{ts,tsx,js,jsx}",
        "**/*.integration-test.ts",
        "**/*.timezone.test.ts",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/test/**",
        "**/tests/**",
        "**/*.generated.*",
        "**/playwright/**",
        "**/*.stories.{ts,tsx}",
        "packages/embeds/**",
        "packages/prisma/zod/**",
      ],
    },
    passWithNoTests: true,
    testTimeout: 500000,
  },
});

setEnvVariablesThatAreUsedBeforeSetup();

function setEnvVariablesThatAreUsedBeforeSetup() {
  // We can't set it during tests because it is used as soon as _metadata.ts is imported which happens before tests start running
  process.env.DAILY_API_KEY = "MOCK_DAILY_API_KEY";
  // With same env variable, we can test both non org and org booking scenarios
  process.env.NEXT_PUBLIC_WEBAPP_URL = "http://app.cal.local:3000";
  process.env.CALCOM_SERVICE_ACCOUNT_ENCRYPTION_KEY = "UNIT_TEST_ENCRYPTION_KEY";
}

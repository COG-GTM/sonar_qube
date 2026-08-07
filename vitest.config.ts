import { coverageConfigDefaults, defineConfig } from "vitest/config";
process.env.INTEGRATION_TEST_MODE = "true";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      all: true,
      // Without an explicit include, only files imported by a test are reported,
      // so a package with no tests at all (e.g. packages/app-store) is absent
      // from the report rather than showing 0%.
      include: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/.next/**",
        "**/dist/**",
        "**/.turbo/**",
        "**/*.integration-test.ts",
        "**/*.timezone.test.ts",
        "**/__mocks__/**",
        "**/test/**",
        "**/tests/**",
        "**/*.generated.*",
        "**/playwright/**",
        "**/*.stories.{ts,tsx}",
        "packages/embeds/**",
        "packages/prisma/zod/**",
        // Has its own test runner (see .github/workflows/unit-tests.yml), so the
        // root vitest suite never executes it and would report it as 0%.
        "apps/api/v2/**",
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

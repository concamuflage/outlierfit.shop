import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Only this feature/step set is allowed on production; the staging suite and its DB-writing fixtures are not imported.
const testDir = defineBddConfig({
  features: "features/production/*.feature",
  steps: ["production/*.ts"],
  outputDir: ".features-gen-production",
});

export default defineConfig({
  testDir,
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  grep: /(?=.*@smoke)(?=.*@production-safe)/,
  outputDir: "test-results-production",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-production", open: "never" }],
    ["junit", { outputFile: "test-results-production/junit.xml" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "https://outlierfit.shop",
    headless: true,
    channel: "chrome",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [{ name: "production-smoke" }],
});

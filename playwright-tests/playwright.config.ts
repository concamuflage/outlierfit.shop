import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";
import { assertSafeTarget } from "./support/testEnv";

const baseURL = assertSafeTarget(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000");
// Discover both suites, e.g. features/ui/cart.feature and features/api/cart-api.feature.
const testDir = defineBddConfig({ features: ["features/ui/**/*.feature", "features/api/**/*.feature"], steps: ["steps/*.ts", "support/bdd.ts"] });
const stagingRegression = process.env.PLAYWRIGHT_STAGING_REGRESSION === "1";

export default defineConfig({
  testDir,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // Never automatically repeat a payment or a delivered-email scenario.
  retries: 0,
  workers: stagingRegression ? 3 : 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
    channel: "chrome",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  // Staging UI scenarios run concurrently; shared email/payment services keep a separate single-worker lane.
  projects: stagingRegression ? [
    {
      name: "chromium-ui",
      testMatch: "**/features/ui/**/*.feature.spec.js",
      grep: /@regression/,
      grepInvert: /@mail|@payment|@dev-only/,
      fullyParallel: true,
      workers: 3,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-external",
      testMatch: "**/features/ui/**/*.feature.spec.js",
      grep: /(?=.*@regression)(?=.*(?:@mail|@payment))/,
      grepInvert: /@dev-only/,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "api",
      testMatch: "**/features/api/**/*.feature.spec.js",
      grep: /@regression/,
      grepInvert: /@dev-only/,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "support",
      testDir: "./tests",
      testMatch: ["support-contract.spec.ts", "modal-login-cart.spec.ts"],
      grep: /@regression/,
      grepInvert: /@dev-only/,
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
  ] : [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Small native tests cover the framework guards and the existing desktop/mobile router-cache regression.
      name: "support",
      testDir: "./tests",
      testMatch: ["support-contract.spec.ts", "modal-login-cart.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

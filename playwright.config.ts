import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a local Supabase stack (`npx supabase start`,
// which also loads the demo seed) and the app on port 3000.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    // Stands in for the Claude API; start the app with ANTHROPIC_BASE_URL=http://127.0.0.1:4010.
    { command: "node e2e/mock-anthropic.mjs", url: "http://127.0.0.1:4010/health", reuseExistingServer: true },
    ...(process.env.E2E_BASE_URL
      ? []
      : [{ command: "npm run dev", url: "http://localhost:3000/logga-in", reuseExistingServer: true }]),
  ],
});

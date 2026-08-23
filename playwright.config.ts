import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E (#48): guest landing → login page.
 * Run: npx playwright test
 * Requires `npm run build && npm start` or `PLAYWRIGHT_BASE_URL`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

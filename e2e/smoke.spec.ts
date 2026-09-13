/**
 * Smoke suite kept thin — critical-path covers guest landing/login.
 * Importing the critical-path file would double-run tests; this file stays as a
 * minimal CI-friendly sanity check that mirrors the landing assertion.
 */
import { expect, test } from "@playwright/test";

test.describe("guest smoke", () => {
  test("landing shows brand and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Calorie Vision").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Начать бесплатно|Войти/i }).first()).toBeVisible();
  });
});

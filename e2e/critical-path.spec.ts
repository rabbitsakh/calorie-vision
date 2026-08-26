import { expect, test } from "@playwright/test";

/**
 * Critical-path guest E2E: public pages and auth-gated screens without real login.
 */
test.describe("guest critical path", () => {
  test("landing loads brand and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Calorie Vision").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Начать бесплатно|Войти/i }).first()).toBeVisible();
  });

  test("login page opens", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.getByRole("heading", { name: /Вход/i })).toBeVisible();
    await expect(page.getByText("Calorie Vision").first()).toBeVisible();
  });

  test("unknown route shows not-found", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-e2e/");
    await expect(page.getByRole("heading", { name: /не найдена/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /На главную/i })).toBeVisible();
  });

  test("profile requires auth when guest", async ({ page }) => {
    await page.goto("/profile");
    // AuthGate (no middleware redirect): guest sees sign-in prompt on the page.
    await expect(page.getByText(/Войдите, чтобы начать/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("section.card").getByRole("link", { name: /^Войти$/i })).toBeVisible();
  });

  test("ration requires auth when guest", async ({ page }) => {
    await page.goto("/ration");
    await expect(page.getByText(/Войдите, чтобы начать/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("section.card").getByRole("link", { name: /^Войти$/i })).toBeVisible();
  });
});

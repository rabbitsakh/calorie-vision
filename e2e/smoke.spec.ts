import { expect, test } from "@playwright/test";

test.describe("guest smoke", () => {
  test("landing shows brand and CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Calorie Vision").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Начать бесплатно|Войти/i }).first()).toBeVisible();
  });

  test("login page opens", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});

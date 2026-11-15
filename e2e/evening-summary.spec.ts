import path from "node:path";
import { expect, test } from "@playwright/test";

const shotsDir = process.env.EVENING_SUMMARY_SHOTS ?? path.join("test-results", "evening-summary");

for (const width of [360, 390]) {
  test(`карточка итога дня, тёмная тема, ${width}px`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("cv_metrika_consent", "declined");
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dev/evening-summary-preview/");

    const card = page.getByRole("region", { name: "Итог дня" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Калории в норме, воды ещё 0,7 л")).toBeVisible();
    await expect(card.getByText("До нормы белка не хватает 30 г")).toBeVisible();
    await expect(card.getByRole("button", { name: /Творог 5%/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /Творог 0%/ })).toBeVisible();
    await expect(card.getByText("Пирожное")).toHaveCount(0);

    const cardOverflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(cardOverflow).toBeLessThanOrEqual(1);
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(1);

    await card.screenshot({
      path: path.join(shotsDir, `evening-summary-${width}-dark.png`),
    });
  });
}

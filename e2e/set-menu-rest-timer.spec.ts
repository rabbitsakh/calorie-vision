import { expect, test } from "@playwright/test";

const WIDTHS = [360, 390] as const;

test.describe("меню подхода и таймер отдыха", () => {
  for (const width of WIDTHS) {
    test(`«Удалить подход» не перекрыт таймером на ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => {
        localStorage.setItem("cv_metrika_consent", "declined");
      });
      await page.goto("/dev/gym-active-preview");
      await expect(page.getByRole("status", { name: /Отдых/ })).toBeVisible();
      await page.getByRole("button", { name: "Действия подхода 2" }).click();

      const del = page.getByRole("button", { name: "Удалить подход" });
      await expect(del).toBeVisible();
      await expect
        .poll(async () =>
          del.evaluate((el) => getComputedStyle(el.closest(".gym-set-sheet")!).opacity),
        )
        .toBe("1");

      const hit = await del.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return top === el || el.contains(top);
      });
      expect(hit, "центр «Удалить подход» должен попадать в кнопку, а не в таймер").toBe(true);

      const timer = page.locator(".gym-rest-bar");
      await expect(timer).toHaveCount(1);
      await expect(timer).toHaveAttribute("aria-label", /Отдых/);
    });
  }
});

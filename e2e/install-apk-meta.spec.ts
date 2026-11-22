import { expect, test, type Locator, type Page } from "@playwright/test";

const WITH_VERSION = {
  versionName: "3.6.15",
  versionCode: 30615,
  builtAt: "2026-11-13T00:00:00.000Z",
  sizeBytes: 19_398_656,
  sha256: "ab".repeat(32),
};

const LABEL = "Версия 3.6.15 · 13 ноября 2026 · 18,5 МБ";

async function dismissCookies(page: Page) {
  const decline = page.getByRole("button", { name: "Нет" });
  if (await decline.isVisible().catch(() => false)) {
    await decline.click();
  }
}

/** Подпись <a class="btn"> должна быть по вертикали в середине 56px, а не у верхнего края. */
async function expectLabelCentered(locator: Locator) {
  await expect(locator).toBeVisible();
  const delta = await locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    return Math.abs(box.top + box.height / 2 - (text.top + text.height / 2));
  });
  expect(delta).toBeLessThan(4);
}

test.describe("прямая загрузка APK на /install", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("без манифеста ссылка есть, версии нет", async ({ page }) => {
    await page.route("**/downloads/apk.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/install");
    const link = page.getByRole("link", { name: "Скачать APK" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /calorie-vision\.apk$/);
    await expect(page.getByTestId("apk-release-meta")).toHaveCount(0);
    await expect(page.getByText("3.6.15")).toHaveCount(0);
    await dismissCookies(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const shot = process.env.APK_META_SCREENSHOT_DIR;
    if (shot) {
      await page.screenshot({ path: `${shot}/install-apk-without-manifest-390.png`, fullPage: true });
    }
  });

  test("с манифестом рядом со ссылкой версия, дата и размер", async ({ page }) => {
    await page.route("**/downloads/apk.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(WITH_VERSION),
      }),
    );
    await page.goto("/install");
    await expect(page.getByRole("link", { name: "Скачать APK" })).toBeVisible();
    await expect(page.getByTestId("apk-release-meta")).toHaveText(LABEL);
    await dismissCookies(page);
    for (const name of ["Скачать APK", "Открыть рацион", "На главную"]) {
      await expectLabelCentered(page.getByRole("link", { name }));
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const shot = process.env.APK_META_SCREENSHOT_DIR;
    if (shot) {
      await page.screenshot({ path: `${shot}/install-apk-with-version-390.png`, fullPage: true });
    }
  });
});

test.describe("кнопки-ссылки на лендинге", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("подписи главных кнопок по вертикали в центре", async ({ page }) => {
    await page.goto("/");
    await dismissCookies(page);
    for (const name of ["Начать бесплатно", "Попробовать без входа"]) {
      await expectLabelCentered(page.getByRole("link", { name }).first());
    }
    const shot = process.env.APK_META_SCREENSHOT_DIR;
    if (shot) {
      await page.locator(".landing-cta").first().screenshot({ path: `${shot}/landing-cta-after-390.png` });
    }
  });
});

import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [360, 390] as const;

const FAVORITES = [
  {
    id: "fav-syr",
    name: "Сырники льняные с клюквой и сметаной домашний рецепт",
    calories: 658,
    protein: 24,
    fat: 22,
    carbs: 70,
    fiber: 6,
    sugar: 12,
    portionGrams: 210,
    useCount: 5,
  },
  {
    id: "fav-breast",
    name: "Куриная грудка запечённая с овощами и киноа",
    calories: 420,
    protein: 48,
    fat: 12,
    carbs: 22,
    fiber: 4,
    sugar: 3,
    portionGrams: 320,
    useCount: 3,
  },
];

async function assertNoHorizontalOverflow(page: Page) {
  const issues = await page.evaluate(() => {
    const found: string[] = [];
    const pageWidth = window.innerWidth;
    if (document.documentElement.scrollWidth > pageWidth + 1) {
      found.push(`scrollWidth ${document.documentElement.scrollWidth} > ${pageWidth}`);
    }

    const scrollsItself = (el: Element) => {
      const overflow = getComputedStyle(el).overflowX;
      return overflow === "auto" || overflow === "scroll";
    };

    for (const el of document.querySelectorAll("body *")) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest("[aria-hidden='true']")) continue;
      if (el.classList.contains("sr-only")) continue;
      const direct = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      );
      if (!direct) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      // Сама прокручиваемая лента может быть шире содержимого. Её текст — нет.
      if (scrollsItself(el)) continue;
      const card = el.closest("[data-layout-card]");
      if (!card) continue;
      const box = card.getBoundingClientRect();
      if (rect.left < box.left - 1 || rect.right > box.right + 1) {
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
        found.push(`«${text}» вылезает из карточки`);
      }
    }
    return found.slice(0, 8);
  });
  expect(issues, issues.join("\n")).toEqual([]);
}

test.describe("узкие экраны, тёмная тема", () => {
  for (const width of WIDTHS) {
    test(`Сегодня ${width}px не разъезжается`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.addInitScript((favorites) => {
        localStorage.setItem(
          "cv-quick-add-cache-v1",
          JSON.stringify({ yesterdayDate: "2026-11-14", yesterdayCount: 3 }),
        );
        localStorage.setItem("cv-favorites-cache-v1", JSON.stringify(favorites));
      }, FAVORITES);
      await page.route("**/api/rewards**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            chest: {
              state: "filling",
              filled: 1,
              per: 3,
              nextIn: 2,
              readyCount: 0,
              label: "Сундук: спокойные дни с длинным названием награды",
              detail: "Ещё два дня с едой и водой — и можно открыть наклейку",
              metaLabel: "Серия не сбрасывает сундук",
              cta: "none",
              queue: [],
            },
          }),
        }),
      );
      await page.route("**/api/water**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ totalMl: 250, target: 2000 }),
        }),
      );
      await page.goto("/dev/narrow-layout?theme=dark");
      await expect(page.getByRole("heading", { name: "Сегодня" })).toBeVisible();
      await expect(page.getByLabel("Быстрый лог")).toBeVisible();
      await expect(page.getByLabel("Прогресс сундука")).toBeVisible();
      await expect(page.getByLabel("Вода")).toBeVisible();
      await expect(page.getByText(FAVORITES[0]!.name).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });

    test(`Зал ${width}px не разъезжается`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/dev/gym-home-preview?theme=dark&names=long");
      await expect(page.getByRole("tablist")).toBeVisible();
      await expect(page.getByText(/Жим лёжа узким хватом/).first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});

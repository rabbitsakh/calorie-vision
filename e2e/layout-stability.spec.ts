import { expect, test, type Locator, type Page } from "@playwright/test";

const WIDTHS = [360, 393, 412] as const;

type Pin = {
  scrollY: number;
  scrollTop: number;
  editorTop: number;
  stepperTop: number;
  headH: number;
  minusLeft: number;
  plusRight: number;
};

async function pinOf(step: Locator): Promise<Pin> {
  return step.evaluate((el) => {
    const buttons = [...el.querySelectorAll(":scope > button")];
    const minus = buttons[0]?.getBoundingClientRect();
    const plus = buttons[buttons.length - 1]?.getBoundingClientRect();
    const main = document.querySelector(".cv-app-main");
    const editor = document.querySelector(".gym-set-editor");
    const head = document.querySelector("[data-gym-header]");
    return {
      scrollY: window.scrollY,
      scrollTop: main instanceof HTMLElement ? main.scrollTop : 0,
      editorTop: editor?.getBoundingClientRect().top ?? 0,
      stepperTop: el.getBoundingClientRect().top,
      headH: head?.getBoundingClientRect().height ?? 0,
      minusLeft: minus?.left ?? 0,
      plusRight: plus ? plus.right : 0,
    };
  });
}

function expectStill(before: Pin, after: Pin) {
  expect(Math.abs(after.scrollY - before.scrollY), "window.scrollY").toBeLessThanOrEqual(1);
  expect(Math.abs(after.scrollTop - before.scrollTop), "прокрутка ленты").toBeLessThanOrEqual(1);
  expect(Math.abs(after.editorTop - before.editorTop), "верх редактора").toBeLessThanOrEqual(1);
  expect(Math.abs(after.stepperTop - before.stepperTop), "верх степпера").toBeLessThanOrEqual(1);
  expect(Math.abs(after.headH - before.headH), "высота шапки").toBeLessThanOrEqual(1);
  expect(Math.abs(after.minusLeft - before.minusLeft), "кнопка −").toBeLessThanOrEqual(1);
  expect(Math.abs(after.plusRight - before.plusRight), "кнопка +").toBeLessThanOrEqual(1);
}

async function openWorkout(page: Page, width: number) {
  await page.setViewportSize({ width, height: 780 });
  await page.addInitScript(() => {
    localStorage.setItem("cv_metrika_consent", "declined");
  });
  await page.goto("/dev/gym-active-preview?rest=1");
  await expect(page.locator(".gym-set-editor")).toBeVisible();
  await page.evaluate(() => {
    const main = document.querySelector(".cv-app-main");
    const editor = document.querySelector(".gym-set-editor");
    if (!(main instanceof HTMLElement) || !editor) return;
    const top = editor.getBoundingClientRect().top - main.getBoundingClientRect().top;
    main.scrollTop += top - 24;
  });
}

function stepper(page: Page, label: "Килограммы" | "Повторения") {
  return page.locator(".gym-stepper").filter({
    has: page.getByRole("button", { name: `Больше, ${label}` }),
  });
}

async function readValue(step: Locator) {
  return (await step.locator(".gym-stepper__edit, .gym-stepper__input").innerText()).trim();
}

async function stepTo(page: Page, label: "Килограммы" | "Повторения", target: string) {
  const step = stepper(page, label);
  const more = page.getByRole("button", { name: `Больше, ${label}` });
  const less = page.getByRole("button", { name: `Меньше, ${label}` });
  for (let i = 0; i < 80; i += 1) {
    const current = await readValue(step);
    if (current === target) return step;
    const delta = Number(current) - Number(target);
    if (!Number.isFinite(delta) || delta === 0) break;
    await (delta < 0 ? more : less).click();
  }
  throw new Error(`не дошли до ${target}, сейчас «${await readValue(step)}»`);
}

async function assertValueFits(step: Locator, expected: string) {
  const fit = await step.locator(".gym-stepper__edit, .gym-stepper__input").evaluate((el) => {
    const text = (el.textContent ?? "").trim();
    const track = el.closest(".gym-stepper__val");
    const trackBox = track?.getBoundingClientRect().width ?? 0;
    const valueBox = el.getBoundingClientRect().width;
    return {
      text,
      overflow: el.scrollWidth - el.clientWidth,
      widthGap: Math.abs(trackBox - valueBox),
      border: getComputedStyle(el).borderTopWidth,
    };
  });
  expect(fit.text).toBe(expected);
  expect(fit.overflow, `«${expected}» шире поля`).toBeLessThanOrEqual(0);
  expect(fit.widthGap, "поле должно занимать всю ширину между − и +").toBeLessThanOrEqual(1);
  expect(fit.border).toBe("0px");
}

test.describe("стабильный редактор подхода", () => {
  test("± не двигает прокрутку, редактор и шапку", async ({ page }) => {
    await openWorkout(page, 393);
    const kg = stepper(page, "Килограммы");
    const reps = stepper(page, "Повторения");
    await expect(kg.locator(".gym-stepper__edit")).toHaveText("82.5");

    let before = await pinOf(kg);
    await page.getByRole("button", { name: "Больше, Килограммы" }).click();
    await expect(kg.locator(".gym-stepper__edit")).toHaveText("85");
    expectStill(before, await pinOf(kg));

    before = await pinOf(kg);
    await page.getByRole("button", { name: "Меньше, Килограммы" }).click();
    await expect(kg.locator(".gym-stepper__edit")).toHaveText("82.5");
    expectStill(before, await pinOf(kg));

    before = await pinOf(reps);
    await page.getByRole("button", { name: "Больше, Повторения" }).click();
    await expect(reps.locator(".gym-stepper__edit")).toHaveText("7");
    expectStill(before, await pinOf(reps));

    before = await pinOf(reps);
    await page.getByRole("button", { name: "Меньше, Повторения" }).click();
    await expect(reps.locator(".gym-stepper__edit")).toHaveText("6");
    expectStill(before, await pinOf(reps));

    // Подсказка «↑ к прошлому» гаснет на границе прошлого веса (80) и не меняет высоту.
    const label = page.locator(".gym-set-label").first();
    await expect(label).toContainText("↑ к прошлому");
    const labelH = await label.evaluate((el) => el.getBoundingClientRect().height);
    before = await pinOf(kg);
    await page.getByRole("button", { name: "Меньше, Килограммы" }).click();
    await expect(kg.locator(".gym-stepper__edit")).toHaveText("80");
    await expect(label).not.toContainText("↑");
    expectStill(before, await pinOf(kg));
    const labelHAfter = await label.evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(labelHAfter - labelH)).toBeLessThanOrEqual(1);
  });

  test("в поле веса нет второго прямоугольника и обрезки", async ({ page }) => {
    await openWorkout(page, 393);
    const kg = stepper(page, "Килограммы");
    for (const target of ["47.5", "100", "152.5"] as const) {
      const step = await stepTo(page, "Килограммы", target);
      await assertValueFits(step, target);
      const before = await pinOf(kg);
      await page.getByRole("button", { name: "Больше, Килограммы" }).click();
      expectStill(before, await pinOf(kg));
      await page.getByRole("button", { name: "Меньше, Килограммы" }).click();
      await assertValueFits(step, target);
    }
    await stepTo(page, "Повторения", "8");
    const reps = stepper(page, "Повторения");
    const before = await pinOf(reps);
    await page.getByRole("button", { name: "Больше, Повторения" }).click();
    await page.getByRole("button", { name: "Больше, Повторения" }).click();
    await expect(reps.locator(".gym-stepper__edit")).toHaveText("10");
    expectStill(before, await pinOf(reps));
    await assertValueFits(reps, "10");
  });
});

test.describe("нет горизонтального скролла на узком экране", () => {
  const screens = [
    ["/dev/today-hero-preview/?theme=dark", "Сегодня"],
    ["/dev/narrow-layout?theme=dark", "Сегодня, лента"],
    ["/dev/gym-home-preview?theme=dark&names=long", "Зал"],
    ["/dev/gym-active-preview?theme=dark&rest=1", "Зал, тренировка"],
    ["/dev/chrome-preview", "Оболочка"],
    ["/stats", "Прогресс"],
    ["/profile", "Я"],
  ] as const;

  for (const width of WIDTHS) {
    for (const [url, name] of screens) {
      test(`${name} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.addInitScript(() => {
          localStorage.setItem("cv_metrika_consent", "declined");
        });
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => {
          const issues: string[] = [];
          const width = window.innerWidth;
          if (document.documentElement.scrollWidth > width + 1) {
            issues.push(`страница ${document.documentElement.scrollWidth} > ${width}`);
          }
          const main = document.querySelector(".cv-app-main");
          if (main instanceof HTMLElement && main.scrollWidth > main.clientWidth + 1) {
            issues.push(`лента ${main.scrollWidth} > ${main.clientWidth}`);
          }
          return issues;
        });
        expect(overflow, overflow.join("\n")).toEqual([]);
      });
    }
  }

  test("меню подхода на 393px не раздвигает экран", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 780 });
    await page.addInitScript(() => {
      localStorage.setItem("cv_metrika_consent", "declined");
    });
    await page.goto("/dev/gym-active-preview?rest=1");
    await page.getByRole("button", { name: "Действия подхода 2" }).click();
    const del = page.getByRole("button", { name: "Удалить подход" });
    await expect(del).toBeVisible();
    const hit = await del.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return top === el || el.contains(top);
    });
    expect(hit).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

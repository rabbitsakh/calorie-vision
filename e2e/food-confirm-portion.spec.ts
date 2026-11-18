import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cv_metrika_consent", "declined");
  });
});

test("скумбрия на 100 г: ввод 1→15→150 не копит КБЖУ", async ({ page }) => {
  await page.goto("/e2e/food-confirm");
  await expect(page.getByText("Порция не указана")).toBeVisible();
  await expect(page.getByTestId("kbju-basis")).toHaveText("КБЖУ на 100 г");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("200");
  await expect(page.getByLabel("Б", { exact: true })).toHaveValue("20");
  await expect(page.getByLabel("Ж", { exact: true })).toHaveValue("15");
  await expect(page.getByLabel("У", { exact: true })).toHaveValue("0");

  const portion = page.getByLabel("Порция", { exact: true });
  await portion.click();
  await portion.pressSequentially("150");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("300");
  await expect(page.getByLabel("Б", { exact: true })).toHaveValue("30");
  await expect(page.getByLabel("Ж", { exact: true })).toHaveValue("22.5");
  await expect(page.getByLabel("У", { exact: true })).toHaveValue("0");
  await expect(page.getByTestId("kbju-basis")).toHaveText("КБЖУ на порцию");
  await expect(page.getByText("Порция не указана")).toHaveCount(0);

  await portion.fill("");
  await expect(page.getByTestId("kbju-basis")).toHaveText("КБЖУ на 100 г");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("200");
  await portion.click();
  await portion.pressSequentially("150");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("300");

  const kcal = page.getByLabel("ккал", { exact: true });
  await kcal.fill("400");
  await portion.fill("");
  await portion.click();
  await portion.pressSequentially("300");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("800");
  await portion.fill("");
  await portion.click();
  await portion.pressSequentially("150");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("400");
  await expect(page.getByRole("button", { name: "Записать в дневник" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ ещё блюдо" })).toBeVisible();
});

test("без плотности посимвольный ввод не раздувает ккал", async ({ page }) => {
  await page.goto("/e2e/food-confirm?mode=total");
  await expect(page.getByText("Порция не указана")).toBeVisible();
  await expect(page.getByTestId("kbju-basis")).toHaveCount(0);
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("200");

  const portion = page.getByLabel("Порция", { exact: true });
  await portion.click();
  await portion.pressSequentially("150");
  await expect(page.getByLabel("ккал", { exact: true })).toHaveValue("200");
  await expect(page.getByLabel("Б", { exact: true })).toHaveValue("20");
  await expect(page.getByLabel("Ж", { exact: true })).toHaveValue("15");
});

/**
 * Live RuStore screenshots from the real logged-in app (1080×1920).
 *
 * 1) Opens a headed Chromium window at phone size
 * 2) You sign in once (Yandex / Google / email)
 * 3) Captures product screens into rustore/screenshots/submit/
 *
 *   npm run rustore:screenshots:live
 *   SHOTS_LIVE_BASE=https://calorievision.ru
 *
 * Auth is saved to rustore/screenshots/.auth.json (gitignored).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = (process.env.SHOTS_LIVE_BASE ?? "https://calorievision.ru").replace(/\/$/, "");
const OUT = path.resolve(ROOT, process.env.SHOTS_OUT ?? "rustore/screenshots/submit");
const ARCHIVE = path.resolve(ROOT, "rustore/screenshots/archive");
const AUTH = path.resolve(ROOT, "rustore/screenshots/.auth.json");

const W = 1080;
const H = 1920;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function dismissChrome(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("cv_metrika_consent", "declined");
    } catch {
      // ignore
    }
  });
  for (const name of ["Ок", "Нет", "Понятно", "Закрыть"]) {
    const btn = page.getByRole("button", { name, exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 1500 }).catch(() => {});
    }
  }
}

async function waitForSession(page) {
  console.log("\n→ Войдите в открывшемся окне (Яндекс / Google / email).");
  console.log("  Жду перехода в приложение…\n");
  await page.goto(`${BASE}/login/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissChrome(page);

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (/\/(ration|today|workouts|stats|profile|me)(\/|$|\?)/i.test(url)) {
      return;
    }
    // Already have a session cookie → open ration
    const session = await page.evaluate(async () => {
      try {
        const r = await fetch("/api/auth/session", { credentials: "include" });
        const j = await r.json();
        return Boolean(j?.user);
      } catch {
        return false;
      }
    });
    if (session) {
      await page.goto(`${BASE}/ration/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      if (/\/(ration|today)(\/|$|\?)/i.test(page.url())) return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("Таймаут входа (10 мин). Запустите снова и войдите быстрее.");
}

async function shot(page, file) {
  const target = path.join(OUT, file);
  await page.waitForTimeout(500);
  await dismissChrome(page);
  // Hide cookie / version strip if still visible
  await page.evaluate(() => {
    document.querySelectorAll(".cookie-consent, .cookie-consent--strip").forEach((el) => {
      el.style.display = "none";
    });
  });
  await page.screenshot({
    path: target,
    type: "png",
    clip: { x: 0, y: 0, width: W, height: H },
    animations: "disabled",
  });
  console.log(`✓ ${file}`);
}

async function safeClick(page, locator, label) {
  const el = typeof locator === "string" ? page.locator(locator).first() : locator;
  if (await el.isVisible({ timeout: 4000 }).catch(() => false)) {
    await el.click({ timeout: 4000 });
    return true;
  }
  console.warn(`  skip: ${label}`);
  return false;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(ARCHIVE, { recursive: true });

  const archiveTag = `pre-live-${stamp()}`;
  for (const name of fs.readdirSync(OUT)) {
    if (!name.endsWith(".png")) continue;
    const prev = path.join(OUT, name);
    const dest = path.join(ARCHIVE, `${archiveTag}-${name}`);
    if (!fs.existsSync(dest)) fs.copyFileSync(prev, dest);
  }

  const contextOptions = {
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: "ru-RU",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    isMobile: true,
    hasTouch: true,
  };
  if (fs.existsSync(AUTH)) {
    contextOptions.storageState = AUTH;
  }

  const browser = await chromium.launch({
    headless: false,
    args: [`--window-size=${Math.min(W, 420)},${Math.min(H, 900)}`],
  });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // If saved auth works, skip login wait
  let needLogin = true;
  if (fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/ration/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1200);
    if (/\/(ration|today)(\/|$|\?)/i.test(page.url()) && !/login/i.test(page.url())) {
      needLogin = false;
      console.log("Сессия из .auth.json — ок");
    }
  }
  if (needLogin) {
    await waitForSession(page);
  }
  await context.storageState({ path: AUTH });
  console.log(`Auth → ${AUTH}`);

  // 01 — Сегодня
  await page.goto(`${BASE}/ration/`, { waitUntil: "networkidle", timeout: 90_000 }).catch(() =>
    page.goto(`${BASE}/ration/`, { waitUntil: "domcontentloaded" }),
  );
  await page.waitForTimeout(1500);
  await shot(page, "01-ration.png");

  // 02 — Добавить (picker)
  const plus =
    page.getByRole("button", { name: /Ещё|Добавить|\+/i }).first();
  if (!(await safeClick(page, plus, "+ / Ещё"))) {
    await safeClick(page, page.locator(".bottom-composer-btn").filter({ hasText: "" }).nth(2), "composer +");
  }
  // Prefer mode picker title
  await page.getByText("Добавить", { exact: true }).first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, "02-add-modes.png");
  await page.keyboard.press("Escape").catch(() => {});
  await safeClick(page, page.getByRole("button", { name: /Закрыть/i }).first(), "close picker");

  // 03 — Прогресс
  await page.goto(`${BASE}/stats/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, "03-stats.png");

  // 04 — Зал сегодня
  await page.goto(`${BASE}/workouts/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, "04-gym.png");

  // 05 — Новая / старт
  const newBtn = page.getByRole("button", { name: /Новая|вне плана|Собрать|Начать/i }).first();
  await safeClick(page, newBtn, "new workout");
  await page.waitForTimeout(1000);
  await shot(page, "05-gym-new.png");

  // 06 — Итог: если есть завершённая — открыть; иначе текущий экран зала
  await page.goto(`${BASE}/workouts/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const doneLink = page.getByText(/готова|итог|нагрузка|\+%/i).first();
  if (await doneLink.isVisible().catch(() => false)) {
    await doneLink.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await shot(page, "06-gym-done.png");

  // 07 — План недели
  const planTab = page.getByRole("button", { name: /План|Неделя|Ещё/i }).first();
  await safeClick(page, planTab, "plan tab");
  await page.waitForTimeout(1000);
  await shot(page, "07-gym-plan.png");

  // 08 — Профиль
  await page.goto(`${BASE}/profile/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, "08-profile.png");

  // 09 — Ниже по профилю
  await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight, 900)));
  await page.waitForTimeout(600);
  await shot(page, "09-profile-more.png");

  // 10 — AI
  await page.goto(`${BASE}/assistant/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, "10-assistant.png");

  // 11 — Офлайн-очередь: посеять черновики + открыть sheet
  await page.goto(`${BASE}/ration/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const key = "cv-meal-draft-queue-v1";
    const now = new Date().toISOString();
    const items = [
      {
        id: "shot-save-1",
        kind: "failed-save",
        createdAt: now,
        selectedDate: now.slice(0, 10),
        body: { date: now.slice(0, 10), dishName: "Овсянка с бананом", calories: 320, portionGrams: 250 },
      },
      {
        id: "shot-save-2",
        kind: "failed-save",
        createdAt: now,
        selectedDate: now.slice(0, 10),
        body: { date: now.slice(0, 10), dishName: "Кофе латте", calories: 120, portionGrams: 250 },
      },
    ];
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignore
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const queueBtn = page.getByRole("button", { name: /Очередь|Ждёт сеть/i }).first();
  if (!(await safeClick(page, queueBtn, "offline queue"))) {
    await safeClick(page, page.getByText(/Ждёт сеть|Очередь/i).first(), "queue text");
  }
  await page.waitForTimeout(800);
  await shot(page, "11-offline-queue.png");

  console.log(`\nГотово → ${OUT}`);
  console.log("Проверьте кадры глазами, затем загрузите 01→11 в RuStore Консоль.");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

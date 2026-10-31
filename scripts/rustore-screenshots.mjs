/**
 * Capture RuStore phone frames (1080×1920) from /dev/rustore-shots.
 *
 * Usage:
 *   npm run dev   # other terminal
 *   npm run rustore:screenshots
 *
 * Env:
 *   SHOTS_BASE=http://127.0.0.1:3000
 *   SHOTS_OUT=rustore/screenshots/submit
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

const fileEnv = { ...readEnvFile(path.join(ROOT, ".env")), ...readEnvFile(path.join(ROOT, ".env.local")) };
const BASE = (process.env.SHOTS_BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const BASE_PATH = (
  process.env.NEXT_PUBLIC_BASE_PATH ??
  process.env.SHOTS_BASE_PATH ??
  fileEnv.NEXT_PUBLIC_BASE_PATH ??
  ""
).replace(/\/$/, "");
const APP = `${BASE}${BASE_PATH}`;
console.log(`Capturing from ${APP}/dev/rustore-shots/`);
const OUT = path.resolve(ROOT, process.env.SHOTS_OUT ?? "rustore/screenshots/submit");
const ARCHIVE = path.resolve(ROOT, "rustore/screenshots/archive");

const SHOTS = [
  { id: "01", file: "01-ration.png" },
  { id: "02", file: "02-add-modes.png" },
  { id: "03", file: "03-stats.png" },
  { id: "04", file: "04-gym.png" },
  { id: "05", file: "05-gym-new.png" },
  { id: "06", file: "06-gym-done.png" },
  { id: "07", file: "07-gym-plan.png" },
  { id: "08", file: "08-profile.png" },
  { id: "09", file: "09-profile-more.png" },
  { id: "10", file: "10-assistant.png" },
  { id: "11", file: "11-offline-queue.png" },
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function waitForBase() {
  const url = `${APP}/dev/rustore-shots/?shot=01`;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0 && res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server not reachable at ${url}. Start with: npm run dev`);
}

async function main() {
  await waitForBase();
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(ARCHIVE, { recursive: true });

  const archiveTag = `pre-hybrid-${stamp()}`;
  for (const shot of SHOTS) {
    const prev = path.join(OUT, shot.file);
    if (fs.existsSync(prev) && shot.id !== "11") {
      const dest = path.join(ARCHIVE, `${archiveTag}-${shot.file}`);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(prev, dest);
      }
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("cv_metrika_consent", "declined");
    } catch {
      // ignore
    }
  });

  for (const shot of SHOTS) {
    const url = `${APP}/dev/rustore-shots/?shot=${shot.id}`;
    process.stdout.write(`→ ${shot.file} … `);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-rustore-shot]", { timeout: 30_000 });
    // Mode picker / offline sheet portals after mount.
    await page.waitForTimeout(shot.id === "11" || shot.id === "02" ? 900 : 400);
    // Full viewport — FoodAddModePicker / OfflineQueueSheet portal outside the frame node.
    const target = path.join(OUT, shot.file);
    await page.screenshot({
      path: target,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
      animations: "disabled",
    });
    process.stdout.write(`1080×1920\n`);
  }

  await browser.close();
  console.log(`Done → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

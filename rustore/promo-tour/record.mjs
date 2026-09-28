/**
 * Record the RuStore promo tour to a vertical MP4 (via Playwright WebM → ffmpeg).
 * Usage: node rustore/promo-tour/record.mjs
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = "/opt/cursor/artifacts";
const TMP_DIR = path.join(__dirname, ".record-tmp");
const WIDTH = 390;
const HEIGHT = 844;
const TOTAL_MS = 38_500;

fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  recordVideo: { dir: TMP_DIR, size: { width: WIDTH, height: HEIGHT } },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:8765/?autostart=0", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => window.__cvPromoReady === true, null, {
  timeout: 15_000,
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__cvPromoStart());
await page.waitForTimeout(TOTAL_MS);
await context.close();
await browser.close();

const webm = fs.readdirSync(TMP_DIR).find((f) => f.endsWith(".webm"));
if (!webm) {
  console.error("No webm produced");
  process.exit(1);
}
const webmPath = path.join(TMP_DIR, webm);
const mp4Path = path.join(OUT_DIR, "rustore-promo-tour-calorie-vision.mp4");
const demoPath = path.join(OUT_DIR, "recording_demo.mp4");
const repoPath = path.join(__dirname, "calorie-vision-promo-tour.mp4");

const ff = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4Path,
  ],
  { encoding: "utf8" },
);
if (ff.status !== 0) {
  console.error(ff.stderr);
  process.exit(1);
}
fs.copyFileSync(mp4Path, demoPath);
fs.copyFileSync(mp4Path, repoPath);
fs.rmSync(TMP_DIR, { recursive: true, force: true });
console.log("OK", mp4Path);
console.log("OK", repoPath);

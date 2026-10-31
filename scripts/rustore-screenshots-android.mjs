/**
 * RuStore screenshots from a real Android device/emulator (adb screencap).
 *
 * Prerequisites:
 *   - USB debugging ON, phone unlocked, `adb devices` shows device
 *   - Calorie Vision installed and logged in
 *
 *   npm run rustore:screenshots:android
 *
 * Flow: for each frame the script prints what to open → you navigate on the phone
 * → press Enter here → screencap → cover-crop to 1080×1920 into submit/.
 *
 * Single shot:  SHOT=02 npm run rustore:screenshots:android
 * Skip prompt:  SHOTS_AUTO=1  (captures immediately — only if already on the right screen)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.resolve(ROOT, process.env.SHOTS_OUT ?? "rustore/screenshots/submit");
const ARCHIVE = path.resolve(ROOT, "rustore/screenshots/archive");
const RAW = path.resolve(ROOT, "rustore/screenshots/android-raw");
const W = 1080;
const H = 1920;

const ALL_SHOTS = [
  {
    id: "01",
    file: "01-ration.png",
    hint: "Сегодня: день с едой, MomentHero, лента, composer внизу. Без системных HUD.",
  },
  {
    id: "02",
    file: "02-add-modes.png",
    hint: "На Сегодня нажми «+» / Ещё — sheet «Добавить» (фото / текст / штрихкод / вода / вес / зал).",
  },
  {
    id: "03",
    file: "03-stats.png",
    hint: "Вкладка Прогресс — неделя / график калорий.",
  },
  {
    id: "04",
    file: "04-gym.png",
    hint: "Вкладка Зал → Сегодня (план или день отдыха, кнопка старта).",
  },
  {
    id: "05",
    file: "05-gym-new.png",
    hint: "Зал: новая тренировка / группы мышц / прогрессия (до старта или экран сборки).",
  },
  {
    id: "06",
    file: "06-gym-done.png",
    hint: "Итог тренировки (+% к прошлой) — после завершения сессии.",
  },
  {
    id: "07",
    file: "07-gym-plan.png",
    hint: "Зал → план на неделю / шаблоны.",
  },
  {
    id: "08",
    file: "08-profile.png",
    hint: "Вкладка Я — цели и аккаунт (верх экрана).",
  },
  {
    id: "09",
    file: "09-profile-more.png",
    hint: "Я — прокрути ниже: нутриенты / экспорт / вес / зал.",
  },
  {
    id: "10",
    file: "10-assistant.png",
    hint: "AI-ассистент: чат + карточка подтверждения блюд, если есть.",
  },
  {
    id: "11",
    file: "11-offline-queue.png",
    hint: "Авиарежим → запись → баннер «Ждёт сеть» → Очередь (видны статусы).",
  },
];

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function adbBin() {
  if (process.env.ADB) return process.env.ADB;
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  if (sdk) {
    const win = path.join(sdk, "platform-tools", "adb.exe");
    const unix = path.join(sdk, "platform-tools", "adb");
    if (fs.existsSync(win)) return win;
    if (fs.existsSync(unix)) return unix;
  }
  return "adb";
}

function adb(args, opts = {}) {
  const bin = adbBin();
  const r = spawnSync(bin, args, {
    encoding: opts.encoding ?? "buffer",
    maxBuffer: 40 * 1024 * 1024,
    ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || Buffer.from("adb failed")).toString();
    throw new Error(err.trim() || `adb ${args.join(" ")} failed (${r.status})`);
  }
  return r;
}

function requireDevice() {
  const out = adb(["devices"], { encoding: "utf8" }).stdout.toString();
  const lines = out
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean);
  const ready = lines.filter((l) => /\tdevice$/.test(l));
  if (ready.length === 0) {
    console.error(out);
    throw new Error(
      "Нет устройства. Подключи телефон (USB debugging) или запусти эмулятор, затем: adb devices",
    );
  }
  console.log(`Device: ${ready[0].split(/\s+/)[0]}`);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function coverToStore(rawPath, outPath) {
  const meta = await sharp(rawPath).metadata();
  const iw = meta.width || W;
  const ih = meta.height || H;
  // Cover 9:16 — crop center (prefer drop status bar top a bit on tall phones)
  const targetRatio = W / H;
  const srcRatio = iw / ih;
  let left = 0;
  let top = 0;
  let width = iw;
  let height = ih;
  if (srcRatio > targetRatio) {
    width = Math.round(ih * targetRatio);
    left = Math.round((iw - width) / 2);
  } else if (srcRatio < targetRatio) {
    height = Math.round(iw / targetRatio);
    // Bias crop downward slightly to cut status bar / notch
    top = Math.min(Math.round((ih - height) * 0.15), ih - height);
  }
  await sharp(rawPath)
    .extract({ left, top, width, height })
    .resize(W, H, { fit: "fill" })
    .png()
    .toFile(outPath);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(ARCHIVE, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });
  requireDevice();

  const only = (process.env.SHOT || "").trim();
  const shots = only ? ALL_SHOTS.filter((s) => s.id === only || s.file === only) : ALL_SHOTS;
  if (shots.length === 0) throw new Error(`Unknown SHOT=${only}`);

  const archiveTag = `pre-android-${stamp()}`;
  for (const shot of shots) {
    const prev = path.join(OUT, shot.file);
    if (fs.existsSync(prev)) {
      const dest = path.join(ARCHIVE, `${archiveTag}-${shot.file}`);
      if (!fs.existsSync(dest)) fs.copyFileSync(prev, dest);
    }
  }

  console.log("\nСъёмка с Android → 1080×1920. На телефоне открой нужный экран, здесь Enter.\n");

  for (const shot of shots) {
    console.log(`\n[${shot.id}] ${shot.file}`);
    console.log(`  ${shot.hint}`);
    if (!process.env.SHOTS_AUTO) {
      const ans = (await ask("  Enter = снять · s = skip · q = quit › ")).trim().toLowerCase();
      if (ans === "q") break;
      if (ans === "s") {
        console.log("  skipped");
        continue;
      }
    }

    const rawPath = path.join(RAW, `${shot.id}-source.png`);
    const png = adb(["exec-out", "screencap", "-p"]).stdout;
    if (!png || png.length < 1000) throw new Error("Empty screencap");
    fs.writeFileSync(rawPath, png);
    const outPath = path.join(OUT, shot.file);
    await coverToStore(rawPath, outPath);
    const meta = await sharp(outPath).metadata();
    console.log(`  ✓ ${shot.file} (${meta.width}×${meta.height})  raw→ ${path.relative(ROOT, rawPath)}`);
  }

  console.log(`\nГотово → ${OUT}`);
  console.log("Сырые кадры → rustore/screenshots/android-raw/");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

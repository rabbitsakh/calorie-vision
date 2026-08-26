/**
 * check-env.ts — validate required production env vars against `.env.example`.
 *
 * Usage:
 *   npm run check:env
 *   npx tsx scripts/check-env.ts
 *   npx tsx scripts/check-env.ts --strict   # exit 1 if any required var missing/weak
 *
 * Reads process.env (and optionally a local `.env` if already loaded by the shell).
 * Does NOT print secret values — only names and status.
 * Do not commit real secrets; keep them in the server environment / secrets manager.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = join(root, ".env.example");

/** Keys that must be set for a typical calorievision.ru production deploy. */
const REQUIRED = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GIGACHAT_CREDENTIALS",
] as const;

/** Strongly recommended for full product features (login, push, analytics, cron). */
const RECOMMENDED = [
  "EMAIL_FROM",
  "EMAIL_SERVER",
  "YANDEX_METRIKA_ID",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
] as const;

/** Optional OAuth / extras — warn only if half-configured. */
const OPTIONAL_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ["VK_CLIENT_ID", "VK_CLIENT_SECRET"],
];

const PLACEHOLDER_PATTERNS = [
  /^сгенерируйте/i,
  /^ваш-ключ/i,
  /^password$/i,
  /^changeme$/i,
  /^secret$/i,
  /^todo$/i,
  /^xxx+$/i,
  /^<.*>$/,
  /^your[_-]/i,
  /^example$/i,
];

type Status = "ok" | "missing" | "weak" | "empty";

function loadExampleKeys(): string[] {
  if (!existsSync(examplePath)) {
    return [];
  }
  const text = readFileSync(examplePath, "utf8");
  const keys: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    keys.push(trimmed.slice(0, eq).trim());
  }
  return keys;
}

function classify(value: string | undefined): Status {
  if (value === undefined) return "missing";
  const v = value.trim();
  if (!v) return "empty";
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(v))) return "weak";
  if (v.length < 8 && /secret|password|token|credentials|key/i.test(v)) return "weak";
  return "ok";
}

function hasEmailServer(): boolean {
  if (classify(process.env.EMAIL_SERVER) === "ok") return true;
  const host = classify(process.env.EMAIL_SERVER_HOST);
  const user = classify(process.env.EMAIL_SERVER_USER);
  const pass = classify(process.env.EMAIL_SERVER_PASSWORD);
  return host === "ok" && user === "ok" && pass === "ok";
}

function printRow(name: string, status: Status, note?: string): void {
  const icon = status === "ok" ? "✓" : status === "weak" ? "!" : "✗";
  const label = status.toUpperCase().padEnd(8);
  console.log(`  ${icon} ${label} ${name}${note ? ` — ${note}` : ""}`);
}

function main(): void {
  const strict = process.argv.includes("--strict");
  const exampleKeys = loadExampleKeys();

  console.log("Calorie Vision — проверка переменных окружения\n");
  console.log(`Файл-образец: ${existsSync(examplePath) ? ".env.example" : "(не найден)"}`);
  if (exampleKeys.length) {
    console.log(`Ключей в .env.example: ${exampleKeys.length}`);
  }
  console.log("");

  let missingRequired = 0;
  let weakRequired = 0;

  console.log("Обязательные (production):");
  for (const key of REQUIRED) {
    let status = classify(process.env[key]);
    if (key === "NEXTAUTH_SECRET" && status === "ok") {
      const len = (process.env[key] ?? "").trim().length;
      if (len < 24) {
        status = "weak";
      }
    }
    if (status === "missing" || status === "empty") missingRequired += 1;
    if (status === "weak") weakRequired += 1;
    printRow(key, status, status === "weak" ? "похоже на placeholder / слишком коротко" : undefined);
  }

  console.log("\nРекомендуемые:");
  for (const key of RECOMMENDED) {
    if (key === "EMAIL_SERVER") {
      const ok = hasEmailServer();
      printRow(
        "EMAIL_SERVER (или HOST/USER/PASSWORD)",
        ok ? "ok" : classify(process.env.EMAIL_SERVER) === "missing" ? "missing" : "empty",
        ok ? undefined : "нужен SMTP для magic link",
      );
      continue;
    }
    if (key === "YANDEX_METRIKA_ID") {
      const raw = process.env.YANDEX_METRIKA_ID ?? process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
      const status = classify(raw);
      printRow("YANDEX_METRIKA_ID", status, status !== "ok" ? "аналитика отключена" : undefined);
      continue;
    }
    printRow(key, classify(process.env[key]));
  }

  console.log("\nОпциональные пары (OAuth):");
  for (const [a, b] of OPTIONAL_PAIRS) {
    const sa = classify(process.env[a]);
    const sb = classify(process.env[b]);
    if (sa === "ok" && sb === "ok") {
      printRow(`${a} + ${b}`, "ok");
    } else if (sa === "missing" && sb === "missing") {
      printRow(`${a} + ${b}`, "empty", "не настроено (ок)");
    } else {
      printRow(`${a} + ${b}`, "weak", "задана только одна сторона пары");
    }
  }

  // Surface example keys that look required but aren't in our lists
  const known = new Set<string>([
    ...REQUIRED,
    ...RECOMMENDED,
    "EMAIL_SERVER_HOST",
    "EMAIL_SERVER_PORT",
    "EMAIL_SERVER_USER",
    "EMAIL_SERVER_PASSWORD",
    "EMAIL_SERVER_SECURE",
    "NEXT_PUBLIC_YANDEX_METRIKA_ID",
    "NEXT_PUBLIC_BASE_PATH",
    "UPLOAD_DIR",
    "GIGACHAT_SCOPE",
    "GIGACHAT_MODEL",
    "GIGACHAT_API_BASE",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "VK_CLIENT_ID",
    "VK_CLIENT_SECRET",
  ]);
  const extra = exampleKeys.filter((k) => !known.has(k));
  if (extra.length) {
    console.log("\nДругие ключи из .env.example:");
    for (const key of extra) {
      printRow(key, classify(process.env[key]));
    }
  }

  console.log("");
  if (missingRequired || weakRequired) {
    console.log(
      `Итог: проблем с обязательными — missing/empty: ${missingRequired}, weak: ${weakRequired}`,
    );
  } else {
    console.log("Итог: обязательные переменные выглядят заданными.");
  }
  console.log("Секреты в вывод не печатаются. Не коммитьте .env с реальными значениями.\n");

  if (strict && (missingRequired > 0 || weakRequired > 0)) {
    process.exit(1);
  }
}

main();

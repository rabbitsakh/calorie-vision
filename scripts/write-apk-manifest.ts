/**
 * Пишет public/downloads/apk.json по подписанному APK.
 * Версию приложения, .env и keystore не меняет.
 *
 *   node --experimental-strip-types --no-warnings scripts/write-apk-manifest.ts \
 *     --apk rustore/dist/app-release.apk --out public/downloads/apk.json --repo .
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApkManifest, parseBadgingVersion } from "../src/lib/apk-manifest.ts";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function versionFromRepo(repo: string): { versionName: string; versionCode: number } | null {
  try {
    const twa = JSON.parse(readFileSync(resolve(repo, "rustore/twa-manifest.json"), "utf8")) as {
      appVersionName?: unknown;
      appVersionCode?: unknown;
    };
    const versionName = typeof twa.appVersionName === "string" ? twa.appVersionName : "";
    const versionCode = typeof twa.appVersionCode === "number" ? twa.appVersionCode : Number.NaN;
    if (versionName && Number.isInteger(versionCode) && versionCode > 0) {
      return { versionName, versionCode };
    }
  } catch {
    // манифеста TWA нет — ниже package.json
  }
  try {
    const pkg = JSON.parse(readFileSync(resolve(repo, "package.json"), "utf8")) as { version?: unknown };
    const versionName = typeof pkg.version === "string" ? pkg.version : "";
    const parts = versionName.split(".").map((part) => Number(part));
    if (parts.length === 3 && parts.every((part) => Number.isInteger(part) && part >= 0)) {
      return {
        versionName,
        versionCode: parts[0] * 10000 + parts[1] * 100 + parts[2],
      };
    }
  } catch {
    return null;
  }
  return null;
}

const apkPath = arg("--apk");
const outPath = arg("--out");
if (!apkPath || !outPath) {
  console.error(
    "Нужны --apk и --out. Пример: --apk app-release.apk --out public/downloads/apk.json --repo .",
  );
  process.exit(1);
}

const bytes = readFileSync(apkPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const sizeBytes = bytes.length;
const builtAt = arg("--built-at") ?? statSync(apkPath).mtime.toISOString();

let versionName = arg("--version-name") ?? "";
let versionCode = Number(arg("--version-code") ?? "");
if (!Number.isInteger(versionCode) || versionCode <= 0) versionCode = 0;

const badgingPath = arg("--badging");
if ((!versionName || versionCode <= 0) && badgingPath) {
  const parsed = parseBadgingVersion(readFileSync(badgingPath, "utf8"));
  if (parsed) {
    if (!versionName) versionName = parsed.versionName;
    if (versionCode <= 0) versionCode = parsed.versionCode;
  }
}

const repo = arg("--repo");
if ((!versionName || versionCode <= 0) && repo) {
  const parsed = versionFromRepo(repo);
  if (parsed) {
    if (!versionName) versionName = parsed.versionName;
    if (versionCode <= 0) versionCode = parsed.versionCode;
  }
}

const manifest = buildApkManifest({ versionName, versionCode, builtAt, sizeBytes, sha256 });
if (!manifest) {
  console.error("Не удалось собрать apk.json: нет versionName/versionCode у подписанного APK.");
  process.exit(1);
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `apk.json ${manifest.versionName} (${manifest.versionCode}) ${manifest.sizeBytes} bytes ${manifest.sha256.slice(0, 12)}…`,
);

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildApkManifest,
  formatApkReleaseLabel,
  parseApkManifest,
  parseBadgingVersion,
} from "./apk-manifest.ts";
import { readHostedApkReleaseLabel } from "./read-apk-manifest.ts";

const SAMPLE = {
  versionName: "3.6.15",
  versionCode: 30615,
  builtAt: "2026-11-13T00:00:00.000Z",
  sizeBytes: 19_398_656,
  sha256: "ab".repeat(32),
};

test("подпись релиза: версия, дата по Москве и размер", () => {
  const manifest = buildApkManifest(SAMPLE);
  assert.ok(manifest);
  assert.equal(formatApkReleaseLabel(manifest), "Версия 3.6.15 · 13 ноября 2026 · 18,5 МБ");
});

test("поздний вечер UTC — уже следующий день в Москве", () => {
  const manifest = buildApkManifest({
    ...SAMPLE,
    builtAt: "2026-11-12T21:30:00.000Z",
    sizeBytes: 0,
  });
  assert.ok(manifest);
  assert.equal(formatApkReleaseLabel(manifest), "Версия 3.6.15 · 13 ноября 2026");
});

test("битый манифест не даёт подпись", () => {
  assert.equal(parseApkManifest(null), null);
  assert.equal(parseApkManifest({ versionName: "свежий" }), null);
  assert.equal(parseApkManifest({ ...SAMPLE, sha256: "нет" }), null);
  assert.equal(parseApkManifest({ ...SAMPLE, versionCode: 1.5 }), null);
  assert.equal(parseApkManifest({ ...SAMPLE, builtAt: "вчера" }), null);
});

test("aapt dump badging отдаёт versionName и versionCode", () => {
  const parsed = parseBadgingVersion(
    "package: name='ru.calorievision.app' versionCode='30615' versionName='3.6.15' platformBuildVersionName='14'",
  );
  assert.deepEqual(parsed, { versionName: "3.6.15", versionCode: 30615 });
  assert.equal(parseBadgingVersion("no package"), null);
});

test("локальный apk.json подписывает только свой URL", () => {
  const dir = mkdtempSync(join(tmpdir(), "cv-apk-meta-"));
  const file = join(dir, "apk.json");
  writeFileSync(file, `${JSON.stringify(SAMPLE)}\n`);
  try {
    delete process.env.NEXT_PUBLIC_APK_URL;
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    assert.equal(
      readHostedApkReleaseLabel("/downloads/calorie-vision.apk", file),
      "Версия 3.6.15 · 13 ноября 2026 · 18,5 МБ",
    );
    assert.equal(readHostedApkReleaseLabel("https://cdn.example/app.apk", file), null);
    assert.equal(readHostedApkReleaseLabel("/downloads/calorie-vision.apk", join(dir, "missing.json")), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("write-apk-manifest пишет json и не меняет версию приложения", () => {
  const dir = mkdtempSync(join(tmpdir(), "cv-apk-write-"));
  const apk = join(dir, "app.apk");
  const out = join(dir, "apk.json");
  writeFileSync(apk, "apk-bytes");
  const pkgBefore = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const twaBefore = readFileSync(join(process.cwd(), "rustore/twa-manifest.json"), "utf8");
  try {
    execFileSync(
      "node",
      [
        "--experimental-strip-types",
        "--no-warnings",
        "scripts/write-apk-manifest.ts",
        "--apk",
        apk,
        "--out",
        out,
        "--version-name",
        "9.9.9",
        "--version-code",
        "90909",
        "--built-at",
        "2026-11-13T00:00:00.000Z",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    const manifest = JSON.parse(readFileSync(out, "utf8")) as {
      versionName: string;
      versionCode: number;
      sizeBytes: number;
      sha256: string;
      builtAt: string;
    };
    assert.equal(manifest.versionName, "9.9.9");
    assert.equal(manifest.versionCode, 90909);
    assert.equal(manifest.sizeBytes, Buffer.byteLength("apk-bytes"));
    assert.equal(manifest.sha256, createHash("sha256").update("apk-bytes").digest("hex"));
    assert.equal(manifest.builtAt, "2026-11-13T00:00:00.000Z");
    assert.equal(readFileSync(join(process.cwd(), "package.json"), "utf8"), pkgBefore);
    assert.equal(readFileSync(join(process.cwd(), "rustore/twa-manifest.json"), "utf8"), twaBefore);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("без версии write-apk-manifest завершается с ошибкой и файл не пишет", () => {
  const dir = mkdtempSync(join(tmpdir(), "cv-apk-write-fail-"));
  const repo = join(dir, "repo");
  const apk = join(dir, "app.apk");
  const out = join(dir, "apk.json");
  writeFileSync(apk, "apk-bytes");
  try {
    assert.throws(() => {
      execFileSync(
        "node",
        [
          "--experimental-strip-types",
          "--no-warnings",
          "scripts/write-apk-manifest.ts",
          "--apk",
          apk,
          "--out",
          out,
          "--repo",
          repo,
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );
    });
    assert.equal(
      (() => {
        try {
          readFileSync(out);
          return true;
        } catch {
          return false;
        }
      })(),
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

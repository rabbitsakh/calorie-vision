import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_APK_MANIFEST_PATH, getApkManifestUrl } from "@/lib/android-install";
import { formatApkReleaseLabel, parseApkManifest, type ApkManifest } from "@/lib/apk-manifest";
import { withBasePath } from "@/lib/paths";

const DEFAULT_FILE = join(process.cwd(), "public", "downloads", "apk.json");

/** Читает манифест с диска. Нет файла или он битый — null, ссылка на APK от этого не зависит. */
export function readHostedApkManifest(filePath = DEFAULT_FILE): ApkManifest | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    return parseApkManifest(parsed);
  } catch {
    return null;
  }
}

/**
 * Подпись для своего `/downloads/apk.json`.
 * Для чужого URL (CDN) локальный файл не показываем: его версия может быть про другой APK.
 */
export function readHostedApkReleaseLabel(apkUrl: string, filePath = DEFAULT_FILE): string | null {
  if (getApkManifestUrl(apkUrl) !== withBasePath(DEFAULT_APK_MANIFEST_PATH)) return null;
  const manifest = readHostedApkManifest(filePath);
  return manifest ? formatApkReleaseLabel(manifest) : null;
}

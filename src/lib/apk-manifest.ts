/** Манифест прямой загрузки APK. Пишется при сборке в `public/downloads/apk.json`. */

export const APK_RELEASE_TIME_ZONE = "Europe/Moscow";

const VERSION_NAME_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

export type ApkManifest = {
  versionName: string;
  versionCode: number;
  /** ISO-8601, момент подписанного файла. */
  builtAt: string;
  sizeBytes: number;
  sha256: string;
};

export function buildApkManifest(input: {
  versionName: string;
  versionCode: number;
  builtAt: string | Date;
  sizeBytes: number;
  sha256: string;
}): ApkManifest | null {
  const versionName = input.versionName.trim();
  if (!VERSION_NAME_RE.test(versionName)) return null;
  if (!Number.isInteger(input.versionCode) || input.versionCode <= 0 || input.versionCode > 2_100_000_000) {
    return null;
  }
  const date = input.builtAt instanceof Date ? input.builtAt : new Date(input.builtAt);
  if (Number.isNaN(date.getTime())) return null;
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0 || !Number.isInteger(input.sizeBytes)) {
    return null;
  }
  const sha256 = input.sha256.trim().toLowerCase();
  if (!SHA256_RE.test(sha256)) return null;
  return {
    versionName,
    versionCode: input.versionCode,
    builtAt: date.toISOString(),
    sizeBytes: input.sizeBytes,
    sha256,
  };
}

export function parseApkManifest(data: unknown): ApkManifest | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const versionName = typeof row.versionName === "string" ? row.versionName : "";
  const versionCode = typeof row.versionCode === "number" ? row.versionCode : Number.NaN;
  const builtAt = typeof row.builtAt === "string" ? row.builtAt : "";
  const sizeBytes = typeof row.sizeBytes === "number" ? row.sizeBytes : Number.NaN;
  const sha256 = typeof row.sha256 === "string" ? row.sha256 : "";
  return buildApkManifest({ versionName, versionCode, builtAt, sizeBytes, sha256 });
}

/** `aapt dump badging`: package: name='…' versionCode='30615' versionName='3.6.15' */
export function parseBadgingVersion(badging: string): { versionName: string; versionCode: number } | null {
  const name = badging.match(/versionName='([^']+)'/);
  const code = badging.match(/versionCode='(\d+)'/);
  if (!name?.[1] || !code?.[1]) return null;
  const versionCode = Number(code[1]);
  if (!Number.isInteger(versionCode) || versionCode <= 0) return null;
  return { versionName: name[1], versionCode };
}

function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ").trim();
}

export function formatApkBuiltAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APK_RELEASE_TIME_ZONE,
  }).format(date);
  return normalizeSpaces(formatted.replace(/\s*г\.?$/u, ""));
}

export function formatApkSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) {
    const kb = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(bytes / 1024);
    return `${normalizeSpaces(kb)} КБ`;
  }
  const text = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(mb);
  return `${normalizeSpaces(text)} МБ`;
}

/** «Версия 3.6.15 · 13 ноября 2026 · 18,5 МБ». Размер опускается, если его нет. */
export function formatApkReleaseLabel(manifest: ApkManifest): string | null {
  const date = formatApkBuiltAt(manifest.builtAt);
  if (!date) return null;
  const size = formatApkSize(manifest.sizeBytes);
  const base = `Версия ${manifest.versionName} · ${date}`;
  return size ? `${base} · ${size}` : base;
}

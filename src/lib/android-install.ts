import { withBasePath } from "@/lib/paths";

/** Default path when APK is copied to `public/downloads/` (see rustore-build.sh). */
export const DEFAULT_APK_PATH = "/downloads/calorie-vision.apk";

/** Sibling of the hosted APK. Written by the Android build, not by hand in the page. */
export const DEFAULT_APK_MANIFEST_PATH = "/downloads/apk.json";

/** Direct APK download URL (env override or hosted file under public/). */
export function getApkDownloadUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APK_URL?.trim();
  if (fromEnv) {
    if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
      return fromEnv;
    }
    return withBasePath(fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`);
  }
  return withBasePath(DEFAULT_APK_PATH);
}

/**
 * Манифест рядом с файлом, на который ведёт ссылка.
 * Нет `.apk` в пути — версию не к чему привязать.
 */
export function getApkManifestUrl(apkUrl = getApkDownloadUrl()): string | null {
  const trimmed = apkUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!url.pathname.toLowerCase().endsWith(".apk")) return null;
      url.pathname = url.pathname.replace(/[^/]+$/, "apk.json");
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }
  const pathOnly = trimmed.split(/[?#]/)[0] ?? "";
  if (!pathOnly.toLowerCase().endsWith(".apk")) return null;
  return pathOnly.replace(/[^/]+$/, "apk.json");
}

/** Public RuStore catalog card (package `ru.calorievision.app`). */
export const DEFAULT_RUSTORE_URL =
  "https://www.rustore.ru/catalog/app/ru.calorievision.app";

export const RUSTORE_PACKAGE_ID = "ru.calorievision.app";

/** Official badge asset (hosted locally from RuStore help icons). */
export const RUSTORE_BADGE_SRC = "/brand/rustore-badge.svg";

/** RuStore catalog card. Env overrides the published default. */
export function getRustoreUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_RUSTORE_URL?.trim();
  if (fromEnv === "") return null;
  return fromEnv || DEFAULT_RUSTORE_URL;
}

/**
 * Catalog URL with RuStore badge UTM marks
 * (https://www.rustore.ru/help/developers/advertising-and-promotion/button-rustore/rustore-button).
 */
export function getRustoreBadgeUrl(): string | null {
  const base = getRustoreUrl();
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set("utm_source", "available_in_rustore");
    url.searchParams.set("utm_medium", RUSTORE_PACKAGE_ID);
    url.searchParams.set("rsm", "1");
    url.searchParams.set("mt_link_id", "iios36");
    url.searchParams.set("mt_sub1", RUSTORE_PACKAGE_ID);
    return url.toString();
  } catch {
    return base;
  }
}

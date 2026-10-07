import { withBasePath } from "@/lib/paths";

/** Default path when APK is copied to `public/downloads/` (see rustore-build.sh). */
export const DEFAULT_APK_PATH = "/downloads/calorie-vision.apk";

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

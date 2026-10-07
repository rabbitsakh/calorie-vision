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

/** RuStore catalog card. Env overrides the published default. */
export function getRustoreUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_RUSTORE_URL?.trim();
  if (fromEnv === "") return null;
  return fromEnv || DEFAULT_RUSTORE_URL;
}

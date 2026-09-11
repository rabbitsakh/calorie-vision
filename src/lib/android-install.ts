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

/** RuStore catalog card, when published. */
export function getRustoreUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_RUSTORE_URL?.trim();
  return url || null;
}

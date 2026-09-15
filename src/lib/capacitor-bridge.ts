/**
 * Thin bridge: detect Capacitor Android shell and prefer native camera when present.
 * Safe no-op on web / TWA / PWA.
 */

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Take a photo via Capacitor Camera plugin; returns data URL or null if unavailable. */
export async function takeNativeFoodPhoto(): Promise<string | null> {
  if (!isCapacitorNative()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 88,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      correctOrientation: true,
      width: 1600,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

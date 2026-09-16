/**
 * Thin bridge: detect Capacitor Android shell and prefer native camera when present.
 * Safe no-op on web / TWA / PWA.
 */

type CapWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as CapWindow).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") {
    try {
      return Boolean(cap.isNativePlatform());
    } catch {
      // fall through
    }
  }
  const platform = cap.getPlatform?.();
  return platform === "android" || platform === "ios";
}

/** Remote server.url WebViews sometimes inject the bridge a tick late. */
export async function waitForCapacitorNative(timeoutMs = 1200): Promise<boolean> {
  if (isCapacitorNative()) return true;
  if (typeof window === "undefined") return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
    if (isCapacitorNative()) return true;
  }
  return isCapacitorNative();
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

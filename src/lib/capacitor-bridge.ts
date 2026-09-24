/**
 * Thin bridge: detect Capacitor Android/iOS shell and prefer native camera when present.
 * Safe no-op on web / TWA / PWA.
 *
 * RuStore APK opens local assets then navigates to calorievision.ru (allowNavigation).
 * The bridge can inject a tick late after that navigation — callers that gate UX
 * (reminders, camera, OAuth) should `await detectCapacitorShell()` before deciding.
 */

const SHELL_FLAG_KEY = "cv-capacitor-shell";

type CapWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    isPluginAvailable?: (name: string) => boolean;
    Plugins?: Record<string, unknown>;
  };
};

function capObject(): CapWindow["Capacitor"] | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as CapWindow).Capacitor;
}

/** Sync probe of the injected Capacitor runtime (not web stubs). */
function probeCapacitorRuntime(): boolean {
  const cap = capObject();
  if (!cap) return false;

  if (typeof cap.isNativePlatform === "function") {
    try {
      if (cap.isNativePlatform()) return true;
    } catch {
      // fall through
    }
  }

  const platform = cap.getPlatform?.();
  if (platform === "android" || platform === "ios") return true;

  // Some builds expose plugins before isNativePlatform settles.
  if (typeof cap.isPluginAvailable === "function") {
    try {
      if (
        cap.isPluginAvailable("CapacitorApp") ||
        cap.isPluginAvailable("App") ||
        cap.isPluginAvailable("Preferences") ||
        cap.isPluginAvailable("LocalNotifications") ||
        cap.isPluginAvailable("Camera")
      ) {
        // Only trust plugin availability when platform is not explicitly "web".
        if (platform !== "web") return true;
      }
    } catch {
      // fall through
    }
  }

  return false;
}

function readPersistedShellFlag(): boolean {
  if (typeof document !== "undefined") {
    try {
      if (document.documentElement.classList.contains("capacitor-native")) return true;
    } catch {
      // ignore
    }
  }
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SHELL_FLAG_KEY) === "1") {
      return true;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(SHELL_FLAG_KEY) === "1") {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Persist shell mark for SPA navigations and full reloads inside the same WebView origin. */
export function markCapacitorShell(): void {
  if (typeof document !== "undefined") {
    try {
      document.documentElement.classList.add("capacitor-native");
    } catch {
      // ignore
    }
  }
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SHELL_FLAG_KEY, "1");
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SHELL_FLAG_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * True when running inside the Capacitor APK/iOS shell (or after we already marked it).
 * Prefer `await detectCapacitorShell()` on first paint when the answer drives UX.
 */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  if (probeCapacitorRuntime()) {
    markCapacitorShell();
    return true;
  }
  return readPersistedShellFlag();
}

/**
 * Wait for the native bridge, then persist the shell mark.
 * Use before push/reminder capability checks in the APK.
 */
export async function detectCapacitorShell(timeoutMs = 2500): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (probeCapacitorRuntime()) {
    markCapacitorShell();
    return true;
  }
  if (readPersistedShellFlag()) {
    markCapacitorShell();
    return true;
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
    if (probeCapacitorRuntime()) {
      markCapacitorShell();
      return true;
    }
  }

  if (probeCapacitorRuntime() || readPersistedShellFlag()) {
    markCapacitorShell();
    return true;
  }
  return false;
}

/** @deprecated Prefer detectCapacitorShell — same wait, also persists the shell mark. */
export async function waitForCapacitorNative(timeoutMs = 1200): Promise<boolean> {
  return detectCapacitorShell(timeoutMs);
}

/** Take a photo via Capacitor Camera plugin; returns data URL or null if unavailable. */
export async function takeNativeFoodPhoto(): Promise<string | null> {
  if (!isCapacitorNative()) {
    // No Capacitor object → plain web; don't burn a wait budget.
    if (!capObject()) return null;
    if (!(await detectCapacitorShell(800))) return null;
  }
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

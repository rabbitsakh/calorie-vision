/**
 * APK / Android WebView often reports navigator.onLine=false while the network works.
 * Never gate UX on onLine alone — probe /api/health (same pattern as rustore/cap-www).
 */

import { withBasePath } from "@/lib/paths";
import { isNetworkFetchError } from "@/lib/read-api-json";

const DEFAULT_PROBE_MS = 4000;
const DEFAULT_OFFLINE_DEBOUNCE_MS = 1500;

/** True when a real fetch failure suggests the device cannot reach the API. */
export function isLikelyOfflineError(error: unknown): boolean {
  if (isNetworkFetchError(error)) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof Error && /failed to fetch|network|offline/i.test(error.message)) {
    return true;
  }
  return false;
}

/**
 * Probe same-origin /api/health. Resolves true when the API answers {ok:true}.
 * Optimistic: callers should treat unknown/pending as online.
 */
export async function probeOnline(timeoutMs = DEFAULT_PROBE_MS): Promise<boolean> {
  if (typeof window === "undefined") return true;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const bust = Date.now();

  try {
    const resp = await fetch(withBasePath(`/api/health?cv_probe=${bust}`), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { ok?: boolean };
    return data?.ok === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

export type ConnectivityListener = (online: boolean) => void;

export type SubscribeConnectivityOptions = {
  /** Delay before flipping UI to offline after an `offline` event (ms). */
  debounceOfflineMs?: number;
  /** Probe on subscribe and when browser fires `online`. Default true. */
  probeOnChange?: boolean;
};

/**
 * Subscribe to connectivity for UI. Starts optimistic-online; debounce offline
 * flips; confirm with probeOnline when the browser claims online again.
 */
export function subscribeConnectivity(
  listener: ConnectivityListener,
  options: SubscribeConnectivityOptions = {},
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const debounceMs = options.debounceOfflineMs ?? DEFAULT_OFFLINE_DEBOUNCE_MS;
  const probeOnChange = options.probeOnChange !== false;
  let offlineTimer: number | null = null;
  let disposed = false;

  function emit(online: boolean) {
    if (!disposed) listener(online);
  }

  function clearOfflineTimer() {
    if (offlineTimer != null) {
      window.clearTimeout(offlineTimer);
      offlineTimer = null;
    }
  }

  async function confirmOnline() {
    clearOfflineTimer();
    if (!probeOnChange) {
      emit(true);
      return;
    }
    const ok = await probeOnline();
    if (!disposed) emit(ok);
  }

  function onOnline() {
    void confirmOnline();
  }

  function onOffline() {
    clearOfflineTimer();
    offlineTimer = window.setTimeout(() => {
      offlineTimer = null;
      // Brief blips: re-check before showing offline chrome.
      void probeOnline().then((ok) => {
        if (!disposed) emit(ok);
      });
    }, debounceMs);
  }

  // Optimistic: do not trust navigator.onLine on first paint.
  emit(true);
  if (probeOnChange) {
    void probeOnline().then((ok) => {
      if (!disposed) emit(ok);
    });
  }

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    disposed = true;
    clearOfflineTimer();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

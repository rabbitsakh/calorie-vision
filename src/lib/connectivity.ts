/**
 * APK / Android WebView often reports navigator.onLine=false while the network works.
 * Never gate UX on onLine alone — multi-step probe (health → favicon), same as rustore/cap-www.
 */

import { withBasePath } from "@/lib/paths";
import { isNetworkFetchError } from "@/lib/read-api-json";

const DEFAULT_PROBE_MS = 4000;
const DEFAULT_OFFLINE_DEBOUNCE_MS = 1500;
/** Positive results stick longer; negatives are short so a blip recovers fast (T3). */
const DEFAULT_PROBE_OK_CACHE_MS = 12_000;
const DEFAULT_PROBE_FAIL_CACHE_MS = 2_500;
const OFFLINE_REPROBE_MS = 8_000;

/** True when a real fetch failure suggests the device cannot reach the API. */
export function isLikelyOfflineError(error: unknown): boolean {
  if (isNetworkFetchError(error)) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof Error && /failed to fetch|network|offline/i.test(error.message)) {
    return true;
  }
  return false;
}

type ProbeCache = { at: number; ok: boolean };
let probeCache: ProbeCache | null = null;

/** Test helper — drop short TTL so the next probe hits the network. */
export function clearProbeOnlineCache(): void {
  probeCache = null;
}

async function probeFaviconFallback(timeoutMs: number): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bust = Date.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), Math.min(timeoutMs, 2500));
  try {
    await fetch(withBasePath(`/favicon.ico?cv_probe=${bust}`), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      mode: "no-cors",
      signal: controller.signal,
    });
    // no-cors opaque response still means the host answered.
    return true;
  } catch {
    return await new Promise<boolean>((resolve) => {
      const img = new Image();
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const imgTimer = window.setTimeout(() => finish(false), Math.min(timeoutMs, 2000));
      img.onload = () => {
        window.clearTimeout(imgTimer);
        finish(true);
      };
      img.onerror = () => {
        window.clearTimeout(imgTimer);
        finish(false);
      };
      img.src = withBasePath(`/favicon.ico?cv_img=${Date.now()}`);
    });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Probe same-origin /api/health, then favicon fallbacks (T3).
 * Optimistic: callers should treat unknown/pending as online.
 */
export async function probeOnline(
  timeoutMs = DEFAULT_PROBE_MS,
  options?: { bypassCache?: boolean; cacheMs?: number },
): Promise<boolean> {
  if (typeof window === "undefined") return true;

  if (!options?.bypassCache && probeCache) {
    const ttl = options?.cacheMs
      ?? (probeCache.ok ? DEFAULT_PROBE_OK_CACHE_MS : DEFAULT_PROBE_FAIL_CACHE_MS);
    if (Date.now() - probeCache.at < ttl) {
      return probeCache.ok;
    }
  }

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
    if (resp.ok) {
      const data = (await resp.json()) as { ok?: boolean };
      if (data?.ok === true) {
        probeCache = { at: Date.now(), ok: true };
        return true;
      }
    }
  } catch {
    // fall through to favicon
  } finally {
    window.clearTimeout(timer);
  }

  const fallbackOk = await probeFaviconFallback(timeoutMs);
  probeCache = { at: Date.now(), ok: fallbackOk };
  return fallbackOk;
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
 * flips; confirm with probeOnline; re-probe on visibility while offline (T3).
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
  let reprobeTimer: number | null = null;
  let disposed = false;
  let lastOnline = true;

  function emit(online: boolean) {
    if (disposed) return;
    lastOnline = online;
    listener(online);
    if (!online) {
      scheduleReprobe();
    } else {
      clearReprobe();
    }
  }

  function clearOfflineTimer() {
    if (offlineTimer != null) {
      window.clearTimeout(offlineTimer);
      offlineTimer = null;
    }
  }

  function clearReprobe() {
    if (reprobeTimer != null) {
      window.clearTimeout(reprobeTimer);
      reprobeTimer = null;
    }
  }

  function scheduleReprobe() {
    clearReprobe();
    reprobeTimer = window.setTimeout(() => {
      reprobeTimer = null;
      if (disposed || lastOnline) return;
      void probeOnline(DEFAULT_PROBE_MS, { bypassCache: true }).then((ok) => {
        if (!disposed) emit(ok);
      });
    }, OFFLINE_REPROBE_MS);
  }

  async function confirmOnline() {
    clearOfflineTimer();
    if (!probeOnChange) {
      emit(true);
      return;
    }
    const ok = await probeOnline(DEFAULT_PROBE_MS, { bypassCache: true });
    if (!disposed) emit(ok);
  }

  function onOnline() {
    void confirmOnline();
  }

  function onOffline() {
    clearOfflineTimer();
    offlineTimer = window.setTimeout(() => {
      offlineTimer = null;
      void probeOnline(DEFAULT_PROBE_MS, { bypassCache: true }).then((ok) => {
        if (!disposed) emit(ok);
      });
    }, debounceMs);
  }

  function onVisibility() {
    if (document.visibilityState !== "visible") return;
    void probeOnline(DEFAULT_PROBE_MS, { bypassCache: true }).then((ok) => {
      if (!disposed) emit(ok);
    });
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
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    disposed = true;
    clearOfflineTimer();
    clearReprobe();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

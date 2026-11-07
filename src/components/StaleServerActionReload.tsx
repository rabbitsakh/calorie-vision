"use client";

import { useEffect } from "react";
import {
  reloadOnceForStaleServerAction,
  STALE_ACTION_RELOAD_GUARD_MS,
  STALE_ACTION_RELOAD_KEY,
} from "@/lib/stale-server-action";

/**
 * Ловит ответ «действие не найдено» от старой вкладки и один раз обновляет страницу.
 * Повторный reload в ближайшие секунды не запускается.
 */
export function StaleServerActionReload() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (reloadOnceForStaleServerAction(event.error ?? event.message)) {
        event.preventDefault();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (reloadOnceForStaleServerAction(event.reason)) {
        event.preventDefault();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(STALE_ACTION_RELOAD_KEY);
      } catch {
        // ignore
      }
    }, STALE_ACTION_RELOAD_GUARD_MS);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CHEST_INBOX_EVENT,
  type ChestInboxPayload,
} from "@/lib/chest-inbox";

const TOAST_MS = 3200;
const HOST_ID = "cv-chest-inbox-toast-host";

function getHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-cv-chest-inbox-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "bottom:0",
    "width:100%",
    "margin:0",
    "padding:0",
    "border:none",
    "z-index:81",
    "pointer-events:none",
    "overflow:visible",
  ].join(";");
  document.documentElement.appendChild(host);
  return host;
}

/**
 * Soft inbox toast when a chest grants under quiet mode (R1a).
 * Does not check gamification quiet — that would hide the only feedback.
 */
export function ChestInboxToast() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ChestInboxPayload | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(getHost());
  }, []);

  useEffect(() => {
    function onInbox(event: Event) {
      const detail = (event as CustomEvent<ChestInboxPayload>).detail;
      if (!detail?.title) return;
      setPayload(detail);
      setToastKey((n) => n + 1);
      setOpen(true);
    }
    window.addEventListener(CHEST_INBOX_EVENT, onInbox);
    return () => window.removeEventListener(CHEST_INBOX_EVENT, onInbox);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [open, toastKey]);

  if (!open || !host || !payload) return null;

  return createPortal(
    <div
      key={toastKey}
      className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[81] w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-[var(--radius-lg)] border border-teal-200/80 bg-white px-4 py-3 text-center shadow-[0_8px_24px_rgba(15,23,42,0.1)]">
        <p className="text-sm font-semibold text-[var(--foreground)]">{payload.title}</p>
        {payload.subtitle ? (
          <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">{payload.subtitle}</p>
        ) : (
          <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">В коллекции · Профиль</p>
        )}
      </div>
    </div>,
    host,
  );
}

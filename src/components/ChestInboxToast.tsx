"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CHEST_INBOX_EVENT,
  chestInboxAction,
  type ChestInboxPayload,
} from "@/lib/chest-inbox";
import { persistEquippedFrameKey } from "@/lib/equipped-frame";
import { persistEquippedStickerKey } from "@/lib/equipped-sticker";
import { withBasePath } from "@/lib/paths";

const TOAST_MS = 5200;
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
 * Soft inbox toast when a chest grants under quiet mode (R1a / R2a–b).
 * Equip CTA for stickers/frames; otherwise link to collection.
 */
export function ChestInboxToast() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ChestInboxPayload | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [equipped, setEquipped] = useState(false);

  useEffect(() => {
    setHost(getHost());
  }, []);

  useEffect(() => {
    function onInbox(event: Event) {
      const detail = (event as CustomEvent<ChestInboxPayload>).detail;
      if (!detail?.title) return;
      setPayload(detail);
      setToastKey((n) => n + 1);
      setEquipped(false);
      setBusy(false);
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

  const action = chestInboxAction(payload.rewardKey);
  const collectionHref = withBasePath("/profile#rewards");

  async function onEquip() {
    if (!payload?.rewardKey || busy) return;
    setBusy(true);
    try {
      if (action === "equip-sticker") {
        await persistEquippedStickerKey(payload.rewardKey);
      } else if (action === "equip-frame") {
        await persistEquippedFrameKey(payload.rewardKey);
      }
      setEquipped(true);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      key={toastKey}
      className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[81] w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-[var(--radius-lg)] border border-teal-200/80 bg-white px-4 py-3 text-center shadow-[0_8px_24px_rgba(15,23,42,0.1)]">
        <p className="text-sm font-semibold text-[var(--foreground)]">{payload.title}</p>
        {payload.subtitle ? (
          <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">{payload.subtitle}</p>
        ) : (
          <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">В коллекции · Профиль</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          {action === "equip-sticker" || action === "equip-frame" ? (
            <button
              type="button"
              disabled={busy || equipped}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              onClick={() => void onEquip()}
            >
              {equipped ? "Надето" : action === "equip-frame" ? "Надеть рамку" : "Надеть"}
            </button>
          ) : null}
          <Link
            href={collectionHref}
            className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-900"
            onClick={() => setOpen(false)}
          >
            В коллекцию
          </Link>
        </div>
      </div>
    </div>,
    host,
  );
}

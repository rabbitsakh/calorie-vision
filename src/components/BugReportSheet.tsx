"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { withBasePath } from "@/lib/paths";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Profile → «Сообщить об ошибке»: описание + опциональный скрин → support@.
 */
export function BugReportSheet({ open, onClose }: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = useCallback(() => {
    setDescription("");
    setFile(null);
    setError(null);
    setSent(false);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      setSent(false);
    }
  }, [open]);

  const close = useCallback(() => {
    if (busy) return;
    onClose();
    // Keep fields briefly so reopen feels continuous; clear after close.
    window.setTimeout(reset, 200);
  }, [busy, onClose, reset]);

  async function onPick(list: FileList | null) {
    const next = list?.[0] ?? null;
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.type.startsWith("image/")) {
      setError("Нужен файл изображения (скриншот).");
      return;
    }
    setError(null);
    const compressed = await compressImageFileForUpload(next);
    setFile(compressed);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("description", description);
      body.set("pageUrl", typeof window !== "undefined" ? window.location.href : "");
      body.set("userAgent", typeof navigator !== "undefined" ? navigator.userAgent : "");
      body.set("appVersion", process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "unknown");
      if (file) body.set("screenshot", file, file.name || "screenshot.jpg");

      const resp = await fetch(withBasePath("/api/support/bug-report"), {
        method: "POST",
        body,
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error || "Не удалось отправить. Попробуйте ещё раз.");
        return;
      }
      setSent(true);
      setDescription("");
      setFile(null);
    } catch {
      setError("Нет сети или сервер не ответил. Напишите на support@calorievision.ru");
    } finally {
      setBusy(false);
    }
  }

  if (!open || !mounted || typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-[var(--accent-ink)]/45"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="flex max-h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--surface-panel)] px-3 pt-2 sm:px-4 sm:pt-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[var(--border-quiet)]" aria-hidden />
        <div className="flex items-start justify-between gap-3 pb-2">
          <div className="min-w-0">
            <p id={titleId} className="confirm-family-skim !mb-0.5">
              Сообщить об ошибке
            </p>
            <p className="text-xs text-[var(--muted)]">
              Описание и скрин уйдут на support@calorievision.ru
            </p>
          </div>
          <button
            type="button"
            className="confirm-family-secondary !min-h-8 shrink-0"
            disabled={busy}
            onClick={close}
          >
            Закрыть
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          {sent ? (
            <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-4 text-sm text-[var(--accent-ink)]">
              Спасибо — сообщение отправлено. Если нужно продолжение, ответим на почту аккаунта.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-[var(--ink)]">Что случилось?</span>
                <textarea
                  className="input min-h-[7.5rem] resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Например: после фото не открывается подтверждение, Android…"
                  maxLength={4000}
                  disabled={busy}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--ink)]">Скриншот (необязательно)</span>
                <p className="text-[11px] text-[var(--muted)]">
                  Выберите снимок из галереи (не камера) — например скрин экрана с ошибкой.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  disabled={busy}
                  onChange={(e) => void onPick(e.target.files)}
                  className="block w-full text-sm text-[var(--muted-strong)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--accent-ink)]"
                />
                {previewUrl ? (
                  <div className="relative mt-1 overflow-hidden rounded-xl border border-[var(--border-quiet)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Превью скриншота" className="max-h-48 w-full object-contain bg-[var(--surface-mist)]" />
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-md bg-[var(--surface-panel)]/95 px-2 py-1 text-xs font-semibold text-[var(--danger)]"
                      disabled={busy}
                      onClick={() => setFile(null)}
                    >
                      Убрать
                    </button>
                  </div>
                ) : null}
              </div>

              {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            </div>
          )}
        </div>

        <div className="shrink-0 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] sm:pt-3">
          {sent ? (
            <button type="button" className="confirm-family-cta w-full !min-h-11" onClick={close}>
              Готово
            </button>
          ) : (
            <button
              type="button"
              className="confirm-family-cta w-full !min-h-11"
              disabled={busy || description.trim().length < 10}
              onClick={() => void submit()}
            >
              {busy ? "Отправка…" : "Отправить"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.documentElement);
}

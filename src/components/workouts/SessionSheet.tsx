"use client";

import type { ReactNode } from "react";

export function SessionSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
          <button
            type="button"
            className="min-h-[44px] px-2 text-sm font-medium text-[var(--muted-strong)]"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

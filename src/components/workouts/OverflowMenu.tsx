"use client";

import { useEffect, useRef, useState } from "react";

export type OverflowMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type Props = {
  label: string;
  items: OverflowMenuItem[];
};

/** Absolute ⋯ menu — secondary actions must not push the exercise list. */
export function OverflowMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-lg font-semibold text-[var(--muted-strong)] hover:bg-[var(--surface-mist)]"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 flex max-h-[70vh] min-w-[14rem] flex-col overflow-auto rounded-xl border border-[var(--border-quiet)] bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`min-h-[44px] px-3 text-left text-sm font-medium disabled:opacity-40 ${
                item.danger ? "text-red-600" : "text-[var(--foreground)]"
              }`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

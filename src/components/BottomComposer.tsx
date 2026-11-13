"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { subscribeConnectivity } from "@/lib/connectivity";
import {
  requestOpenFoodAddPicker,
  requestOpenFoodCamera,
  requestOpenFoodText,
} from "@/lib/open-food-camera";
import { withDateQuery } from "@/lib/use-selected-date";

type Props = {
  date?: string;
  disabled?: boolean;
};

const ICON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/**
 * Hybrid H1/H2 — camera-first dock above the tabs (thumb zone on the right).
 * Sparkle → full AI chat; text → «проверь и запиши»; barcode / + / voice beside.
 */
export function BottomComposer({ date, disabled = false }: Props) {
  const [text, setText] = useState("");
  const [online, setOnline] = useState(true);
  const [sheetText, setSheetText] = useState<string | null>(null);

  useEffect(() => subscribeConnectivity(setOnline), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    if (!online) {
      // Parsing is online-only; the text sheet queues offline.
      requestOpenFoodText(value);
      setText("");
      return;
    }
    setText("");
    setSheetText(value);
  };

  const assistantHref = date ? withDateQuery("/assistant", date) : "/assistant";

  const closeSheet = useCallback(() => setSheetText(null), []);
  const hasText = text.trim().length > 0;

  return (
    <>
      <form
        className={`bottom-composer${disabled ? " bottom-composer--disabled" : ""}`}
        onSubmit={submit}
        role="search"
        aria-label="Записать еду"
      >
        <Link href={assistantHref} className="bottom-composer-ai" aria-label="AI‑ассистент" data-tour="assistant">
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" strokeLinejoin="round" />
            <path d="M18.5 13.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" strokeLinejoin="round" />
          </svg>
        </Link>
        <input
          className="bottom-composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={online ? "Что съел? Напиши…" : "Нет сети — откроем ввод текстом"}
          enterKeyHint="send"
          autoComplete="off"
          disabled={disabled}
          aria-label="Что съели — напишите, AI разберёт граммы"
        />
        {hasText ? (
          <button
            type="submit"
            className="bottom-composer-btn bottom-composer-btn--send"
            aria-label="Разобрать и записать"
            disabled={disabled}
          >
            <svg {...ICON} strokeWidth={2.4}>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="bottom-composer-btn"
              aria-label="Ещё: галерея, вода, вес, тренировка"
              aria-haspopup="dialog"
              disabled={disabled}
              onClick={() => requestOpenFoodAddPicker()}
            >
              <svg {...ICON} strokeWidth={2.4}>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              className="bottom-composer-btn bottom-composer-btn--camera"
              aria-label="Сфоткать еду"
              disabled={disabled}
              onClick={() => requestOpenFoodCamera()}
            >
              <svg {...ICON} width={22} height={22} strokeWidth={2.2}>
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </button>
          </>
        )}
      </form>
      {sheetText ? <QuickLogSheet text={sheetText} date={date} onClose={closeSheet} /> : null}
    </>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { subscribeConnectivity } from "@/lib/connectivity";
import {
  requestOpenFoodAddPicker,
  requestOpenFoodBarcode,
  requestOpenFoodCamera,
  requestOpenFoodText,
} from "@/lib/open-food-camera";
import { withDateQuery } from "@/lib/use-selected-date";
import {
  createRuSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from "@/lib/speech-recognition";

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
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [sheetText, setSheetText] = useState<string | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => subscribeConnectivity(setOnline), []);
  useEffect(() => setVoice(isSpeechRecognitionSupported()), []);
  useEffect(() => () => speechRef.current?.stop(), []);

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

  const toggleVoice = () => {
    if (listening) {
      speechRef.current?.stop();
      return;
    }
    const rec = createRuSpeechRecognition();
    if (!rec) {
      setVoice(false);
      return;
    }
    speechRef.current = rec;
    rec.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript?.trim();
      if (said) setText((prev) => (prev ? `${prev} ${said}` : said));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      speechRef.current = null;
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

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
        <Link href={assistantHref} className="bottom-composer-ai" aria-label="AI‑ассистент">
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" strokeLinejoin="round" />
            <path d="M18.5 13.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" strokeLinejoin="round" />
          </svg>
        </Link>
        <input
          className="bottom-composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            listening ? "Слушаю…" : online ? "Что съел? Напиши…" : "Нет сети — откроем ввод текстом"
          }
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
              aria-label="Штрихкод"
              disabled={disabled}
              onClick={() => requestOpenFoodBarcode()}
            >
              <svg {...ICON}>
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M14 8v8M17 8v8" />
              </svg>
            </button>
            {voice ? (
              <button
                type="button"
                className={`bottom-composer-btn${listening ? " bottom-composer-btn--live" : ""}`}
                aria-label={listening ? "Остановить диктовку" : "Сказать голосом"}
                aria-pressed={listening}
                disabled={disabled}
                onClick={toggleVoice}
              >
                <svg {...ICON}>
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
                </svg>
              </button>
            ) : null}
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

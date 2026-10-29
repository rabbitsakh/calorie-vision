"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { assistantHandoffHref } from "@/lib/assistant-handoff";
import { subscribeConnectivity } from "@/lib/connectivity";
import {
  requestOpenFoodAddPicker,
  requestOpenFoodCamera,
  requestOpenFoodText,
} from "@/lib/open-food-camera";

type Props = {
  date?: string;
  disabled?: boolean;
};

/** Hybrid H4 — one composer above the tabs instead of the AI | + split dock. */
export function BottomComposer({ date, disabled = false }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [online, setOnline] = useState(true);

  useEffect(() => subscribeConnectivity(setOnline), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    if (!online) {
      // AI is online-only; the text sheet queues offline.
      requestOpenFoodText();
      return;
    }
    setText("");
    router.push(assistantHandoffHref(value, date));
  };

  const hasText = text.trim().length > 0;

  return (
    <form
      className={`bottom-composer${disabled ? " bottom-composer--disabled" : ""}`}
      onSubmit={submit}
      role="search"
      aria-label="Записать еду"
    >
      <Link href="/assistant" className="bottom-composer-ai" aria-label="AI‑ассистент">
        <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" strokeLinejoin="round" />
          <path d="M18.5 13.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" strokeLinejoin="round" />
        </svg>
      </Link>
      <input
        className="bottom-composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={online ? "Что съели? «2 яйца и кофе»" : "Нет сети — откроем ввод текстом"}
        enterKeyHint="send"
        autoComplete="off"
        disabled={disabled}
        aria-label="Что съели — напишите, AI запишет"
      />
      {hasText ? (
        <button type="submit" className="bottom-composer-btn bottom-composer-btn--send" aria-label="Отправить" disabled={disabled}>
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <>
          <button
            type="button"
            className="bottom-composer-btn"
            aria-label="Фото еды"
            disabled={disabled}
            onClick={() => requestOpenFoodCamera()}
          >
            <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          <button
            type="button"
            className="bottom-composer-btn bottom-composer-btn--plus"
            aria-label="Добавить: штрихкод, галерея, вода, вес или тренировка"
            aria-haspopup="dialog"
            disabled={disabled}
            onClick={() => requestOpenFoodAddPicker()}
          >
            <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { formatCalorieEstimate } from "@/lib/calorie-estimate-range";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { withBasePath } from "@/lib/paths";

const GUEST_USED_KEY = "cv-guest-recognize-used";
const GUEST_LIMIT = 2;

type GuestResult = {
  imagePath?: string;
  recognition: FoodRecognitionResult;
};

function readUsed(): number {
  try {
    const n = Number(localStorage.getItem(GUEST_USED_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function bumpUsed(): number {
  const next = readUsed() + 1;
  try {
    localStorage.setItem(GUEST_USED_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

function flatten(recognition: FoodRecognitionResult): FoodRecognitionResult[] {
  if (Array.isArray(recognition.items) && recognition.items.length > 0) {
    return recognition.items;
  }
  return [recognition];
}

/**
 * Public trial: 1–2 photos without an account. Save requires login.
 */
export function GuestTryClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuestResult | null>(null);

  useEffect(() => {
    setUsed(readUsed());
  }, []);

  const remaining = Math.max(0, GUEST_LIMIT - used);
  const blocked = remaining <= 0;

  const onFile = useCallback(async (file: File | null) => {
    if (!file || blocked) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const resp = await fetch(withBasePath("/api/recognize/guest"), {
        method: "POST",
        body: form,
      });
      const payload = (await resp.json()) as {
        error?: string;
        imagePath?: string;
        recognition?: FoodRecognitionResult;
      };
      if (!resp.ok || !payload.recognition) {
        setError(payload.error ?? "Не удалось распознать фото");
        return;
      }
      setUsed(bumpUsed());
      setResult({ imagePath: payload.imagePath, recognition: payload.recognition });
    } catch {
      setError("Нет сети или сервер недоступен");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [blocked]);

  const dishes = result ? flatten(result.recognition) : [];

  return (
    <main className="guest-try">
      <header className="guest-try-top">
        <Link href="/" className="guest-try-brand" aria-label="Calorie Vision">
          <BrandMark size={40} decorative={false} />
          <span>Calorie Vision</span>
        </Link>
        <Link href="/login" className="btn btn-primary text-sm">
          Войти
        </Link>
      </header>

      <section className="guest-try-hero">
        <p className="guest-try-kicker">Без регистрации</p>
        <h1 className="guest-try-title">Фото → КБЖУ</h1>
        <p className="guest-try-lead">
          {GUEST_LIMIT} фото бесплатно. Сохранить в дневник — после входа.
        </p>
        <p className="guest-try-remain" aria-live="polite">
          Осталось: {remaining} из {GUEST_LIMIT}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy || blocked}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          className="btn btn-primary guest-try-camera"
          disabled={busy || blocked}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Распознаём…" : blocked ? "Лимит на сегодня" : "Сфотографировать"}
        </button>

        {blocked ? (
          <p className="guest-try-hint">
            Лимит исчерпан.{" "}
            <Link href="/login" className="font-semibold text-[var(--accent)]">
              Войдите
            </Link>
            , чтобы распознавать дальше и вести дневник.
          </p>
        ) : (
          <p className="guest-try-hint">Тарелка, упаковка или этикетка — лучше при хорошем свете.</p>
        )}

        {error ? (
          <p className="guest-try-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {dishes.length > 0 ? (
        <section className="guest-try-result" aria-label="Результат">
          <h2 className="guest-try-result-title">Результат</h2>
          <ul className="guest-try-list">
            {dishes.map((dish, i) => (
              <li key={`${dish.dishName}-${i}`} className="guest-try-card">
                <p className="guest-try-dish">{decodeHtmlEntities(dish.dishName)}</p>
                <p className="guest-try-kcal">
                  {formatCalorieEstimate(dish.calories, dish.confidence)}
                  {dish.portionGrams ? ` · ${Math.round(dish.portionGrams)} г` : ""}
                </p>
                {dish.confidence < 0.65 && dish.alternatives?.length ? (
                  <p className="guest-try-alts">
                    Варианты:{" "}
                    {dish.alternatives
                      .slice(0, 3)
                      .map((a) => decodeHtmlEntities(a.dishName))
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <Link href="/login" className="btn btn-primary guest-try-save">
            Войти и сохранить в дневник
          </Link>
        </section>
      ) : null}
    </main>
  );
}

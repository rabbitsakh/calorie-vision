"use client";

import { useRef, useState } from "react";
import type { RecognitionResponse } from "@/types";
import { withBasePath } from "@/lib/paths";

type PhotoUploaderProps = {
  onRecognized: (result: RecognitionResponse) => void;
  disabled?: boolean;
  compact?: boolean;
};

function ThinkingAnimation() {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Pulsing brain / eye icon */}
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-teal-400/30" />
        <div className="absolute inset-1 animate-pulse rounded-full bg-teal-100" />
        <svg className="relative h-7 w-7 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          <circle cx="11" cy="11" r="2.5" fill="currentColor" stroke="none" opacity="0.5">
            <animate attributeName="r" values="2.5;1.5;2.5" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      {/* Animated dots */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-teal-900">Анализирую фото</span>
        <div className="flex items-center gap-1">
          {[0, 0.2, 0.4].map((delay, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-teal-500"
              style={{ animation: `thinkingDot 1.2s ${delay}s ease-in-out infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PhotoUploader({ onRecognized, disabled, compact }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(withBasePath("/api/recognize"), {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Ошибка распознавания");
      }

      onRecognized(data as RecognitionResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить фото");
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  const content = (
    <div className="flex flex-col gap-4">
      {!compact ? (
        <div>
          <h2 className="text-xl font-bold">Добавить приём пищи</h2>
          <p className="mt-1 text-sm text-slate-500">
            Сфотографируйте блюдо, заводскую упаковку, этикетку с КБЖУ или штрихкод.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-36 items-center justify-center rounded-2xl border-2 border-teal-200 bg-teal-50/60 px-4 py-8 md:min-h-44">
          <ThinkingAnimation />
        </div>
      ) : (
        <label
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition md:min-h-44 md:py-8 ${
            disabled
              ? "border-slate-200 bg-slate-50 opacity-70"
              : "border-teal-300 bg-teal-50/60 hover:border-teal-500"
          }`}
        >
          <span className="text-3xl md:text-4xl">📷</span>
          <span className="mt-3 text-sm font-semibold text-teal-900 md:text-base">
            Нажмите или перетащите фото
          </span>
          <span className="mt-1 text-xs text-slate-500 md:text-sm">
            Блюдо, упаковка, этикетка или штрихкод · JPG, PNG, WEBP
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={handleFileChange}
          />
        </label>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <section className="card p-6">
      {content}
    </section>
  );
}

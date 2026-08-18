"use client";

import { useRef, useState } from "react";
import type { RecognitionResponse } from "@/types";
import { withBasePath } from "@/lib/paths";

type PhotoUploaderProps = {
  onRecognized: (result: RecognitionResponse) => void;
  disabled?: boolean;
  compact?: boolean;
};

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

      <label
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition md:min-h-44 md:py-8 ${
          disabled || loading
            ? "border-slate-200 bg-slate-50 opacity-70"
            : "border-teal-300 bg-teal-50/60 hover:border-teal-500"
        }`}
      >
        <span className="text-3xl md:text-4xl">📷</span>
        <span className="mt-3 text-sm font-semibold text-teal-900 md:text-base">
          {loading ? "Распознаём..." : "Нажмите или перетащите фото"}
        </span>
        <span className="mt-1 text-xs text-slate-500 md:text-sm">
          Блюдо, упаковка, этикетка или штрихкод · JPG, PNG, WEBP
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || loading}
          onChange={handleFileChange}
        />
      </label>

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

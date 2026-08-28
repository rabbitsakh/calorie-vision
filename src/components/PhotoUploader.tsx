"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { RecognitionResponse } from "@/types";
import { enqueuePendingRecognition } from "@/lib/meal-draft-queue";
import {
  describeRecognizeError,
  isNetworkFetchError,
  recognizePhotoFile,
} from "@/lib/recognize-photo-client";

const MAX_FILE_SIZE_MB = 15;

const RECOGNITION_STAGES = [
  "Загружаем фото…",
  "Анализируем изображение…",
  "Подбираем блюда и порции…",
  "Ищем в базе продуктов…",
] as const;

type PhotoUploaderProps = {
  selectedDate: string;
  onRecognized: (result: RecognitionResponse) => void;
  onOfflineQueued?: () => void;
  disabled?: boolean;
  compact?: boolean;
  /** When true, pass context=restaurant to recognize APIs. */
  restaurantMode?: boolean;
};

export type PhotoUploaderHandle = {
  abort: () => void;
  /** Programmatically open the device camera picker. */
  openCamera: () => void;
};

function ThinkingAnimation({ preview, stage }: { preview: string | null; stage: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Фото для анализа"
            className="h-24 w-24 rounded-xl object-cover opacity-70"
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-teal-900/30">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        </div>
      ) : (
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-teal-400/30" />
          <div className="absolute inset-1 animate-pulse rounded-full bg-teal-100" />
          <svg className="relative h-7 w-7 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-teal-900">{stage}</span>
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

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  return /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name);
}

export const PhotoUploader = forwardRef<PhotoUploaderHandle, PhotoUploaderProps>(function PhotoUploader(
  { selectedDate, onRecognized, onOfflineQueued, disabled, compact, restaurantMode },
  ref,
) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>(RECOGNITION_STAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [offlineQueued, setOfflineQueued] = useState(false);

  useImperativeHandle(ref, () => ({
    abort: () => {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      setPreview(null);
    },
    openCamera: () => {
      cameraInputRef.current?.click();
    },
  }));

  useEffect(() => {
    if (!loading) {
      setStage(RECOGNITION_STAGES[0]);
      return;
    }

    let index = 0;
    setStage(RECOGNITION_STAGES[index]!);
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, RECOGNITION_STAGES.length - 1);
      setStage(RECOGNITION_STAGES[index]!);
    }, 2800);

    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function queueOfflinePhoto(file: File, barcode?: string) {
    try {
      await enqueuePendingRecognition(selectedDate, file, { restaurantMode, barcode });
      setOfflineQueued(true);
      setError(null);
      onOfflineQueued?.();
    } catch {
      setError("Не удалось сохранить фото на устройстве. Проверьте место в памяти.");
    }
  }

  async function processFile(file: File) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Файл слишком большой (>${MAX_FILE_SIZE_MB} МБ). Выберите другое фото.`);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOfflinePhoto(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);
    setStage(RECOGNITION_STAGES[0]);
    setError(null);
    setOfflineQueued(false);

    const controller = new AbortController();
    abortRef.current = controller;
    let handedOffPreview = false;

    try {
      const data = await recognizePhotoFile(file, {
        restaurantMode,
        signal: controller.signal,
        onVision: (snapshot) => {
          if (controller.signal.aborted) {
            return;
          }
          handedOffPreview = true;
          onRecognized({
            ...snapshot,
            previewUrl: objectUrl,
          });
        },
      });

      if (controller.signal.aborted) {
        return;
      }

      handedOffPreview = true;
      onRecognized({
        ...data,
        previewUrl: objectUrl,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (isNetworkFetchError(err)) {
        await queueOfflinePhoto(file);
        return;
      }
      setError(describeRecognizeError(err, "Не удалось загрузить фото"));
    } finally {
      if (!handedOffPreview) {
        URL.revokeObjectURL(objectUrl);
      }
      setPreview(null);
      setLoading(false);
      abortRef.current = null;
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled && !loading) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || loading) return;
    const file = e.dataTransfer.files?.[0];
    if (file && isLikelyImageFile(file)) void processFile(file);
  }

  function handleCancel() {
    abortRef.current?.abort();
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
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-teal-200 bg-teal-50/60 px-4 py-6 md:min-h-44">
          <ThinkingAnimation preview={preview} stage={stage} />
          <button type="button" className="btn-quiet mt-1" onClick={handleCancel}>
            Отменить
          </button>
        </div>
      ) : (
        <div
          className={`flex min-h-36 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition md:min-h-44 md:py-8 ${
            disabled
              ? "border-slate-200 bg-slate-50 opacity-70"
              : dragOver
                ? "border-teal-500 bg-teal-100/60 scale-[1.01]"
                : "border-teal-300 bg-teal-50/60"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div>
            <p className="text-sm font-semibold text-teal-900 md:text-base">
              {dragOver ? "Отпустите для загрузки" : "Добавить фото еды"}
            </p>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Блюдо, упаковка, этикетка или штрихкод · JPG, PNG, WEBP, HEIC · до {MAX_FILE_SIZE_MB}{" "}
              МБ
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="btn btn-on-tint text-teal-800"
              disabled={disabled}
              onClick={() => cameraInputRef.current?.click()}
            >
              Снять на камеру
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={() => galleryInputRef.current?.click()}
            >
              Выбрать из галереи
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            className="hidden"
            disabled={disabled}
            onChange={handleFileChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            disabled={disabled}
            onChange={handleFileChange}
          />
        </div>
      )}

      {offlineQueued ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Нет сети — фото сохранено в офлайн-очередь. Распознаем и покажем карточку, когда интернет вернётся.
        </p>
      ) : null}

      {error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
            disabled={disabled || loading}
            onClick={() => {
              setError(null);
              cameraInputRef.current?.click();
            }}
          >
            Ещё раз
          </button>
        </div>
      ) : null}
    </div>
  );

  if (compact) return content;

  return <section className="card p-6">{content}</section>;
});

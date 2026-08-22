"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { RecognitionResponse } from "@/types";
import { decodeBarcodeFromImageFile } from "@/lib/decode-barcode-client";
import { humanizeClientFetchError, readApiJson } from "@/lib/read-api-json";
import { withBasePath } from "@/lib/paths";
import type { FoodRecognitionResult } from "@/lib/food-types";

const MAX_FILE_SIZE_MB = 15;

type PhotoUploaderProps = {
  onRecognized: (result: RecognitionResponse) => void;
  disabled?: boolean;
  compact?: boolean;
};

export type PhotoUploaderHandle = {
  abort: () => void;
};

function ThinkingAnimation({ preview }: { preview: string | null }) {
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
        <span className="text-sm font-semibold text-teal-900">Анализируем фото…</span>
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
  // Some OS/HEIC pickers leave type empty — still accept by extension.
  return /\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name);
}

export const PhotoUploader = forwardRef<PhotoUploaderHandle, PhotoUploaderProps>(function PhotoUploader(
  { onRecognized, disabled, compact },
  ref,
) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useImperativeHandle(ref, () => ({
    abort: () => {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      setPreview(null);
    },
  }));

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function processFile(file: File) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Файл слишком большой (>${MAX_FILE_SIZE_MB} МБ). Выберите другое фото.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let handedOffPreview = false;

    try {
      // Same ZXing + BarcodeDetector path as the barcode tab.
      const localBarcode = await decodeBarcodeFromImageFile(file);
      if (localBarcode && !controller.signal.aborted) {
        const lookupResponse = await fetch(withBasePath("/api/food/lookup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode: localBarcode }),
          signal: controller.signal,
        });
        const lookupData = await readApiJson<{
          recognition?: FoodRecognitionResult;
          imagePath?: string;
          error?: string;
        }>(lookupResponse);
        if (lookupResponse.ok && lookupData.recognition) {
          handedOffPreview = true;
          onRecognized({
            imagePath: lookupData.imagePath ?? "",
            previewUrl: objectUrl,
            recognition: lookupData.recognition,
          });
          return;
        }
        // OFF miss: fall through to vision instead of hard-failing on a readable EAN.
      }

      if (controller.signal.aborted) {
        return;
      }

      const formData = new FormData();
      const uploadName =
        file.name?.trim() ||
        (file.type.includes("heic") || file.type.includes("heif") || /\.hei[cf]$/i.test(file.name)
          ? "photo.heic"
          : "photo.jpg");
      formData.append("photo", file, uploadName);
      if (localBarcode) {
        formData.append("barcode", localBarcode);
      }

      const response = await fetch(withBasePath("/api/recognize"), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await readApiJson<RecognitionResponse & { error?: string }>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Ошибка распознавания");
      }

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
      setError(humanizeClientFetchError(err, "Не удалось загрузить фото"));
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
          <ThinkingAnimation preview={preview} />
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );

  if (compact) return content;

  return <section className="card p-6">{content}</section>;
});

"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { PhotoUploader, type PhotoUploaderHandle } from "@/components/PhotoUploader";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { humanizeClientFetchError, readApiJson } from "@/lib/read-api-json";
import { withBasePath } from "@/lib/paths";
import type { RecognitionResponse } from "@/types";

type AddMode = "photo" | "text" | "barcode";

type FoodAddPanelProps = {
  selectedDate: string;
  disabled?: boolean;
  onSaved: () => void;
  onPendingChange?: (open: boolean) => void;
};

function toRecognitionResponse(
  recognition: FoodRecognitionResult,
  imagePath?: string,
): RecognitionResponse {
  return {
    imagePath: imagePath ?? "",
    recognition,
  };
}

export function FoodAddPanel({ selectedDate, disabled, onSaved, onPendingChange }: FoodAddPanelProps) {
  const [mode, setMode] = useState<AddMode>("photo");
  const [pendingResult, setPendingResult] = useState<RecognitionResponse | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<PhotoUploaderHandle>(null);

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!savedToast) {
      return;
    }
    const timer = window.setTimeout(() => setSavedToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [savedToast]);

  useEffect(() => {
    onPendingChange?.(pendingResult != null);
  }, [pendingResult, onPendingChange]);

  useEffect(() => {
    return () => {
      onPendingChange?.(false);
    };
  }, [onPendingChange]);

  async function lookupFood(payload: { dishName?: string; barcode?: string }) {
    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/food/lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await readApiJson<{
        recognition?: FoodRecognitionResult;
        imagePath?: string;
        error?: string;
      }>(response);

      if (!response.ok || !data.recognition) {
        throw new Error(data.error ?? "Не удалось найти продукт");
      }

      if (controller.signal.aborted) {
        return;
      }

      setPendingResult(toRecognitionResponse(data.recognition, data.imagePath));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(humanizeClientFetchError(err, "Ошибка поиска"));
    } finally {
      if (lookupAbortRef.current === controller) {
        lookupAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  if (pendingResult) {
    return (
      <ConfirmationCard
        result={pendingResult}
        selectedDate={selectedDate}
        onCancel={() => {
          photoAbortRef.current?.abort();
          lookupAbortRef.current?.abort();
          setPendingResult(null);
        }}
        onSaved={(meta) => {
          setPendingResult(null);
          setTextQuery("");
          setBarcodeQuery("");
          setError(null);
          if (meta?.rememberedCorrection) {
            setSavedToast("Запомнили исправление — в следующий раз подставим автоматически");
          }
          onSaved();
        }}
      />
    );
  }

  const tabs: Array<{ id: AddMode; label: string }> = [
    { id: "photo", label: "Фото" },
    { id: "text", label: "Текст" },
    { id: "barcode", label: "Штрихкод" },
  ];

  return (
    <section id="food-add-panel" className="card p-4 md:p-6 scroll-mt-4">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold md:text-xl">Добавить еду</h2>
            <p className="mt-1 text-sm text-slate-500">
            Сфотографируйте блюдо — или найдите по названию и штрихкоду.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={disabled || loading}
              className={`chip min-h-10 w-full justify-center ${
                mode === tab.id ? "chip-active" : ""
              }`}
              onClick={() => {
                lookupAbortRef.current?.abort();
                photoAbortRef.current?.abort();
                setMode(tab.id);
                setError(null);
                setTextQuery("");
                setBarcodeQuery("");
                setLoading(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "photo" ? (
          <PhotoUploader
            ref={photoAbortRef}
            disabled={disabled}
            compact
            onRecognized={(result) => setPendingResult(result)}
          />
        ) : null}

        {mode === "text" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void lookupFood({ dishName: textQuery });
            }}
          >
            <div className="field">
              <label htmlFor="food-text">Название блюда или продукта</label>
              <input
                id="food-text"
                value={textQuery}
                placeholder="Например: греческий йогурт 2%"
                disabled={disabled || loading}
                onChange={(event) => setTextQuery(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary inline-flex items-center gap-2" disabled={disabled || loading}>
              {loading ? <><span className="daisy-loading daisy-loading-sm" aria-hidden><span /><span /><span /></span> Ищем...</> : "Найти калорийность"}
            </button>
          </form>
        ) : null}

        {mode === "barcode" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void lookupFood({ barcode: barcodeQuery });
            }}
          >
            <BarcodeScanner
              disabled={disabled || loading}
              onDetected={(code) => {
                setBarcodeQuery(code);
                void lookupFood({ barcode: code });
              }}
            />
            <div className="field">
              <label htmlFor="food-barcode">Или введите штрихкод EAN</label>
              <input
                id="food-barcode"
                inputMode="numeric"
                pattern="[0-9]*"
                value={barcodeQuery}
                placeholder="4601234567890"
                disabled={disabled || loading}
                onChange={(event) => setBarcodeQuery(event.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary inline-flex items-center gap-2" disabled={disabled || loading}>
              {loading ? <><span className="daisy-loading daisy-loading-sm" aria-hidden><span /><span /><span /></span> Ищем...</> : "Найти по штрихкоду"}
            </button>
          </form>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {savedToast ? (
          <p className="rounded-xl bg-slate-800 px-4 py-3 text-sm text-white shadow-lg">{savedToast}</p>
        ) : null}
      </div>
    </section>
  );
}

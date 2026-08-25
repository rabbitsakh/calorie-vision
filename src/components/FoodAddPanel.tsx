"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { PhotoUploader, type PhotoUploaderHandle } from "@/components/PhotoUploader";
import type { FoodRecognitionResult } from "@/lib/food-types";
import {
  clearPendingConfirmDraft,
  countFailedSaves,
  getPendingConfirmDraft,
  listFailedSaves,
  removeMealDraft,
  upsertPendingConfirmDraft,
} from "@/lib/meal-draft-queue";
import { humanizeClientFetchError, readApiJson } from "@/lib/read-api-json";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { withBasePath } from "@/lib/paths";
import {
  createRuSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from "@/lib/speech-recognition";
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

function MicIcon({ listening }: { listening?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-5 w-5 ${listening ? "text-red-600" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

export function FoodAddPanel({ selectedDate, disabled, onSaved, onPendingChange }: FoodAddPanelProps) {
  const [mode, setMode] = useState<AddMode>("photo");
  const [pendingResult, setPendingResult] = useState<RecognitionResponse | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [draftBanner, setDraftBanner] = useState<RecognitionResponse | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [textQuery, setTextQuery] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restaurantMode, setRestaurantMode] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<PhotoUploaderHandle>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);

  const refreshQueueCount = useCallback(() => {
    setQueuedCount(countFailedSaves());
  }, []);

  const openPending = useCallback((result: RecognitionResponse) => {
    setPendingResult(result);
    setDraftBanner(null);
    upsertPendingConfirmDraft(selectedDate, result);
  }, [selectedDate]);

  const flushFailedSaves = useCallback(async () => {
    const failed = listFailedSaves();
    if (failed.length === 0) return;
    setFlushing(true);
    let savedAny = false;
    try {
      for (const item of failed) {
        try {
          const response = await fetch(withBasePath("/api/meals"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
          });
          if (!response.ok) continue;
          removeMealDraft(item.id);
          savedAny = true;
        } catch {
          // stay queued
        }
      }
    } finally {
      setFlushing(false);
      refreshQueueCount();
      if (savedAny) {
        setSavedToast("Офлайн-черновики отправлены");
        emitMascotReaction("save");
        onSaved();
      }
    }
  }, [onSaved, refreshQueueCount]);

  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported());
    return () => {
      lookupAbortRef.current?.abort();
      speechRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!savedToast) return;
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

  useEffect(() => {
    refreshQueueCount();
    const draft = getPendingConfirmDraft(selectedDate);
    if (draft && !pendingResult) {
      setDraftBanner(draft.result);
    } else {
      setDraftBanner(null);
    }
    void flushFailedSaves();
    // hydrate on date change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    function onOnline() {
      void flushFailedSaves();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushFailedSaves]);

  useEffect(() => {
    if (!pendingResult) return;
    upsertPendingConfirmDraft(selectedDate, pendingResult);
  }, [pendingResult, selectedDate]);

  function stopVoice() {
    speechRef.current?.stop();
    speechRef.current = null;
    setListening(false);
  }

  function startVoice() {
    if (disabled || loading || listening) {
      stopVoice();
      return;
    }

    const recognition = createRuSpeechRecognition();
    if (!recognition) {
      setError("Голосовой ввод не поддерживается в этом браузере — введите название вручную");
      return;
    }

    speechRef.current = recognition;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setTextQuery(transcript);
      }
    };
    recognition.onerror = () => {
      setError("Не удалось распознать речь — попробуйте ещё раз или введите название");
      setListening(false);
      speechRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      speechRef.current = null;
    };

    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError("Не удалось запустить микрофон");
      setListening(false);
      speechRef.current = null;
    }
  }

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

      openPending(toRecognitionResponse(data.recognition, data.imagePath));
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
          clearPendingConfirmDraft(selectedDate);
          setPendingResult(null);
        }}
        onSaveQueued={() => {
          clearPendingConfirmDraft(selectedDate);
          setPendingResult(null);
          refreshQueueCount();
          setSavedToast("Сохранение в очереди — отправим при появлении сети");
        }}
        onSaved={(meta) => {
          clearPendingConfirmDraft(selectedDate);
          setPendingResult(null);
          setTextQuery("");
          setBarcodeQuery("");
          setError(null);
          if (meta?.rememberedCorrection) {
            setSavedToast("Запомнили исправление — в следующий раз подставим автоматически");
          }
          emitMascotReaction("save");
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

        {draftBanner ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p className="font-medium">Есть незавершённый черновик</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Сохранили на устройстве — можно продолжить проверку и сохранить.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-on-tint text-sm text-amber-900"
                onClick={() => openPending(draftBanner)}
              >
                Продолжить
              </button>
              <button
                type="button"
                className="btn-quiet text-sm text-amber-800"
                onClick={() => {
                  clearPendingConfirmDraft(selectedDate);
                  setDraftBanner(null);
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}

        {queuedCount > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <p>
              В очереди офлайн: {queuedCount}{" "}
              {queuedCount === 1 ? "запись" : "записей"}
              {flushing ? " — отправляем…" : ""}
            </p>
            <button
              type="button"
              className="btn-quiet mt-1 text-sm text-teal-800"
              disabled={flushing}
              onClick={() => void flushFailedSaves()}
            >
              Отправить сейчас
            </button>
          </div>
        ) : null}

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
                stopVoice();
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

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            checked={restaurantMode}
            disabled={disabled || loading}
            onChange={(event) => setRestaurantMode(event.target.checked)}
          />
          <span>Режим столовой / ресторана</span>
        </label>
        {restaurantMode ? (
          <p className="text-xs text-slate-500">
            Подсказка для распознавания: типичные порции общепита и несколько блюд на подносе.
          </p>
        ) : null}

        {mode === "photo" ? (
          <PhotoUploader
            ref={photoAbortRef}
            disabled={disabled}
            compact
            restaurantMode={restaurantMode}
            onRecognized={(result) => openPending(result)}
          />
        ) : null}

        {mode === "text" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              stopVoice();
              void lookupFood({ dishName: textQuery });
            }}
          >
            <div className="field">
              <label htmlFor="food-text">Название блюда или продукта</label>
              <div className="input-with-action">
                <input
                  id="food-text"
                  value={textQuery}
                  placeholder="Например: греческий йогурт 2%"
                  disabled={disabled || loading}
                  onChange={(event) => setTextQuery(event.target.value)}
                  required
                />
                {voiceSupported ? (
                  <button
                    type="button"
                    className="btn-icon"
                    title={listening ? "Остановить диктовку" : "Сказать название"}
                    aria-label={listening ? "Остановить диктовку" : "Сказать название"}
                    aria-pressed={listening}
                    disabled={disabled || loading}
                    onClick={() => (listening ? stopVoice() : startVoice())}
                  >
                    <MicIcon listening={listening} />
                  </button>
                ) : null}
              </div>
              {listening ? (
                <p className="text-xs text-teal-800">Слушаю… скажите название блюда</p>
              ) : voiceSupported ? (
                <p className="text-xs text-slate-500">Можно надиктовать название голосом</p>
              ) : null}
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

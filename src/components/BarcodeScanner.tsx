"use client";

import { useEffect, useRef, useState } from "react";
import {
  captureVideoFrame,
  decodeBarcodeFromCanvas,
  decodeBarcodeFromImageFile,
} from "@/lib/decode-barcode-client";
import { openNativeBarcodeSettings, scanNativeBarcode } from "@/lib/native-barcode-scan";
import { playScannerBeep } from "@/lib/scanner-beep";

type BarcodeScannerProps = {
  disabled?: boolean;
  onDetected: (code: string) => void;
  /** When scan/decode fails — jump to manual name entry. */
  onManualFallback?: () => void;
  /** When scan/decode fails — jump to label photo recognition. */
  onLabelFallback?: () => void;
};

export function BarcodeScanner({ disabled, onDetected, onManualFallback, onLabelFallback }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastDecodeAtRef = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canOpenSettings, setCanOpenSettings] = useState(false);

  useEffect(() => {
    return () => {
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopScanning() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    busyRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }

  async function startScanning() {
    setError(null);
    setCanOpenSettings(false);
    setBusy(true);
    try {
      const native = await scanNativeBarcode();
      if (native.status === "code") {
        playScannerBeep();
        onDetected(native.barcode);
        return;
      }
      if (native.status === "cancelled") return;
      if (native.status === "denied") {
        setError(
          "Нет доступа к камере. Разрешите камеру в настройках приложения или введите код вручную.",
        );
        setCanOpenSettings(true);
        return;
      }
      if (native.status === "error") {
        setError(`${native.message} Можно сканировать камерой браузера или ввести код.`);
      }
      await startWebScanning();
    } finally {
      setBusy(false);
    }
  }

  async function startWebScanning() {
    setError(null);
    setCanOpenSettings(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Камера недоступна в этом браузере — загрузите снимок штрихкода или введите код вручную.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      const tick = async () => {
        if (!videoRef.current) return;
        const now = Date.now();
        // Throttle decode attempts — full native+ZXing every rAF burns mobile CPU.
        if (!busyRef.current && now - lastDecodeAtRef.current >= 280) {
          lastDecodeAtRef.current = now;
          const frame = captureVideoFrame(videoRef.current);
          if (frame) {
            busyRef.current = true;
            try {
              const code = await decodeBarcodeFromCanvas(frame);
              if (code) {
                playScannerBeep();
                onDetected(code);
                stopScanning();
                return;
              }
            } catch {
              // keep scanning
            } finally {
              busyRef.current = false;
            }
          }
        }
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };
      rafRef.current = requestAnimationFrame(() => {
        void tick();
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Нет доступа к камере. Разрешите камеру в настройках браузера или введите код вручную.");
        setCanOpenSettings(false);
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("Камера не найдена. Загрузите снимок штрихкода или введите цифры вручную.");
      } else {
        setError("Не удалось открыть камеру. Загрузите снимок или введите код вручную.");
      }
      stopScanning();
    }
  }

  async function handleFile(file: File) {
    setError(null);
    const code = await decodeBarcodeFromImageFile(file);
    if (code) {
      playScannerBeep();
      onDetected(code);
      return;
    }
    setError("Не удалось прочитать штрихкод на снимке. Наведите камеру ближе или введите цифры вручную.");
  }

  return (
    <div className="barcode-scanner flex flex-col gap-2">
      <p className="text-xs text-[var(--muted-strong)]">
        Сканер читает штрихкод на устройстве и сразу получает цифры — фото в GigaChat не отправляется.
      </p>
      <div
        className={`barcode-scanner__stage overflow-hidden ${
          scanning ? "barcode-scanner__stage--live" : "barcode-scanner__stage--idle"
        }`}
      >
        <video
          ref={videoRef}
          className={`w-full object-cover ${scanning ? "h-48" : "h-0"}`}
          muted
          playsInline
        />
        {!scanning ? (
          <div className="barcode-scanner__idle flex h-32 flex-col items-center justify-center gap-2 px-5 text-center">
            <span className="barcode-scanner__frame" aria-hidden />
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Наведите камеру на штрихкод на упаковке
            </p>
            <p className="text-xs text-[var(--muted-strong)]">
              Или загрузите снимок / введите цифры ниже
            </p>
          </div>
        ) : (
          <p className="barcode-scanner__live-hint px-3 py-2 text-center text-xs font-semibold">
            Держите штрихкод в кадре…
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!scanning ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={disabled || busy}
            onClick={() => void startScanning()}
          >
            {busy ? "Открываем сканер…" : "Сканировать камерой"}
          </button>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={stopScanning}>
            Остановить сканер
          </button>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          disabled={disabled || scanning}
          onClick={() => fileRef.current?.click()}
        >
          Снимок штрихкода
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>
      {error ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-600">{error}</p>
          {canOpenSettings ? (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => void openNativeBarcodeSettings()}
            >
              Открыть настройки камеры
            </button>
          ) : null}
          {onManualFallback || onLabelFallback ? (
            <div className="flex flex-wrap gap-2">
              {onManualFallback ? (
                <button type="button" className="btn btn-secondary text-sm" onClick={onManualFallback}>
                  Ввести вручную
                </button>
              ) : null}
              {onLabelFallback ? (
                <button type="button" className="btn btn-secondary text-sm" onClick={onLabelFallback}>
                  Сфотографировать этикетку
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

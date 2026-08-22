"use client";

import { useEffect, useRef, useState } from "react";
import {
  captureVideoFrame,
  decodeBarcodeFromCanvas,
  decodeBarcodeFromImageFile,
} from "@/lib/decode-barcode-client";

type BarcodeScannerProps = {
  disabled?: boolean;
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ disabled, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!busyRef.current) {
          const frame = captureVideoFrame(videoRef.current);
          if (frame) {
            busyRef.current = true;
            try {
              const code = await decodeBarcodeFromCanvas(frame);
              if (code) {
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
    } catch {
      setError("Не удалось открыть камеру. Разрешите доступ, загрузите снимок или введите код вручную.");
      stopScanning();
    }
  }

  async function handleFile(file: File) {
    setError(null);
    const code = await decodeBarcodeFromImageFile(file);
    if (code) {
      onDetected(code);
      return;
    }
    setError("Не удалось прочитать штрихкод на снимке. Наведите камеру ближе или введите цифры вручную.");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        Сканер читает штрихкод на устройстве и сразу получает цифры — фото в GigaChat не отправляется.
      </p>
      <div className="overflow-hidden rounded-2xl bg-slate-900">
        <video
          ref={videoRef}
          className={`w-full object-cover ${scanning ? "h-48" : "h-0"}`}
          muted
          playsInline
        />
        {!scanning ? (
          <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-slate-300">
            Наведите камеру на штрихкод на упаковке
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {!scanning ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={disabled}
            onClick={() => void startScanning()}
          >
            Сканировать камерой
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

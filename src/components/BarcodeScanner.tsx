"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeScannerProps = {
  disabled?: boolean;
  onDetected: (code: string) => void;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

export function BarcodeScanner({ disabled, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(getBarcodeDetector()));
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
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }

  async function startScanning() {
    setError(null);
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setSupported(false);
      setError("Сканер штрихкода не поддерживается в этом браузере — введите код вручную.");
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

      const detector = new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
      });

      let lastCode = "";
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(() => {
            void tick();
          });
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue?.trim();
          if (raw && raw !== lastCode) {
            lastCode = raw;
            onDetected(raw);
            stopScanning();
            return;
          }
        } catch {
          // keep scanning
        }
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };
      rafRef.current = requestAnimationFrame(() => {
        void tick();
      });
    } catch {
      setError("Не удалось открыть камеру. Разрешите доступ или введите код вручную.");
      stopScanning();
    }
  }

  if (supported === false) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Сканер камеры недоступен в этом браузере — введите EAN вручную или сфотографируйте упаковку во вкладке «Фото».
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
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
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

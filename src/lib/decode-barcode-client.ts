"use client";

import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { pickDecodedBarcode } from "@/lib/barcode";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

function zxingHints() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

export async function decodeBarcodeFromBitmapSource(
  source: ImageBitmapSource,
): Promise<string | null> {
  const Detector = getBarcodeDetector();
  if (!Detector) return null;
  try {
    const detector = new Detector({ formats: [...SCAN_FORMATS] });
    const codes = await detector.detect(source);
    return pickDecodedBarcode(codes.map((code) => code.rawValue));
  } catch {
    return null;
  }
}

export async function decodeBarcodeFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const native = await decodeBarcodeFromBitmapSource(canvas);
  if (native) return native;

  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const reader = new BrowserMultiFormatReader(zxingHints());
    const result = await reader.decodeFromCanvas(canvas);
    return pickDecodedBarcode([result.getText()]);
  } catch {
    return null;
  }
}

export async function decodeBarcodeFromImageFile(file: File): Promise<string | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const native = await decodeBarcodeFromBitmapSource(bitmap);
        if (native) return native;
      } finally {
        bitmap.close();
      }
    } catch {
      // fall through to image element
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = drawToCanvas(image, image.naturalWidth || image.width, image.naturalHeight || image.height);
    return decodeBarcodeFromCanvas(canvas);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (video.readyState < 2 || video.videoWidth < 16 || video.videoHeight < 16) {
    return null;
  }
  return drawToCanvas(video, video.videoWidth, video.videoHeight);
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx && width && height) {
    ctx.drawImage(source, 0, 0, width, height);
  }
  return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = url;
  });
}

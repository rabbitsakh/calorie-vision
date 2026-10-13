/**
 * Downscale a meal photo in the browser before assistant upload.
 * Phone JPEGs are often 5–12MB; base64 JSON then hits proxy/body limits
 * and the server silently skips recognition.
 */

export const ASSISTANT_IMAGE_MAX_EDGE = 1280;
export const ASSISTANT_IMAGE_JPEG_QUALITY = 0.82;

export type PreparedAssistantImage = {
  base64: string;
  mime: string;
  /** Original file size in bytes (best-effort). */
  originalBytes: number;
  /** Encoded payload size in bytes (decoded). */
  encodedBytes: number;
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать фото"));
    };
    image.src = url;
  });
}

function canvasToJpegBase64(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ base64: string; mime: string; encodedBytes: number }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Не удалось сжать фото"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const m = /^data:([^;]+);base64,(.+)$/.exec(result);
          if (!m) {
            reject(new Error("Не удалось прочитать сжатое фото"));
            return;
          }
          resolve({ mime: m[1]!, base64: m[2]!, encodedBytes: blob.size });
        };
        reader.onerror = () => reject(new Error("Не удалось прочитать сжатое фото"));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Scale so the longest edge ≤ maxEdge; returns 1 if already small enough. */
export function assistantImageScale(width: number, height: number, maxEdge = ASSISTANT_IMAGE_MAX_EDGE): number {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return 1;
  return maxEdge / longest;
}

/**
 * Prepare an image for `/api/assistant/stream` (JPEG base64, capped edge).
 * Falls back to raw FileReader if canvas is unavailable.
 */
export async function prepareAssistantImage(file: File): Promise<PreparedAssistantImage> {
  const originalBytes = file.size;

  try {
    const image = await loadImageFromFile(file);
    const scale = assistantImageScale(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
    );
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("canvas");
    }
    ctx.drawImage(image, 0, 0, width, height);
    const encoded = await canvasToJpegBase64(canvas, ASSISTANT_IMAGE_JPEG_QUALITY);
    return {
      base64: encoded.base64,
      mime: encoded.mime,
      originalBytes,
      encodedBytes: encoded.encodedBytes,
    };
  } catch {
    // Fallback: raw data URL (may still be large).
    const raw = await new Promise<{ base64: string; mime: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const m = /^data:([^;]+);base64,(.+)$/.exec(result);
        if (!m) {
          reject(new Error("Не удалось прочитать фото"));
          return;
        }
        resolve({ mime: m[1]!, base64: m[2]! });
      };
      reader.onerror = () => reject(new Error("Не удалось прочитать фото"));
      reader.readAsDataURL(file);
    });
    return {
      base64: raw.base64,
      mime: raw.mime,
      originalBytes,
      encodedBytes: Math.floor((raw.base64.length * 3) / 4),
    };
  }
}

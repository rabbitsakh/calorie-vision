import { decodeBarcodeFromImageFile } from "@/lib/decode-barcode-client";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { humanizeClientFetchError, isNetworkFetchError, readApiJson } from "@/lib/read-api-json";
import { consumeRecognizeSse } from "@/lib/recognize-sse";
import { withBasePath } from "@/lib/paths";
import { playScannerBeep } from "@/lib/scanner-beep";
import { trackPhotoRecognizeGoal } from "@/lib/metrika-funnel";
import type { RecognitionResponse } from "@/types";

const ENRICHING_UI_TIMEOUT_MS = 12_000;

export type RecognizePhotoOptions = {
  restaurantMode?: boolean;
  /** Skip local barcode scan when already known (offline retry). */
  barcode?: string;
  signal?: AbortSignal;
  /** Stream vision snapshot — same UX as live upload. */
  onVision?: (result: RecognitionResponse) => void;
};

function uploadNameForFile(file: File): string {
  return (
    file.name?.trim() ||
    (file.type.includes("heic") || file.type.includes("heif") || /\.hei[cf]$/i.test(file.name)
      ? "photo.heic"
      : "photo.jpg")
  );
}

async function lookupBarcode(
  barcode: string,
  signal: AbortSignal,
): Promise<RecognitionResponse | null> {
  const lookupResponse = await fetch(withBasePath("/api/food/lookup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode }),
    signal,
  });
  const lookupData = await readApiJson<{
    recognition?: FoodRecognitionResult;
    imagePath?: string;
    error?: string;
  }>(lookupResponse);
  if (!lookupResponse.ok || !lookupData.recognition) {
    return null;
  }
  return {
    imagePath: lookupData.imagePath ?? "",
    recognition: lookupData.recognition,
  };
}

/** Client-side photo recognition — shared by uploader and offline queue flush. */
export async function recognizePhotoFile(
  file: File,
  options: RecognizePhotoOptions = {},
): Promise<RecognitionResponse> {
  const signal = options.signal;
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  let localBarcode = options.barcode?.trim() || null;
  if (!localBarcode) {
    localBarcode = await decodeBarcodeFromImageFile(file);
    if (localBarcode) {
      playScannerBeep();
    }
  }

  if (localBarcode && signal && !signal.aborted) {
    const lookup = await lookupBarcode(localBarcode, signal);
    if (lookup) {
      trackPhotoRecognizeGoal();
      return lookup;
    }
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const formData = new FormData();
  formData.append("photo", file, uploadNameForFile(file));
  if (localBarcode) {
    formData.append("barcode", localBarcode);
  }
  if (options.restaurantMode) {
    formData.append("context", "restaurant");
  }

  let streamImagePath = "";
  let usedStream = false;
  let enrichingSnapshot: RecognitionResponse | null = null;
  let enrichUiTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    const streamResponse = await fetch(withBasePath("/api/recognize/stream"), {
      method: "POST",
      body: formData,
      signal,
    });

    if (streamResponse.ok && streamResponse.headers.get("content-type")?.includes("text/event-stream")) {
      usedStream = true;
      const data = await consumeRecognizeSse(streamResponse, {
        onImage: (imagePath) => {
          streamImagePath = imagePath;
        },
        onVision: (recognition) => {
          if (signal?.aborted) {
            return;
          }
          enrichingSnapshot = {
            imagePath: streamImagePath,
            recognition,
            enriching: true,
          };
          options.onVision?.(enrichingSnapshot);
          if (enrichUiTimer) {
            clearTimeout(enrichUiTimer);
          }
          enrichUiTimer = setTimeout(() => {
            if (enrichingSnapshot?.enriching) {
              enrichingSnapshot = {
                ...enrichingSnapshot,
                enriching: false,
                recognition: {
                  ...enrichingSnapshot.recognition,
                  enrichmentTimedOut: true,
                },
              };
              options.onVision?.(enrichingSnapshot);
            }
          }, ENRICHING_UI_TIMEOUT_MS);
        },
      });

      if (enrichUiTimer) {
        clearTimeout(enrichUiTimer);
      }

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      trackPhotoRecognizeGoal();
      return {
        ...data,
        enriching: false,
      };
    }
  } catch (streamErr) {
    if (enrichUiTimer) {
      clearTimeout(enrichUiTimer);
    }
    if ((streamErr as Error).name === "AbortError") {
      throw streamErr;
    }
    if (usedStream) {
      throw streamErr;
    }
  }

  const response = await fetch(withBasePath("/api/recognize"), {
    method: "POST",
    body: formData,
    signal,
  });
  const data = await readApiJson<RecognitionResponse & { error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.error ?? "Ошибка распознавания");
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  trackPhotoRecognizeGoal();
  return {
    ...data,
    enriching: false,
  };
}

export function describeRecognizeError(error: unknown, fallback: string): string {
  return humanizeClientFetchError(error, fallback);
}

export { isNetworkFetchError };

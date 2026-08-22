import { DEFAULT_LOW_CONFIDENCE_THRESHOLD } from "@/lib/ai/recognition-confidence-calibration";

function parseThreshold(raw: string | undefined): number | null {
  if (!raw?.trim()) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    return null;
  }
  return parsed;
}

/** Shared low-confidence gate for retry logic and confirm-card review banners. */
export function getRecognitionLowConfidenceThreshold(): number {
  return (
    parseThreshold(process.env.RECOGNITION_LOW_CONFIDENCE) ??
    parseThreshold(process.env.NEXT_PUBLIC_RECOGNITION_LOW_CONFIDENCE) ??
    DEFAULT_LOW_CONFIDENCE_THRESHOLD
  );
}

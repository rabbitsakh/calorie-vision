/**
 * Lightweight recognition telemetry (stdout JSON lines).
 * Set RECOGNITION_TELEMETRY=0 to silence.
 * Set RECOGNITION_TELEMETRY_PERSIST=0 to skip DB writes.
 */

import { persistRecognitionPassEvent } from "@/lib/ai/recognition-telemetry-store";

export type RecognitionPassKind =
  | "main"
  | "retry"
  | "specialist"
  | "accepted"
  | "enrichment";

export type RecognitionPassEvent = {
  pass: RecognitionPassKind;
  photoKind?: string;
  retryReason?: string | null;
  specialistPass?: string | null;
  itemCount: number;
  calories: number;
  confidence: number;
  dishName?: string;
  source?: string;
  chatCalls?: number;
  latencyMs?: number;
  enrichmentTimedOut?: boolean;
};

export function logRecognitionPass(event: RecognitionPassEvent): void {
  if (process.env.RECOGNITION_TELEMETRY === "0") {
    return;
  }

  const payload = {
    ...event,
    dishName: event.dishName?.slice(0, 80),
  };

  console.info("[recognition]", JSON.stringify(payload));

  void persistRecognitionPassEvent(event).catch((error) => {
    console.warn("Recognition telemetry persist failed", error);
  });
}

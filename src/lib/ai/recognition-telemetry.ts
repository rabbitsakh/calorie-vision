/**
 * Lightweight recognition telemetry (stdout JSON lines).
 * Set RECOGNITION_TELEMETRY=0 to silence.
 */

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
}

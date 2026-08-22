/**
 * Lightweight recognition telemetry (stdout JSON lines).
 * Set RECOGNITION_TELEMETRY=0 to silence.
 */

export type RecognitionPassEvent = {
  pass: "main" | "retry" | "accepted";
  photoKind?: string;
  retryReason?: string | null;
  itemCount: number;
  calories: number;
  confidence: number;
  dishName?: string;
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

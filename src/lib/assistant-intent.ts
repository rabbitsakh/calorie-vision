/**
 * Pure write/start intent detectors — safe for client and server.
 */

const WRITE_INTENT_RE =
  /добав|сохран|запиш|создай|состав(ь|и)|внеси|закинь|положи|в\s*план|в\s*дневник|в\s*рацион|залог|назнач|запланиру|выпил|воды|взвес|завес|начни|старт|съел|поел|залог(и|ить)?\s*еду|прием[ыа]?\s*пищ/i;

export function userWantsWrite(message: string): boolean {
  return WRITE_INTENT_RE.test(message.trim());
}

export function userWantsStartWorkout(message: string): boolean {
  return /начн(и|ать)|запусти\s*(трен|зал)|старт(уем|ани)?\s*(трен|зал|сегод)?/i.test(
    message.trim(),
  );
}

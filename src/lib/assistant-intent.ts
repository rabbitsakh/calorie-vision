/**
 * Pure write/start intent detectors — safe for client and server.
 */

const WRITE_INTENT_RE =
  /добав|сохран|запиш|создай|состав(ь|и)|внеси|закинь|положи|в\s*план|в\s*дневник|в\s*рацион|залог|назнач|запланиру|выпил|воды|взвес|завес|начни|старт|съел|поел|залог(и|ить)?\s*еду|прием[ыа]?\s*пищ|удал|убери|исправ|поправ|замени|переимен|перенес|сделай|измени|порци|повтор|(?:вчерашн|сегодняшн)\S*\s+(?:завтрак|обед|ужин|перекус|зал|трен)/i;

export function userWantsWrite(message: string): boolean {
  return WRITE_INTENT_RE.test(message.trim());
}

export function userWantsStartWorkout(message: string): boolean {
  return /начн(и|ать)|запусти\s*(трен|зал)|старт(уем|ани)?\s*(трен|зал|сегод)?/i.test(
    message.trim(),
  );
}

/** «Повтори вчерашний зал» / «повтори последнюю тренировку». */
export function userWantsRepeatWorkout(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (/повтор\S*.{0,40}(зал|трен|сесси|последн)/i.test(t)) return true;
  if (/(зал|трен)\S*.{0,20}повтор/i.test(t)) return true;
  if (/вчерашн\S*\s+(зал|трен)/i.test(t) && /повтор|скопир|снова|ещ[её]\s*раз/i.test(t)) {
    return true;
  }
  return false;
}

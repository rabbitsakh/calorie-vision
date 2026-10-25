/**
 * Pure write/start intent detectors — safe for client and server.
 */

const WRITE_INTENT_RE =
  /добав|сохран|запиш|создай|состав(ь|и)|внеси|закинь|положи|в\s*план|в\s*дневник|в\s*рацион|залог|назнач|запланиру|выпил|воды|взвес|завес|начни|старт|съел|поел|залог(и|ить)?\s*еду|прием[ыа]?\s*пищ|удал|убери|исправ|поправ|замени|переимен|перенес|сделай|измени|порци|повтор|поставь|(?:вчерашн|сегодняшн)\S*\s+(?:завтрак|обед|ужин|перекус|зал|трен)/i;

/** «протеин 60г на перекус» / «на ужин курица» — slot + dish without «добавь». */
// `\b` is ASCII-only — use Unicode-safe end like portion parsing.
const MEAL_SLOT_END = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
const MEAL_SLOT_LOG_RE = new RegExp(
  String.raw`(?:на\s+)?(?:завтрак|обед|ужин|перекус)${MEAL_SLOT_END}`,
  "iu",
);
const MEAL_SLOT_STRIP_RE = new RegExp(
  String.raw`(?:на\s+)?(?:завтрак|обед|ужин|перекус)${MEAL_SLOT_END}`,
  "giu",
);

export function userWantsWrite(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (WRITE_INTENT_RE.test(t)) return true;
  // Questions stay read-only («что на перекус?»).
  if (/[?？]\s*$/.test(t) || /^(что|как|сколько|какой|какая|какие|чем)\s/i.test(t)) {
    return false;
  }
  if (!MEAL_SLOT_LOG_RE.test(t)) return false;
  const withoutSlot = t.replace(MEAL_SLOT_STRIP_RE, " ").replace(/\s+/g, " ").trim();
  // Need a dish/portion cue beyond the slot word alone.
  return (
    withoutSlot.length >= 3 &&
    (/\d/.test(withoutSlot) || /[а-яёa-z]{3,}/i.test(withoutSlot))
  );
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

/** «Добавь жим», «поставь 80 на 8», «запиши подход». */
export function userWantsGymEdit(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (userWantsRepeatWorkout(t) || userWantsStartWorkout(t)) return false;
  // Weight×reps near gym verbs / exercise nouns.
  if (
    /(?:поставь|запиш|добав|лог)\S*.{0,40}\d+[.,]?\d*\s*[xх×*]\s*\d+/i.test(t)
  ) {
    return true;
  }
  if (
    /(?:добав|запиш)\S*.{0,30}(жим|тяга|присед|разводк|подтягив|выпад|гантел|штанга|упражн)/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\d+[.,]?\d*\s*(?:кг|kg)?\s*[xх×*]\s*\d+/i.test(t) &&
    /(жим|тяга|присед|подход|зал|трен)/i.test(t)
  ) {
    return true;
  }
  return false;
}

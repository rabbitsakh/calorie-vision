/**
 * Pure write/start intent detectors — safe for client and server.
 */

const WRITE_INTENT_RE =
  /добав|сохран|запиш|создай|состав(ь|и)|внеси|закинь|положи|кинь|в\s*план|в\s*дневник|в\s*рацион|залог|назнач|запланиру|выпил|воды|взвес|завес|начни|старт|съел|поел|залог(и|ить)?\s*еду|прием[ыа]?\s*пищ|удал|убери|исправ|поправ|замени|переимен|перенес|перемест|перекин|сделай|измени|порци|повтор|поставь|(?:вчерашн|сегодняшн)\S*\s+(?:завтрак|обед|ужин|перекус|снек|зал|трен)/i;

/** «протеин 60г на перекус» / «в перекус банан» / «снек протеин» — slot + dish. */
// `\b` is ASCII-only — use Unicode-safe end like portion parsing.
const MEAL_SLOT_END = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
const MEAL_SLOT_STEM = String.raw`(?:завтрак(?:ом|а|у|е)?|обед(?:ом|а|у|е)?|ужин(?:ом|а|у|е)?|перекус(?:ом|а|у|е)?|снек|snack)`;
const MEAL_SLOT_LOG_RE = new RegExp(
  String.raw`(?:(?:на|в|во)\s+)?${MEAL_SLOT_STEM}${MEAL_SLOT_END}`,
  "iu",
);
const MEAL_SLOT_STRIP_RE = new RegExp(
  String.raw`(?:(?:на|в|во)\s+)?${MEAL_SLOT_STEM}${MEAL_SLOT_END}`,
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
  const t = message.trim();
  if (!t) return false;
  if (userWantsStartEmptyWorkout(t)) return true;
  return /начн(и|ать)|запусти\s*(трен|зал)|старт(уем|ани)?\s*(трен|зал|сегод)?/i.test(t);
}

/** «Начни пустую» / «создай пустую тренировку» / «открой пустой зал». */
export function userWantsStartEmptyWorkout(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (/пуст\S*.{0,20}(трен|зал|сесс)/i.test(t)) return true;
  if (/(трен|зал|сесс)\S*.{0,20}пуст/i.test(t)) return true;
  if (/(?:открой|создай|начни)\s+пуст/i.test(t)) return true;
  return false;
}

/** «Повтори вчерашний зал» / «скопируй прошлую тренировку». */
export function userWantsRepeatWorkout(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (/повтор\S*.{0,40}(зал|трен|сесси|последн|прошл)/i.test(t)) return true;
  if (/скопир\S*.{0,40}(зал|трен|сесси|последн|прошл)/i.test(t)) return true;
  if (/(зал|трен)\S*.{0,20}(?:повтор|скопир)/i.test(t)) return true;
  if (
    /(?:вчерашн|прошл)\S*\s+(зал|трен)/i.test(t) &&
    /повтор|скопир|снова|ещ[её]\s*раз/i.test(t)
  ) {
    return true;
  }
  return false;
}

const GYM_NOUN_RE =
  /жим(?:а|у)?|тяг[уиа]|присед(?:а|у|ания)?|разводк\S*|подтягив\S*|выпад\S*|гантел\S*|штанг\S*|упражн\S*|подход\S*/i;

/** «Добавь жим», «поставь 80 на 8», «запиши подход». */
export function userWantsGymEdit(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (userWantsRepeatWorkout(t) || userWantsStartWorkout(t)) return false;
  // Weight×reps near gym verbs / exercise nouns (× or «на»).
  if (
    /(?:поставь|запиш|добав|лог)\S*.{0,40}\d+[.,]?\d*\s*(?:кг|kg)?\s*(?:[xх×*]|\sна\s|\sпо\s)\s*\d+/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/(?:добав|запиш)\S*.{0,40}подход/i.test(t)) return true;
  if (/(?:добав|запиш)\S*.{0,40}/i.test(t) && GYM_NOUN_RE.test(t)) return true;
  if (
    /\d+[.,]?\d*\s*(?:кг|kg)?\s*(?:[xх×*]|\sна\s|\sпо\s)\s*\d+/i.test(t) &&
    GYM_NOUN_RE.test(t)
  ) {
    return true;
  }
  return false;
}

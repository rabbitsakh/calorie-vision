type ExerciseWithHistory = {
  id: string;
  lastTime?: unknown;
};

type SessionWithHistory = {
  id: string;
  exercises: ExerciseWithHistory[];
};

/**
 * Ответ сохранения подхода не содержит прошлый раз: его дописывает только
 * полная загрузка тренировки. Пока она едет, оставляем уже известный
 * lastTime, чтобы плашка «Прошлый …» не схлопывалась и не раздвигала экран.
 * Явный lastTime в новом ответе (в том числе null) не перезаписываем.
 */
export function retainMissingLastTime<T extends SessionWithHistory>(
  previous: T | null | undefined,
  incoming: T,
): T {
  if (!previous || previous.id !== incoming.id) return incoming;
  const byId = new Map(previous.exercises.map((exercise) => [exercise.id, exercise]));
  let changed = false;
  const exercises = incoming.exercises.map((exercise) => {
    if ("lastTime" in exercise) return exercise;
    const prior = byId.get(exercise.id);
    if (!prior || !("lastTime" in prior)) return exercise;
    changed = true;
    return { ...exercise, lastTime: prior.lastTime };
  });
  if (!changed) return incoming;
  return { ...incoming, exercises };
}

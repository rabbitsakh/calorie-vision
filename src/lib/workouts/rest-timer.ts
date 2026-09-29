/** Default rest presets shown in the UI (seconds). */
export const REST_OPTIONS = [60, 90, 120, 180] as const;

const EXERCISE_REST_KEY = "cv-workout-rest-by-exercise";
const DEFAULT_REST_KEY = "cv-workout-rest-seconds";

function normalizeExerciseRestKey(name: string): string {
  return name.trim().toLocaleLowerCase("ru");
}

/** Read all per-exercise rest prefs from localStorage. */
export function readExerciseRestMap(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(EXERCISE_REST_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, number>;
    if (!map || typeof map !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        out[normalizeExerciseRestKey(k)] = Math.min(60 * 30, Math.round(v));
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Merge server byExercise map into localStorage (server wins on conflict). */
export function hydrateExerciseRestMap(server: Record<string, number> | undefined): void {
  if (typeof localStorage === "undefined" || !server) return;
  try {
    const local = readExerciseRestMap();
    const merged = { ...local, ...server };
    localStorage.setItem(EXERCISE_REST_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export function getDefaultRestSec(): number {
  if (typeof localStorage === "undefined") return 90;
  try {
    const sec = Number(localStorage.getItem(DEFAULT_REST_KEY));
    if (Number.isFinite(sec) && sec > 0) return Math.min(60 * 30, Math.round(sec));
  } catch {
    // ignore
  }
  return 90;
}

export function setDefaultRestSec(sec: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DEFAULT_REST_KEY, String(resolveRestDuration(sec, 90)));
  } catch {
    // ignore
  }
}

export function formatRestClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Resolve rest length. Ignores click events / garbage so
 * `onClick={startRest}` cannot poison the timer with NaN.
 */
export function resolveRestDuration(overrideSec: unknown, defaultSec: number): number {
  const fallback =
    typeof defaultSec === "number" && Number.isFinite(defaultSec) && defaultSec > 0
      ? Math.round(defaultSec)
      : 90;
  if (typeof overrideSec !== "number" || !Number.isFinite(overrideSec) || overrideSec <= 0) {
    return fallback;
  }
  return Math.min(60 * 30, Math.round(overrideSec));
}

/** Per-exercise rest preference (localStorage). Null = use global default. */
export function getExerciseRestSec(name: string): number | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(EXERCISE_REST_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number>;
    const sec = map[normalizeExerciseRestKey(name)];
    if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return null;
    return Math.min(60 * 30, Math.round(sec));
  } catch {
    return null;
  }
}

export function setExerciseRestSec(name: string, sec: number): void {
  if (typeof localStorage === "undefined") return;
  const key = normalizeExerciseRestKey(name);
  if (!key) return;
  const value = resolveRestDuration(sec, 90);
  try {
    const raw = localStorage.getItem(EXERCISE_REST_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[key] = value;
    localStorage.setItem(EXERCISE_REST_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}


/**
 * Rest after a set: warmup → skip (0), rest_pause → short, else
 * exercise override → global default.
 */
export function resolveRestForSet(opts: {
  setType?: string | null;
  exerciseName?: string | null;
  defaultSec: number;
  restPauseSec?: number;
}): number {
  const setType = (opts.setType ?? "working").toLowerCase();
  if (setType === "warmup") return 0;
  if (setType === "rest_pause") {
    return resolveRestDuration(opts.restPauseSec ?? 20, 20);
  }
  const byEx =
    opts.exerciseName != null && opts.exerciseName.trim()
      ? getExerciseRestSec(opts.exerciseName)
      : null;
  return resolveRestDuration(byEx, opts.defaultSec);
}

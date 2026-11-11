/** Yandex Metrika counter IDs are numeric (typically 8 digits). */
export function parseMetrikaId(value: string | undefined | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!/^\d{6,12}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveMetrikaId(
  primary: string | undefined | null,
  fallback?: string | undefined | null,
): string | null {
  return parseMetrikaId(primary) ?? parseMetrikaId(fallback);
}

export function shouldTrackMetrikaPath(pathname: string): boolean {
  // Workouts are public app chrome now — only skip admin.
  return !pathname.startsWith("/admin");
}

/** Funnel goals used in client components (Yandex Metrika reachGoal names). */
export const METRIKA_GOALS = {
  login: "login",
  firstMealSave: "first_meal_save",
  photoRecognize: "photo_recognize",
  mealSaved: "meal_saved",
  waterLogged: "water_logged",
  weightLogged: "weight_logged",
  pushEnabled: "push_enabled",
  d7Return: "d7_return",
  chestOpened: "chest_opened",
  frameEquipped: "frame_equipped",
  metaChest: "meta_chest",
  onboardingComplete: "onboarding_complete",
  onboardingPhotoCta: "onboarding_photo_cta",
  firstConfirmSave: "first_confirm_save",
  /** Soft-save from confirm when confidence/macros incomplete. */
  confirmSaveAsIs: "confirm_save_as_is",
  /** User tapped Уточнить / Уточнить БЖУ on confirm. */
  confirmLookup: "confirm_lookup",
  /** G0 — one distinct chest grant (reward catalog key in params). */
  gamChestOpen: "gam_chest_open",
  /** G0 — badge unlock. Param `badge` is the catalog key. */
  gamBadge: "gam_badge",
  /** G0 — combo day (workout + protein in goal), once per date. */
  gamComboDay: "gam_combo_day",
  /** G0 — a daily quest flipped to done. Param `quest` is the quest id. */
  gamQuestDone: "gam_quest_done",
  /** G0 — weekly challenge progress increased. */
  gamChallengeProgress: "gam_challenge_progress",
  /** G0 — weekly challenge completed. */
  gamChallengeDone: "gam_challenge_done",
  /** G0 — streak freeze used. */
  gamStreakFreeze: "gam_streak_freeze",
  /** G0 — RuStore review card became visible. */
  gamReviewShow: "gam_review_show",
  /** G0 — user tapped the RuStore review button. */
  gamReviewRate: "gam_review_rate",
  /** G0 — user dismissed the review card. Param `reason`: later | rated | never. */
  gamReviewDismiss: "gam_review_dismiss",
} as const;

const BLOCKED_METRIKA_PARAM_KEYS = new Set([
  "email",
  "weight",
  "food",
  "meal",
  "name",
  "user",
  "userid",
  "user_id",
]);

/**
 * Keep reachGoal params to short tokens. Drops email-like strings, free text
 * (food names), and keys that would carry weight or identity.
 */
export function sanitizeMetrikaParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [rawKey, value] of Object.entries(params)) {
    const key = rawKey.trim();
    if (!/^[a-z][a-z0-9_]{0,31}$/i.test(key)) continue;
    if (BLOCKED_METRIKA_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
      continue;
    }
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 64) continue;
    if (trimmed.includes("@") || /\s/.test(trimmed)) continue;
    out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type MetrikaGoal = (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS];

let clientCounterId: string | null = null;

/** Called from YandexMetrika so reachGoal works without NEXT_PUBLIC id. */
export function setMetrikaClientId(counterId: string | null | undefined): void {
  clientCounterId = parseMetrikaId(counterId);
}

export function getMetrikaClientId(): string | null {
  return (
    clientCounterId ??
    parseMetrikaId(
      typeof process !== "undefined" ? process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID : undefined,
    )
  );
}

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

/** Fire a Yandex Metrika reachGoal when the counter is available. */
export function trackMetrikaGoal(
  goal: MetrikaGoal | string,
  params?: Record<string, unknown>,
): void {
  const win =
    typeof globalThis !== "undefined"
      ? (globalThis as { window?: Window & { ym?: (counterId: number, method: string, ...args: unknown[]) => void } })
          .window
      : undefined;
  if (!win?.ym) {
    return;
  }
  const id = getMetrikaClientId();
  if (!id) {
    return;
  }
  const safe = sanitizeMetrikaParams(params);
  if (safe) {
    win.ym(Number(id), "reachGoal", goal, safe);
    return;
  }
  win.ym(Number(id), "reachGoal", goal);
}

/** Official tag.js stub + first hit. `counterId` must already be parseMetrikaId-safe. */
export function buildMetrikaInitScript(counterId: string): string {
  const id = parseMetrikaId(counterId);
  if (!id) {
    return "";
  }
  return `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)});if(location.pathname.indexOf("/admin")!==0){ym(${id},"hit",location.href);}`;
}

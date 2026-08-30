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
} as const;

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
export function trackMetrikaGoal(goal: MetrikaGoal | string): void {
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

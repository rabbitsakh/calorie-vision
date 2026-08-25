/**
 * Seasonal + event mascot skins (Duo-style outfits).
 */

export type MascotSkinId =
  | "default"
  | "winter"
  | "spring"
  | "summer"
  | "autumn"
  | "newyear"
  | "halloween"
  | "feb23"
  | "march8"
  | "valentine"
  | "cosmonaut"
  | "victory"
  | "knowledge";

export type MascotRendererMode = "auto" | "svg" | "rive" | "art";

export type MascotSkinMeta = {
  id: MascotSkinId;
  label: string;
  /** Optional Rive asset at /mascot/{id}.riv */
  rivFile: string;
};

export const MASCOT_SKINS: Record<MascotSkinId, MascotSkinMeta> = {
  default: { id: "default", label: "Обычный", rivFile: "default.riv" },
  winter: { id: "winter", label: "Зима", rivFile: "winter.riv" },
  spring: { id: "spring", label: "Весна", rivFile: "spring.riv" },
  summer: { id: "summer", label: "Лето", rivFile: "summer.riv" },
  autumn: { id: "autumn", label: "Осень", rivFile: "autumn.riv" },
  newyear: { id: "newyear", label: "Новый год", rivFile: "newyear.riv" },
  halloween: { id: "halloween", label: "Хэллоуин", rivFile: "halloween.riv" },
  valentine: { id: "valentine", label: "14 февраля", rivFile: "valentine.riv" },
  feb23: { id: "feb23", label: "23 февраля", rivFile: "feb23.riv" },
  march8: { id: "march8", label: "8 марта", rivFile: "march8.riv" },
  cosmonaut: { id: "cosmonaut", label: "День космонавтики", rivFile: "cosmonaut.riv" },
  victory: { id: "victory", label: "9 мая", rivFile: "victory.riv" },
  knowledge: { id: "knowledge", label: "1 сентября", rivFile: "knowledge.riv" },
};

export const MASCOT_SKIN_IDS = Object.keys(MASCOT_SKINS) as MascotSkinId[];

/** Full art pose set shipped for seasonal / event packs. */
export const MASCOT_ART_FULL_POSES = [
  "idle",
  "cheer",
  "pet",
  "streak",
  "goal",
  "empty",
  "tip",
] as const;

/** Northern-hemisphere seasons (month 0–11). */
export function seasonalSkinForMonth(month: number): MascotSkinId {
  if (month === 11 || month <= 1) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  if (month <= 10) return "autumn";
  return "default";
}

/** Limited event windows (Russia-friendly). Events override seasons. */
export function eventSkinForDate(date: Date): MascotSkinId | null {
  const month = date.getMonth();
  const day = date.getDate();

  // Valentine's Day: 13–15 Feb (before Defender week)
  if (month === 1 && day >= 13 && day <= 15) {
    return "valentine";
  }

  // Defender of the Fatherland Day: 20–24 Feb
  if (month === 1 && day >= 20 && day <= 24) {
    return "feb23";
  }

  // International Women's Day: 1–10 Mar
  if (month === 2 && day >= 1 && day <= 10) {
    return "march8";
  }

  // Cosmonautics Day: 11–13 Apr
  if (month === 3 && day >= 11 && day <= 13) {
    return "cosmonaut";
  }

  // Victory Day: 7–10 May
  if (month === 4 && day >= 7 && day <= 10) {
    return "victory";
  }

  // Knowledge Day: 31 Aug – 2 Sep
  if ((month === 7 && day >= 31) || (month === 8 && day <= 2)) {
    return "knowledge";
  }

  // Halloween: 25 Oct – 2 Nov
  if ((month === 9 && day >= 25) || (month === 10 && day <= 2)) {
    return "halloween";
  }

  // New Year: 20 Dec – 10 Jan
  if ((month === 11 && day >= 20) || (month === 0 && day <= 10)) {
    return "newyear";
  }

  return null;
}

export function parseMascotSkinId(raw: string | null | undefined): MascotSkinId | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase() as MascotSkinId;
  return MASCOT_SKIN_IDS.includes(key) ? key : null;
}

export function resolveMascotSkin(
  date: Date = new Date(),
  override?: MascotSkinId | null,
): MascotSkinId {
  if (override) return override;
  const envOverride = parseMascotSkinId(
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MASCOT_SKIN : null,
  );
  if (envOverride) return envOverride;
  return eventSkinForDate(date) ?? seasonalSkinForMonth(date.getMonth());
}

export function mascotRivUrl(skin: MascotSkinId): string {
  return `/mascot/${MASCOT_SKINS[skin].rivFile}`;
}

export function resolveMascotRendererMode(): MascotRendererMode {
  const raw = (
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_MASCOT_RENDERER : null
  )
    ?.trim()
    .toLowerCase();
  if (raw === "svg" || raw === "rive" || raw === "art" || raw === "auto") return raw;
  return "auto";
}

/** Rive is for md+ interactive contexts; sm icons and reduced motion stay SVG. */
export function shouldUseMascotRive(opts: {
  mode?: MascotRendererMode;
  size: "sm" | "md" | "lg" | "xl";
  reducedMotion: boolean;
  riveAvailable: boolean;
}): boolean {
  const mode = opts.mode ?? resolveMascotRendererMode();
  if (opts.reducedMotion || opts.size === "sm") return false;
  if (mode === "svg" || mode === "art") return false;
  if (mode === "rive") return opts.riveAvailable;
  return opts.riveAvailable;
}

export function mascotSkinClass(skin: MascotSkinId): string {
  return skin === "default" ? "" : `mascot-skin-${skin}`;
}

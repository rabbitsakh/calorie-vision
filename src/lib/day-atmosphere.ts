import { dayPartFromHour, type DayPart } from "@/lib/splash-tips";

export type { DayPart };

/** CSS modifier for the day-scene hero atmosphere. */
export function dayHeroAtmosphereClass(hour: number): string {
  const part = dayPartFromHour(hour);
  return `day-hero--${part}`;
}

export function dayPartLabel(part: DayPart): string {
  switch (part) {
    case "morning":
      return "Утро";
    case "day":
      return "День";
    case "evening":
      return "Вечер";
    default:
      return "Ночь";
  }
}

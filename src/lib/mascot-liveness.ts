/**
 * Duolingo-style mascot liveliness helpers.
 */

export type MascotGesture =
  | "none"
  | "look"
  | "yawn"
  | "stretch"
  | "pet"
  | "wave"
  | "react";

export const IDLE_GESTURES: MascotGesture[] = ["look", "yawn", "stretch", "wave"];

export function prefersReducedMascotMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function mascotGestureClass(gesture: MascotGesture): string {
  if (gesture === "none") return "";
  return `mascot-gesture mascot-gesture-${gesture}`;
}

/** Random delay between idle gestures (ms). */
export function nextIdleGestureDelayMs(): number {
  return 7000 + Math.floor(Math.random() * 12000);
}

export function pickIdleGesture(exclude?: MascotGesture): MascotGesture {
  const pool = exclude ? IDLE_GESTURES.filter((g) => g !== exclude) : IDLE_GESTURES;
  return pool[Math.floor(Math.random() * pool.length)] ?? "look";
}

/** Duration of one-shot gestures before returning to none. */
export function gestureDurationMs(gesture: MascotGesture): number {
  switch (gesture) {
    case "pet":
      return 900;
    case "react":
      return 1100;
    case "wave":
      return 1200;
    case "yawn":
      return 1400;
    case "stretch":
      return 1300;
    case "look":
      return 1600;
    default:
      return 0;
  }
}

/**
 * Soft-3D illustrated mascot art (pose stills under /public/mascot/art).
 */

import type { MascotPose } from "@/components/MascotSvg";
import type { MascotGesture } from "@/lib/mascot-liveness";
import type { MascotRendererMode, MascotSkinId } from "@/lib/mascot-skin";

export const MASCOT_ART_POSES = [
  "idle",
  "cheer",
  "streak",
  "goal",
  "empty",
  "tip",
] as const satisfies readonly MascotPose[];

export type MascotArtPoseId = (typeof MASCOT_ART_POSES)[number] | "pet";

/** Skins that ship a dedicated idle still under /mascot/art/{skin}/idle.webp */
export const MASCOT_ART_SEASONAL_IDLE = new Set<MascotSkinId>([
  "winter",
  "spring",
  "summer",
  "autumn",
  "newyear",
  "halloween",
]);

/** Gesture → art still (pet has a dedicated frame; others keep the current pose). */
const GESTURE_ART: Partial<Record<MascotGesture, MascotArtPoseId>> = {
  pet: "pet",
  react: "cheer",
  wave: "cheer",
};

/** Resolve which art still to show for pose + optional one-shot gesture. */
export function resolveMascotArtPose(
  pose: MascotPose = "idle",
  gesture: MascotGesture = "none",
): MascotArtPoseId {
  if (gesture !== "none") {
    const mapped = GESTURE_ART[gesture];
    if (mapped) return mapped;
  }
  return pose;
}

/**
 * Default poses live at /mascot/art/{pose}.webp.
 * Seasonal idle skins: /mascot/art/{skin}/idle.webp (fallback to default pose stills).
 */
export function mascotArtUrl(
  pose: MascotArtPoseId,
  skin: MascotSkinId = "default",
): string {
  if (pose === "idle" && skin !== "default" && MASCOT_ART_SEASONAL_IDLE.has(skin)) {
    return `/mascot/art/${skin}/idle.webp`;
  }
  return `/mascot/art/${pose}.webp`;
}

/** Art wins in auto when assets ship with the app (always true for built-in V5 set). */
export function shouldUseMascotArt(opts: {
  mode?: MascotRendererMode;
  size: "sm" | "md" | "lg" | "xl";
  reducedMotion: boolean;
}): boolean {
  const mode = opts.mode ?? "auto";
  if (mode === "svg" || mode === "rive") return false;
  if (mode === "art") return true;
  // auto: prefer illustrated art for md+; sm stays SVG for crisp nav icons
  return opts.size !== "sm";
}

/**
 * Soft-3D illustrated mascot art (pose stills under /public/mascot/art).
 */

import type { MascotPose } from "@/components/MascotSvg";
import type { MascotGesture } from "@/lib/mascot-liveness";
import {
  MASCOT_ART_FULL_POSES,
  type MascotRendererMode,
  type MascotSkinId,
} from "@/lib/mascot-skin";

export const MASCOT_ART_POSES = [
  "idle",
  "cheer",
  "streak",
  "goal",
  "empty",
  "tip",
] as const satisfies readonly MascotPose[];

export type MascotArtPoseId = (typeof MASCOT_ART_POSES)[number] | "pet";

const FULL = MASCOT_ART_FULL_POSES;

/** Seasonal stills that ship under /mascot/art/{skin}/{pose}.webp */
export const MASCOT_ART_SEASONAL: Record<
  Exclude<MascotSkinId, "default">,
  readonly MascotArtPoseId[]
> = {
  winter: FULL,
  spring: FULL,
  summer: FULL,
  autumn: FULL,
  newyear: FULL,
  halloween: FULL,
  feb23: FULL,
  march8: FULL,
  valentine: FULL,
  cosmonaut: FULL,
  victory: FULL,
  knowledge: FULL,
};

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

function skinHasArt(skin: MascotSkinId, pose: MascotArtPoseId): boolean {
  if (skin === "default") return false;
  return (MASCOT_ART_SEASONAL[skin] as readonly MascotArtPoseId[]).includes(pose);
}

/**
 * Default poses live at /mascot/art/{pose}.webp.
 * Seasonal: /mascot/art/{skin}/{pose}.webp when listed in MASCOT_ART_SEASONAL.
 */
export function mascotArtUrl(
  pose: MascotArtPoseId,
  skin: MascotSkinId = "default",
): string {
  if (skinHasArt(skin, pose)) {
    return `/mascot/art/${skin}/${pose}.webp`;
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

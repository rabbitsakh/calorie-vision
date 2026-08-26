import type {
  CSSProperties,
  KeyboardEventHandler,
  MouseEventHandler,
} from "react";
import type { MascotGesture } from "@/lib/mascot-liveness";
import type { MascotSkinId } from "@/lib/mascot-skin";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";

export const MASCOT_SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

export type MascotSize = keyof typeof MASCOT_SIZE_PX;

/** CSS class per pose — lively micro-motion (see globals.css). */
export function mascotMotionClass(pose: MascotPose): string {
  switch (pose) {
    case "cheer":
      return "mascot-motion mascot-cheer";
    case "streak":
      return "mascot-motion mascot-streak";
    case "goal":
      return "mascot-motion mascot-goal";
    case "tip":
      return "mascot-motion mascot-tip";
    case "empty":
      return "mascot-motion mascot-empty";
    default:
      return "mascot-motion mascot-idle";
  }
}

/** Shared props for illustrated / Rive mascot surfaces. */
export type MascotBaseProps = {
  pose?: MascotPose;
  gesture?: MascotGesture;
  skin?: MascotSkinId;
  size?: MascotSize;
  className?: string;
  title?: string;
  animate?: boolean;
  entrance?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
  style?: CSSProperties;
  "aria-label"?: string;
};

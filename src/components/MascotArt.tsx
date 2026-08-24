"use client";

import {
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
} from "react";
import { mascotMotionClass, type MascotSvgProps } from "@/components/MascotSvg";
import { mascotArtUrl, resolveMascotArtPose } from "@/lib/mascot-art";
import type { MascotSkinId } from "@/lib/mascot-skin";

const SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

export type MascotArtProps = Omit<MascotSvgProps, "skin"> & {
  skin?: MascotSkinId;
  onFail?: () => void;
};

/**
 * Illustrated soft-3D mascot stills (V5 art) with light CSS motion.
 */
export function MascotArt({
  pose = "idle",
  gesture = "none",
  skin = "default",
  size = "md",
  className,
  title = "Талисман Calorie Vision",
  animate = true,
  entrance = false,
  onFail,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  style,
  "aria-label": ariaLabel,
}: MascotArtProps) {
  const px = SIZE_PX[size];
  const artPose = resolveMascotArtPose(pose, gesture);
  const src = mascotArtUrl(artPose, skin);

  const motion = animate ? mascotMotionClass(pose) : "";
  const gestureActive = gesture !== "none" && animate;
  const classes = [
    "mascot-root",
    "mascot-art-root",
    motion,
    gestureActive ? "mascot-gesture-active mascot-art-gesture" : "",
    entrance ? "mascot-entrance" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const label = ariaLabel ?? title;

  return (
    <div
      className={classes}
      style={
        {
          width: px,
          height: px,
          display: "inline-block",
          lineHeight: 0,
          ...(style as CSSProperties | undefined),
        } as CSSProperties
      }
      role={role ?? "img"}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onClick as MouseEventHandler<HTMLDivElement> | undefined}
      onKeyDown={onKeyDown as KeyboardEventHandler<HTMLDivElement> | undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static pose swaps from /public */}
      <img
        key={src}
        src={src}
        alt=""
        width={px}
        height={px}
        draggable={false}
        className="mascot-art-img"
        onError={() => onFail?.()}
      />
    </div>
  );
}

"use client";

import { mascotMotionClass, MASCOT_SIZE_PX, type MascotBaseProps } from "@/lib/mascot-types";
import { mascotArtUrl, resolveMascotArtPose } from "@/lib/mascot-art";
import type { MascotSkinId } from "@/lib/mascot-skin";
import { withBasePath } from "@/lib/paths";

export type MascotArtProps = Omit<MascotBaseProps, "skin"> & {
  skin?: MascotSkinId;
  onFail?: () => void;
};

/**
 * Illustrated soft-3D mascot stills (V5 art) with light CSS motion.
 * Entrance wraps the art so it never overrides pose / gesture animations.
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
  const px = MASCOT_SIZE_PX[size];
  const artPose = resolveMascotArtPose(pose, gesture);
  const src = withBasePath(mascotArtUrl(artPose, skin));

  const motion = animate ? mascotMotionClass(pose) : "";
  const gestureActive = gesture !== "none" && animate;
  const classes = [
    "mascot-root",
    "mascot-art-root",
    motion,
    gestureActive ? "mascot-gesture-active mascot-art-gesture" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const label = ariaLabel ?? title;

  const art = (
    <div
      className={classes}
      style={{
        width: px,
        height: px,
        display: "inline-block",
        lineHeight: 0,
        ...style,
      }}
      role={role ?? "img"}
      aria-label={label}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
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

  if (!entrance) return art;

  return (
    <div className="mascot-entrance-wrap" style={{ width: px, height: px, display: "inline-block" }}>
      {art}
    </div>
  );
}

"use client";

import { MascotRenderer } from "@/components/MascotRenderer";
import { mascotMotionClass, type MascotPose, type MascotSvgProps } from "@/components/MascotSvg";
import { type MascotGesture } from "@/lib/mascot-liveness";
import { type MascotSkinId } from "@/lib/mascot-skin";

export { mascotMotionClass, type MascotPose, type MascotGesture, type MascotSkinId };

export type MascotProps = Omit<MascotSvgProps, "skin"> & {
  /** Calendar / env skin; auto when omitted. */
  skin?: MascotSkinId;
};

/**
 * Default mascot entry — routes through MascotRenderer (art / rive / svg).
 */
export function Mascot({ skin, ...props }: MascotProps) {
  return <MascotRenderer skin={skin} {...props} />;
}

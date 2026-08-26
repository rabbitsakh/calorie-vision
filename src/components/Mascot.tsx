"use client";

import { MascotRenderer } from "@/components/MascotRenderer";
import { mascotMotionClass, type MascotBaseProps, type MascotPose } from "@/lib/mascot-types";
import { type MascotGesture } from "@/lib/mascot-liveness";
import { type MascotSkinId } from "@/lib/mascot-skin";

export { mascotMotionClass, type MascotPose, type MascotGesture, type MascotSkinId };

export type MascotProps = Omit<MascotBaseProps, "skin"> & {
  /** Calendar / env skin; auto when omitted. */
  skin?: MascotSkinId;
};

/**
 * Default mascot entry — routes through MascotRenderer (art / optional rive).
 */
export function Mascot({ skin, ...props }: MascotProps) {
  return <MascotRenderer skin={skin} {...props} />;
}

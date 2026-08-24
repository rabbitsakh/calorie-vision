import { MascotSvg, mascotMotionClass, type MascotPose, type MascotSvgProps } from "@/components/MascotSvg";
import { type MascotGesture } from "@/lib/mascot-liveness";
import { resolveMascotSkin, type MascotSkinId } from "@/lib/mascot-skin";

export { mascotMotionClass, type MascotPose, type MascotGesture, type MascotSkinId };

export type MascotProps = Omit<MascotSvgProps, "skin"> & {
  /** Calendar / env skin; auto when omitted. */
  skin?: MascotSkinId;
};

/**
 * Default mascot — SVG with seasonal accessories.
 * For Rive + context overrides use MascotRenderer (LiveMascot, celebrations).
 */
export function Mascot({ skin, ...props }: MascotProps) {
  const resolvedSkin = skin ?? resolveMascotSkin();
  return <MascotSvg {...props} skin={resolvedSkin} />;
}

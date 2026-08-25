"use client";

import { MascotRenderer } from "@/components/MascotRenderer";
import type { MascotPose } from "@/components/Mascot";
import { useMascotLiveness } from "@/lib/use-mascot-liveness";
import type { MascotRendererMode, MascotSkinId } from "@/lib/mascot-skin";

type LiveMascotProps = {
  pose?: MascotPose;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  title?: string;
  skin?: MascotSkinId;
  /** Force art / svg / rive; omit to use provider / env / auto. */
  renderer?: MascotRendererMode;
  /** Random idle gestures when pose is idle. Default true for idle. */
  idleReel?: boolean;
  /** Tap to pet. Default true for md+ sizes. */
  interactive?: boolean;
  entrance?: boolean;
};

/**
 * Mascot with Duolingo-style idle reel + optional tap-to-pet.
 */
export function LiveMascot({
  pose = "idle",
  size = "md",
  className,
  title,
  skin,
  renderer,
  idleReel,
  interactive,
  entrance = false,
}: LiveMascotProps) {
  const enableIdle = idleReel ?? pose === "idle";
  const enablePet = interactive ?? (size === "md" || size === "lg" || size === "xl");
  const { gesture, petProps } = useMascotLiveness({
    pose,
    idleReel: enableIdle,
    interactive: enablePet,
  });

  return (
    <MascotRenderer
      pose={pose}
      gesture={gesture}
      size={size}
      skin={skin}
      renderer={renderer}
      className={className}
      title={title}
      entrance={entrance}
      {...petProps}
    />
  );
}

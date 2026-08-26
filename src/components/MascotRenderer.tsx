"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { MascotArt } from "@/components/MascotArt";
import type { MascotRiveProps } from "@/components/MascotRive";
import { shouldUseMascotArt } from "@/lib/mascot-art";
import { prefersReducedMascotMotion } from "@/lib/mascot-liveness";
import { useMascotSkinOverrides } from "@/lib/mascot-skin-context";
import {
  mascotRivUrl,
  resolveMascotRendererMode,
  resolveMascotSkin,
  shouldUseMascotRive,
  type MascotRendererMode,
  type MascotSkinId,
} from "@/lib/mascot-skin";
import type { MascotBaseProps } from "@/lib/mascot-types";

export type MascotRendererProps = Omit<MascotBaseProps, "skin"> & {
  skin?: MascotSkinId;
  renderer?: MascotRendererMode;
};

/**
 * Picks illustrated art (default) or optional Rive.
 * SVG path removed — art is the product mascot.
 * Rive chunk is lazy-loaded so the main ration bundle stays smaller.
 */
export function MascotRenderer({ skin, renderer, ...props }: MascotRendererProps) {
  const { skinOverride, rendererOverride } = useMascotSkinOverrides();
  const resolvedSkin = skin ?? skinOverride ?? resolveMascotSkin();
  const mode = renderer ?? rendererOverride ?? resolveMascotRendererMode();
  const reducedMotion = prefersReducedMascotMotion();
  const size = props.size ?? "md";
  const rivUrl = mascotRivUrl(resolvedSkin);

  const [riveAvailable, setRiveAvailable] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const [RiveComp, setRiveComp] = useState<ComponentType<MascotRiveProps> | null>(null);

  const preferArt = shouldUseMascotArt({ mode, size, reducedMotion }) && !artFailed;

  useEffect(() => {
    setArtFailed(false);
  }, [mode, size, resolvedSkin]);

  useEffect(() => {
    if (preferArt || mode === "art") {
      setRiveAvailable(false);
      return;
    }
    let cancelled = false;
    fetch(rivUrl, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setRiveAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setRiveAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, rivUrl, preferArt]);

  const useRive = useMemo(
    () =>
      !preferArt &&
      shouldUseMascotRive({
        mode,
        size,
        reducedMotion,
        riveAvailable,
      }),
    [preferArt, mode, size, reducedMotion, riveAvailable],
  );

  useEffect(() => {
    if (!useRive) {
      setRiveComp(null);
      return;
    }
    let cancelled = false;
    void import("@/components/MascotRive").then((mod) => {
      if (!cancelled) setRiveComp(() => mod.MascotRive);
    });
    return () => {
      cancelled = true;
    };
  }, [useRive]);

  if (preferArt) {
    return (
      <MascotArt {...props} skin={resolvedSkin} size={size} onFail={() => setArtFailed(true)} />
    );
  }

  if (useRive) {
    if (!RiveComp) {
      return <MascotArt {...props} skin={resolvedSkin} size={size} />;
    }
    return <RiveComp {...(props as unknown as MascotRiveProps)} skin={resolvedSkin} size={size} />;
  }

  return <MascotArt {...props} skin={resolvedSkin} size={size} />;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { MascotArt } from "@/components/MascotArt";
import { MascotRive, type MascotRiveProps } from "@/components/MascotRive";
import { MascotSvg, type MascotSvgProps } from "@/components/MascotSvg";
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

export type MascotRendererProps = Omit<MascotSvgProps, "skin"> & {
  skin?: MascotSkinId;
  renderer?: MascotRendererMode;
};

/**
 * Picks illustrated art (V5), Rive, or SVG — used by LiveMascot and xl celebrations.
 * Priority in auto: art (md+) → Rive (if .riv present) → SVG.
 * Art is the default path when mode is auto (see shouldUseMascotArt).
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

  const preferArt = shouldUseMascotArt({ mode, size, reducedMotion }) && !artFailed;

  useEffect(() => {
    setArtFailed(false);
  }, [mode, size, resolvedSkin]);

  useEffect(() => {
    if (mode === "svg" || preferArt) {
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

  if (preferArt) {
    return (
      <MascotArt {...props} skin={resolvedSkin} size={size} onFail={() => setArtFailed(true)} />
    );
  }

  if (useRive) {
    return <MascotRive {...(props as unknown as MascotRiveProps)} skin={resolvedSkin} size={size} />;
  }

  return <MascotSvg {...props} skin={resolvedSkin} size={size} />;
}

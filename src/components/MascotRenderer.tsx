"use client";

import { useEffect, useMemo, useState } from "react";
import { MascotRive, type MascotRiveProps } from "@/components/MascotRive";
import { MascotSvg, type MascotSvgProps } from "@/components/MascotSvg";
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
 * Picks SVG (seasonal) or Rive when asset exists — used by LiveMascot and xl celebrations.
 */
export function MascotRenderer({ skin, renderer, ...props }: MascotRendererProps) {
  const { skinOverride, rendererOverride } = useMascotSkinOverrides();
  const resolvedSkin = skin ?? skinOverride ?? resolveMascotSkin();
  const mode = renderer ?? rendererOverride ?? resolveMascotRendererMode();
  const reducedMotion = prefersReducedMascotMotion();
  const size = props.size ?? "md";
  const rivUrl = mascotRivUrl(resolvedSkin);

  const [riveAvailable, setRiveAvailable] = useState(false);

  useEffect(() => {
    if (mode === "svg") {
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
  }, [mode, rivUrl]);

  const useRive = useMemo(
    () =>
      shouldUseMascotRive({
        mode,
        size,
        reducedMotion,
        riveAvailable,
      }),
    [mode, size, reducedMotion, riveAvailable],
  );

  if (useRive) {
    return <MascotRive {...(props as unknown as MascotRiveProps)} skin={resolvedSkin} size={size} />;
  }

  return <MascotSvg {...props} skin={resolvedSkin} size={size} />;
}

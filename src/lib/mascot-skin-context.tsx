"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MascotRendererMode, MascotSkinId } from "@/lib/mascot-skin";

type MascotSkinContextValue = {
  skinOverride: MascotSkinId | null;
  rendererOverride: MascotRendererMode | null;
};

const MascotSkinContext = createContext<MascotSkinContextValue>({
  skinOverride: null,
  rendererOverride: null,
});

export function MascotSkinProvider({
  skinOverride = null,
  rendererOverride = null,
  children,
}: {
  skinOverride?: MascotSkinId | null;
  rendererOverride?: MascotRendererMode | null;
  children: ReactNode;
}) {
  return (
    <MascotSkinContext.Provider value={{ skinOverride, rendererOverride }}>
      {children}
    </MascotSkinContext.Provider>
  );
}

export function useMascotSkinOverrides() {
  return useContext(MascotSkinContext);
}

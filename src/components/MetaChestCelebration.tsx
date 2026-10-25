"use client";

import { useEffect } from "react";
import {
  flushPendingMetaChests,
  hydratePendingMetaChests,
} from "@/lib/chest-client";

/**
 * C4 — meta loot is inbox-only (no fullscreen competing with ChestDock).
 * Mount once in AppShell to hydrate + flush session-persisted meta (R1e).
 */
export function MetaChestCelebration() {
  useEffect(() => {
    hydratePendingMetaChests();
    flushPendingMetaChests();
  }, []);

  return null;
}

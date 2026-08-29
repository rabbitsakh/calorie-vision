/**
 * Client helper: POST /api/badges to persist newly earned unlocks.
 */

import { withBasePath } from "@/lib/paths";
import type { BadgeDef } from "@/lib/badges";

export type BadgeUnlockResult = {
  newlyUnlocked: BadgeDef[];
  ok: boolean;
};

export async function unlockPendingBadges(): Promise<BadgeUnlockResult> {
  try {
    const resp = await fetch(withBasePath("/api/badges"), { method: "POST" });
    if (!resp.ok) return { newlyUnlocked: [], ok: false };
    const data = (await resp.json()) as { newlyUnlocked?: BadgeDef[] };
    return { newlyUnlocked: data.newlyUnlocked ?? [], ok: true };
  } catch {
    return { newlyUnlocked: [], ok: false };
  }
}

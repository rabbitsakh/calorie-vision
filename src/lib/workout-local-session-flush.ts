/**
 * Push local offline sessions to the server, then remap set/finish draft ids.
 */

import { withBasePath } from "@/lib/paths";
import {
  listLocalWorkoutSessions,
  removeLocalWorkoutSession,
} from "@/lib/workout-local-session";
import { remapWorkoutDraftIds } from "@/lib/workout-set-draft-queue";

type FlushResult = {
  flushed: number;
  lastSessionId: string | null;
  lastSession: unknown | null;
};

/**
 * Create each local session + its exercises on the server.
 * Stops on first network failure so remaining stay queued.
 */
export async function flushLocalWorkoutSessions(): Promise<FlushResult> {
  let flushed = 0;
  let lastSessionId: string | null = null;
  let lastSession: unknown | null = null;

  for (const local of listLocalWorkoutSessions()) {
    try {
      const createResp = await fetch(withBasePath("/api/workouts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: local.date,
          muscleGroups: local.muscleKeys,
          progressRate: local.progressRate,
          note: local.note,
        }),
      });
      if (!createResp.ok) break;
      const created = (await createResp.json()) as {
        session?: { id?: string };
      };
      const serverSessionId = created.session?.id;
      if (!serverSessionId) break;

      const exerciseIdMap: Record<string, string> = {};
      let sessionPayload: unknown = created.session;

      for (const ex of local.exercises) {
        const exResp = await fetch(
          withBasePath(`/api/workouts/${serverSessionId}/exercises`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: ex.name, kind: ex.kind }),
          },
        );
        if (!exResp.ok) break;
        const exData = (await exResp.json()) as {
          session?: {
            exercises?: Array<{ id: string; name: string }>;
          };
        };
        sessionPayload = exData.session ?? sessionPayload;
        const known = new Set(Object.values(exerciseIdMap));
        const match =
          exData.session?.exercises?.find(
            (e) => e.name === ex.name && !known.has(e.id),
          ) ??
          exData.session?.exercises?.filter((e) => !known.has(e.id)).at(-1);
        if (match) {
          exerciseIdMap[ex.id] = match.id;
        }
      }

      remapWorkoutDraftIds({
        sessionIdMap: { [local.id]: serverSessionId },
        exerciseIdMap,
      });
      removeLocalWorkoutSession(local.id);
      flushed += 1;
      lastSessionId = serverSessionId;
      lastSession = sessionPayload;

      // If local was finished offline, keep finish draft (now remapped).
      // Clock start is already applied via POST startedAt.
    } catch {
      break;
    }
  }

  return { flushed, lastSessionId, lastSession };
}

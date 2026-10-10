/**
 * POST queued exercises onto their sessions, then remap set draft exercise ids.
 */

import { withBasePath } from "@/lib/paths";
import {
  listWorkoutExerciseDrafts,
  removeWorkoutExerciseDraft,
} from "@/lib/workout-exercise-draft-queue";
import { remapWorkoutDraftIds } from "@/lib/workout-set-draft-queue";

type FlushResult = {
  flushed: number;
  lastSession: unknown | null;
};

export async function flushWorkoutExerciseDrafts(): Promise<FlushResult> {
  let flushed = 0;
  let lastSession: unknown | null = null;

  for (const draft of listWorkoutExerciseDrafts()) {
    try {
      const resp = await fetch(
        withBasePath(`/api/workouts/${draft.sessionId}/exercises`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: draft.name, kind: draft.exerciseKind }),
        },
      );
      if (!resp.ok) break;
      const data = (await resp.json()) as {
        session?: {
          exercises?: Array<{ id: string; name: string }>;
        };
      };
      lastSession = data.session ?? lastSession;
      const match =
        data.session?.exercises?.find((e) => e.name === draft.name && e.id) ??
        data.session?.exercises?.at(-1);
      if (match) {
        remapWorkoutDraftIds({
          exerciseIdMap: { [draft.id]: match.id },
        });
      }
      removeWorkoutExerciseDraft(draft.id);
      flushed += 1;
    } catch {
      break;
    }
  }

  return { flushed, lastSession };
}

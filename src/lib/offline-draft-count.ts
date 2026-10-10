/**
 * Aggregate offline draft counts for tab badge + APK launcher badge (Wave X).
 */

import { countOfflineQueue } from "@/lib/meal-draft-queue";
import { countWaterDrafts } from "@/lib/water-draft-queue";
import { countWeightDrafts } from "@/lib/weight-draft-queue";
import { countDiaryNoteDrafts } from "@/lib/diary-note-draft-queue";
import { countLocalWorkoutSessions } from "@/lib/workout-local-session";
import { countWorkoutExerciseDrafts } from "@/lib/workout-exercise-draft-queue";
import { countWorkoutOfflineDrafts } from "@/lib/workout-set-draft-queue";

export function countAllOfflineDrafts(): number {
  return (
    countOfflineQueue() +
    countWaterDrafts() +
    countWeightDrafts() +
    countDiaryNoteDrafts() +
    countWorkoutOfflineDrafts() +
    countLocalWorkoutSessions() +
    countWorkoutExerciseDrafts()
  );
}

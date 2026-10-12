/**
 * Wave D — when is it safe to drop a local session / exercise draft after flush?
 */

/** True when every local exercise id has a server mapping (or there were none). */
export function localSessionExercisesFullyMapped(
  localExerciseIds: string[],
  exerciseIdMap: Record<string, string>,
): boolean {
  if (localExerciseIds.length === 0) return true;
  return localExerciseIds.every((id) => Boolean(exerciseIdMap[id]));
}

/** True when we got a real server exercise id for this local draft. */
export function exerciseDraftMapped(localId: string, serverId: string | null | undefined): boolean {
  return Boolean(serverId && serverId !== localId);
}

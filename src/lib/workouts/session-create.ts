/**
 * New-session composer.
 * Copying exercises and sets from the previous workout is opt-in.
 * An empty session must not call POST /api/workouts/{id}/repeat.
 */

export const COPY_PREVIOUS_SESSION_DEFAULT = false;

export function shouldRepeatPreviousSession(
  copyExercises: boolean,
  previousSessionId: string | null | undefined,
): previousSessionId is string {
  return (
    copyExercises === true &&
    typeof previousSessionId === "string" &&
    previousSessionId.length > 0
  );
}

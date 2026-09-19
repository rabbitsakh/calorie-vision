/** Normalize exercise name for history lookup (trim + collapse spaces + lower). */
export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

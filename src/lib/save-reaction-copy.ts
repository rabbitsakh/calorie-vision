/**
 * Rotating micro-copy for the post-save mascot toast.
 */

export const SAVE_REACTION_LINES = [
  "Записано!",
  "Отлично!",
  "Ещё один шаг",
  "Так держать!",
  "День пополнен",
] as const;

export type SaveReactionContext = {
  /** True when this appears to be the first meal logged today. */
  firstMealToday?: boolean;
  seed?: number;
};

export function pickSaveReactionLine(ctx: SaveReactionContext = {}): string {
  if (ctx.firstMealToday) {
    return "Первый приём дня — супер!";
  }
  const seed = ctx.seed ?? Date.now();
  const line = SAVE_REACTION_LINES[Math.abs(seed) % SAVE_REACTION_LINES.length];
  return line ?? SAVE_REACTION_LINES[0]!;
}

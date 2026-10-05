/**
 * Post-save toast copy — factual, adult product tone.
 */

export const SAVE_REACTION_LINES = [
  "Приём сохранён",
  "Записано",
  "Сохранено",
  "Готово",
] as const;

export type SaveReactionContext = {
  /** True when this appears to be the first meal logged today. */
  firstMealToday?: boolean;
  seed?: number;
};

export function pickSaveReactionLine(ctx: SaveReactionContext = {}): string {
  if (ctx.firstMealToday) {
    return "Первый приём записан";
  }
  const seed = ctx.seed ?? Date.now();
  const line = SAVE_REACTION_LINES[Math.abs(seed) % SAVE_REACTION_LINES.length];
  return line ?? SAVE_REACTION_LINES[0]!;
}

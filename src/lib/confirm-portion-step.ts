/** Inline −/+ on confirm rows: coarse steps that land on round numbers. */
export function portionStep(current: number, drink: boolean): number {
  if (drink) return current < 100 ? 25 : 50;
  if (current < 50) return 5;
  if (current < 200) return 10;
  return 25;
}

export function bumpPortion(current: number, dir: 1 | -1, drink: boolean): number {
  const safe = Number.isFinite(current) && current > 0 ? current : 0;
  const step = portionStep(dir < 0 ? Math.max(0, safe - 1) : safe, drink);
  const next = dir > 0 ? Math.floor(safe / step) * step + step : Math.ceil(safe / step) * step - step;
  return Math.max(step, next);
}

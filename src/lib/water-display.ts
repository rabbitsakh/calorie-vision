/**
 * How water is shown. Amounts are still stored and calculated in millilitres;
 * this module only turns them into one Russian line.
 */

function litersText(liters: number, digits: number): string {
  return liters.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

/** 250 → "0,25", 700 → "0,7", 2000 → "2", 2500 → "2,5". */
export function formatWaterLiters(ml: number): string {
  const liters = Math.round(Math.max(0, ml)) / 1000;
  return litersText(liters, 2);
}

/**
 * "0,7 из 2,5 л". Below the target, tenths are floored so 1,99 л
 * never renders as the same number as a 2 л goal.
 */
export function formatWaterOf(currentMl: number, targetMl: number): string {
  const targetL = Math.max(0, targetMl) / 1000;
  const actualL = Math.max(0, currentMl) / 1000;
  const shown = currentMl < targetMl ? Math.floor(actualL * 10) / 10 : actualL;
  return `${litersText(shown, 1)} из ${litersText(targetL, 1)} л`;
}

/** "+0,25 л" or "−0,25 л". */
export function formatWaterDelta(ml: number): string {
  const sign = ml < 0 ? "−" : "+";
  return `${sign}${formatWaterLiters(Math.abs(ml))} л`;
}

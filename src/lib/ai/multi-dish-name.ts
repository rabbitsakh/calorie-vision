/** Side / garnish cues after «с» that usually mean a second plate item. */
const MULTI_SIDE_AFTER_S_RE =
  /\s+с\s+(?:хлебом|салатом|гарниром|соусом|лимоном|сметаной|рисом|картофелем|пюре|овощами|тостом|яичницей|яйцом)(?=$|[^\p{L}\p{N}])/iu;

/**
 * Dish name looks like several foods on one plate (comma / и / slash / plus / dash / «X с Y»).
 */
export function looksLikeMultiDishName(dishName: string): boolean {
  const name = dishName.trim();
  if (!name) return false;
  if ((name.match(/,/g) ?? []).length >= 1) return true;
  if (/\s+и\s+/i.test(name)) return true;
  if (/\s*[+/]\s*/.test(name)) return true;
  if (/\s+[-–—]\s+/.test(name)) return true;
  if (MULTI_SIDE_AFTER_S_RE.test(name)) return true;
  return false;
}

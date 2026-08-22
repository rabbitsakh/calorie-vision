/**
 * Heuristic: should portion quick-chips use мл labels (drinks) vs г (food).
 * Uses Cyrillic-safe token edges so «виноград» is not treated as «вино».
 */

const DRINK_TOKEN =
  "напиток|сок|чай|кофе|молоко|молочн\\w*|кефир|ряженк\\w*|пиво|вино|вода|лимонад|кола|cola|coca|pepsi|sprite|fanta|smoothie|смузи|компот|морс|какао|квас|латте|капучино|эспрессо|американо|энергетик\\w*";

const DRINK_PHRASE = "йогурт\\s+пить|питьевой\\s+йогурт";

const DRINK_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(?:${DRINK_TOKEN}|${DRINK_PHRASE})(?:[^\\p{L}\\p{N}]|$)`,
  "iu",
);

export function looksLikeDrinkName(...parts: Array<string | null | undefined>): boolean {
  const name = parts.filter(Boolean).join(" ").trim();
  if (!name) {
    return false;
  }
  return DRINK_RE.test(name);
}

/** Single snack / protein bar — typical pack is ~40–60 г, not 100 г per label. */
const SNACK_BAR_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(?:батончик\\w*|протеин(?:овый)?\\s*батон\\w*|protein\\s*bars?|snack\\s*bars?|proteinbars?|bars?)(?:[^\\p{L}\\p{N}]|$)`,
  "iu",
);

export function looksLikeSnackBarName(...parts: Array<string | null | undefined>): boolean {
  const name = parts.filter(Boolean).join(" ").trim();
  if (!name) {
    return false;
  }
  return SNACK_BAR_RE.test(name);
}

export const DEFAULT_SNACK_BAR_GRAMS = 60;

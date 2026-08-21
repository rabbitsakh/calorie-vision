/**
 * Heuristic: should portion quick-chips use мл labels (drinks) vs г (food).
 * Uses Cyrillic-safe token edges so «виноград» is not treated as «вино».
 */

const DRINK_TOKEN =
  "напиток|сок|чай|кофе|молоко|молочн\\w*|кефир|ряженк\\w*|пиво|вино|вода|лимонад|кола|smoothie|смузи|компот|морс|какао|квас|латте|капучино|эспрессо|американо|энергетик\\w*";

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

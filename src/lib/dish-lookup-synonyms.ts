/** Common RU dish synonyms for OFF / GigaChat lookup queries. */
const DISH_SYNONYMS: Record<string, string> = {
  гречка: "гречневая каша",
  рис: "рис белый варёный",
  борщ: "борщ с мясом",
  суп: "суп",
  овсянка: "овсяная каша",
  каша: "каша",
  салат: "салат",
  кофе: "кофе",
  чай: "чай",
  молоко: "молоко 2.5%",
  латте: "латте",
};

function normalizeLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

/** Up to `limit` distinct lookup queries: original, simplified, synonym. */
export function lookupQueriesForName(name: string, simplified: string | null, limit = 2): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      return;
    }
    const key = normalizeLookupKey(trimmed);
    if (!out.some((item) => normalizeLookupKey(item) === key)) {
      out.push(trimmed);
    }
  };

  push(name);
  if (simplified) {
    push(simplified);
  }

  const firstToken = normalizeLookupKey(name).split(" ")[0] ?? "";
  const synonym = DISH_SYNONYMS[firstToken];
  if (synonym) {
    push(synonym);
  }

  return out.slice(0, limit);
}

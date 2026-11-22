/**
 * Штучная порция: «3 блинчика», «2 пирожка», «4 яйца».
 * Справочник хранит плотность на порцию, а в чате число часто приходит как штуки.
 * Здесь — средний вес одной штуки и формы слова, которыми эту штуку называют.
 */

const WORD_COUNT: Record<string, number> = {
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
};

/** Дольше — раньше, чтобы «блинчик» не схлопнулся в «блин». */
const DISH_STEMS = [
  "блинчик",
  "сырник",
  "котлет",
  "пирож",
  "чебурек",
  "пельмен",
  "вареник",
  "круассан",
  "ватруш",
  "хачапур",
  "сосиск",
  "пончик",
  "булоч",
  "пряник",
  "драник",
  "оладуш",
  "оладь",
  "оладу",
  "яблок",
  "банан",
  "бургер",
  "шаурм",
  "шаверм",
  "пицц",
  "яйц",
  "блин",
] as const;

const FOOD_STEM_SRC = DISH_STEMS.join("|");

function fold(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

/** «блинчика» → «блинчик», «пирожка» → «пирожок». Остальные слова не трогаем. */
export function stemPieceToken(token: string): string {
  const t = fold(token);
  if (/^блинчик/u.test(t)) return "блинчик";
  if (/^блин(?:а|у|ом|ов|ы)?$/u.test(t)) return "блин";
  if (/^сырник/u.test(t)) return "сырник";
  if (/^котлет/u.test(t)) return "котлета";
  if (/^пирож(?:ок|ка|ки|ку|ке|ком|ков|кам|ками|ках)$/u.test(t)) return "пирожок";
  if (/^чебурек/u.test(t)) return "чебурек";
  if (/^пельмен/u.test(t)) return "пельмени";
  if (/^вареник/u.test(t)) return "вареники";
  if (/^яйц/u.test(t) || t === "яиц") return "яйцо";
  if (/^сосиск/u.test(t)) return "сосиска";
  if (/^пончик/u.test(t)) return "пончик";
  if (/^булоч/u.test(t)) return "булочка";
  if (/^круассан/u.test(t)) return "круассан";
  if (/^ватруш/u.test(t)) return "ватрушка";
  if (/^пряник/u.test(t)) return "пряник";
  if (/^драник/u.test(t)) return "драник";
  if (/^оладь|^оладу/u.test(t)) return "оладьи";
  if (/^яблок/u.test(t)) return "яблоко";
  if (/^банан/u.test(t)) return "банан";
  if (/^хачапур/u.test(t)) return "хачапури";
  if (/^бургер|^гамбургер|^чизбургер/u.test(t)) return "бургер";
  if (/^шаурм|^шаверм/u.test(t)) return "шаурма";
  if (/^пицц/u.test(t)) return "пицца";
  return token;
}

export function stemPieceQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/u)
    .map((token) => stemPieceToken(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Исходные запросы и те же фразы в словарной форме. Порядок сохраняется. */
export function expandFoodQueries(queries: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    const raw = query.trim();
    if (raw.length < 3) continue;
    const stemmed = stemPieceQuery(raw);
    for (const item of [raw, stemmed]) {
      const key = fold(item);
      if (item.length < 3 || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function dishStem(name: string): string | null {
  const folded = fold(name);
  for (const stem of DISH_STEMS) {
    if (folded.includes(stem)) return stem;
  }
  return null;
}

/**
 * Число рядом с этим блюдом: «3 блинчика», «четыре варёных яйца», «2 куска пиццы».
 * Чужое число в той же фразе («3 блинчика и 2 яйца») не забираем.
 */
export function pieceCountBesideDish(dishName: string, text: string): number | null {
  const stem = dishStem(dishName);
  if (!stem) return null;
  const source = fold(text);
  const words = "два|две|три|четыре|пять|шесть|семь|восемь";
  const match = new RegExp(
    String.raw`(?:^|[^\p{L}\p{N}])(?:(\d+)|(${words}))\s+(?:[\p{L}-]+\s+){0,4}?${stem}`,
    "iu",
  ).exec(source);
  if (!match) return null;
  if (match[1]) {
    const n = Number(match[1]);
    return n > 0 && n <= 40 ? Math.round(n) : null;
  }
  return WORD_COUNT[fold(match[2] ?? "")] ?? null;
}

/** «4 варёных яйца», «яйца 3 шт», «два пирожка» → число штук. */
export function parsePieceCountFromMessage(text: string): number | null {
  const end = String.raw`(?=$|\s|[^\p{L}\p{N}])`;
  const withUnit = new RegExp(String.raw`(\d+)\s*(?:шт(?:ук[аи]?)?\.?)${end}`, "iu").exec(text);
  if (withUnit?.[1]) {
    const n = Number(withUnit[1]);
    if (Number.isFinite(n) && n > 0 && n <= 40) return Math.round(n);
  }
  const wordUnit = new RegExp(
    String.raw`(?:^|[^\p{L}\p{N}])(два|две|три|четыре|пять|шесть|семь|восемь)\s*(?:шт(?:ук[аи]?)?\.?)${end}`,
    "iu",
  ).exec(fold(text));
  if (wordUnit?.[1]) return WORD_COUNT[fold(wordUnit[1])] ?? null;

  // «яйц» экранирован: буква «и» вместо «й» не ловит «яйца».
  const beforeFood = new RegExp(
    String.raw`(\d+)\s+(?:вар[её]н\p{L}*\s+|куск\p{L}*\s+)?(?:\u044f\u0439\u0446\p{L}*|${FOOD_STEM_SRC})\p{L}*`,
    "iu",
  ).exec(text);
  if (beforeFood?.[1]) {
    const n = Number(beforeFood[1]);
    if (Number.isFinite(n) && n > 0 && n <= 40) return Math.round(n);
  }
  const wordBefore = new RegExp(
    String.raw`(?:^|[^\p{L}\p{N}])(два|две|три|четыре|пять|шесть|семь|восемь)\s+(?:вар[её]н\p{L}*\s+|куск\p{L}*\s+)?(?:\u044f\u0439\u0446\p{L}*|${FOOD_STEM_SRC})`,
    "iu",
  ).exec(fold(text));
  if (wordBefore?.[1]) return WORD_COUNT[fold(wordBefore[1])] ?? null;

  const leading = /^\s*(\d+)\s+(?=\p{L})/u.exec(text.trim());
  if (leading?.[1]) {
    const n = Number(leading[1]);
    if (Number.isFinite(n) && n > 0 && n <= 40) return Math.round(n);
  }
  return null;
}

/** Средний вес одной штуки. Порция справочника — только если строка и есть одна штука. */
export function typicalPieceGrams(dishName: string): number | null {
  const name = fold(dishName);
  if (/пельмен/.test(name)) return 15;
  if (/вареник/.test(name)) return 25;
  if (/сырник/.test(name)) return 70;
  if (/пицц/.test(name)) return 100;
  if (/блин/.test(name) && /творог/.test(name)) return 80;
  if (/блин/.test(name)) return 50;
  if (/оладь|оладу/.test(name)) return 50;
  if (/яйц/.test(name) && !/яичн/.test(name)) return 55;
  if (/банан/.test(name)) return 120;
  if (/яблок/.test(name)) return 180;
  if (/котлет/.test(name) && /домашн/.test(name)) return 100;
  if (/пирож/.test(name) && !/пирожн/.test(name)) return 90;
  if (/чебурек/.test(name)) return 120;
  if (/пончик/.test(name)) return 70;
  if (/булоч/.test(name)) return 70;
  if (/круассан/.test(name)) return 65;
  if (/ватруш/.test(name)) return 100;
  if (/пряник/.test(name)) return 45;
  if (/драник/.test(name)) return 60;
  if (/хачапур/.test(name)) return 180;
  if (/бургер|гамбургер|чизбургер/.test(name)) return 220;
  if (/шаурм|шаверм/.test(name)) return 280;
  return null;
}

function portionIsOnePiece(dishName: string): boolean {
  return /яйц|сырок|банан|яблок|апельсин|мандарин|сосиск|котлет/i.test(dishName);
}

export function gramsPerPiece(dishName: string, portionGrams?: number): number | null {
  const typical = typicalPieceGrams(dishName);
  if (typical != null) return typical;
  if (portionIsOnePiece(dishName) && portionGrams && portionGrams > 0) {
    return Math.round(portionGrams);
  }
  return null;
}

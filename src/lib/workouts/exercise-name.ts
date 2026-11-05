/**
 * Normalize / soft-match exercise names so history, PRs and library
 * do not split on ё/е, punctuation, or common Russian typos.
 */

/** Plain substring replaces — JS `\b` is unreliable for Cyrillic even with `u`. */
const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/тиенажер/g, "тренажер"],
  [/тиенажор/g, "тренажер"],
  [/треннажер/g, "тренажер"],
  [/тренажор/g, "тренажер"],
  [/бийепс/g, "бицепс"],
  [/бицеппс/g, "бицепс"],
  [/биципс/g, "бицепс"],
  [/скваат/g, "присед"],
  [/сквоат/g, "присед"],
  [/сквот/g, "присед"],
  [/скват/g, "присед"],
  [/приседания/g, "присед"],
  [/приседание/g, "присед"],
  [/гантель/g, "гантели"],
  [/гантеля/g, "гантели"],
];

/**
 * Слова, которые не задают новое движение.
 * «стоя» и «в тренажере» часто дописывают к уже понятному названию.
 */
const STOPWORDS = new Set(["в", "во", "на", "с", "со", "из", "за", "от", "для", "и", "по", "к", "ко"]);
const OPTIONAL_TOKENS = new Set(["стоя", "тренажер", "тренажере"]);

/** Транслит зала: сравнение, не ключ истории. «пресс» как слово остаётся в nameNorm. */
const ALIAS_TOKENS: Record<string, string> = {
  шолдер: "shoulder",
  пресс: "press",
  пулдаун: "pulldown",
  пулдовн: "pulldown",
  лоу: "low",
  роу: "row",
  смит: "smith",
  смита: "smith",
  смите: "smith",
  смитом: "smith",
};

/** Normalize exercise name for history / library keys. */
export function normalizeExerciseName(name: string): string {
  let s = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!s) return "";
  s = s.replace(/ё/g, "е");
  for (const [re, to] of TYPO_REPLACEMENTS) {
    s = s.replace(re, to);
  }
  // Drop most punctuation; keep letters/digits/spaces/+/%
  s = s.replace(/[^\p{L}\p{N}\s+%]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Classic Levenshtein distance (small strings only). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

/** Similarity 0..1 from edit distance. */
export function exerciseNameSimilarity(a: string, b: string): number {
  const na = normalizeExerciseName(a);
  const nb = normalizeExerciseName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function tokensOf(value: string): string[] {
  return value.split(" ").filter(Boolean);
}

/** Сворачивает англицизмы зала. Вход уже пропущен через normalizeExerciseName. */
export function foldExerciseAliases(norm: string): string {
  if (!norm) return "";
  return tokensOf(norm)
    .map((token) => ALIAS_TOKENS[token] ?? token)
    .join(" ");
}

function sameTokenMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const count = new Map<string, number>();
  for (const token of a) count.set(token, (count.get(token) ?? 0) + 1);
  for (const token of b) {
    const left = count.get(token) ?? 0;
    if (left === 0) return false;
    count.set(token, left - 1);
  }
  return true;
}

/**
 * Фраза справочника покрывает запрос, если лишние слова запроса — только
 * «стоя» и «в тренажере» (и предлоги). Короткое «бабочка» не поглощает
 * «бабочка на заднюю дельту».
 */
export function exercisePhraseCovers(queryNorm: string, phraseNorm: string): boolean {
  const query = tokensOf(foldExerciseAliases(queryNorm));
  const phrase = tokensOf(foldExerciseAliases(phraseNorm));
  if (phrase.length < 2 || query.length <= phrase.length) return false;
  const phraseSet = new Set(phrase);
  const querySet = new Set(query);
  for (const token of phrase) {
    if (!querySet.has(token)) return false;
  }
  for (const token of query) {
    if (phraseSet.has(token) || STOPWORDS.has(token) || OPTIONAL_TOKENS.has(token)) continue;
    return false;
  }
  return true;
}

/**
 * 1 — то же название (порядок слов и шолдер/shoulder не важны).
 * 0.99 — то же название плюс «стоя» / «в тренажере».
 * Иначе расстояние Левенштейна по уже нормализованным строкам.
 */
export function scoreExercisePhrase(queryNorm: string, phraseNorm: string): number {
  const q = foldExerciseAliases(queryNorm);
  const p = foldExerciseAliases(phraseNorm);
  if (!q || !p) return 0;
  if (q === p || sameTokenMultiset(tokensOf(q), tokensOf(p))) return 1;
  if (exercisePhraseCovers(q, p)) return 0.99;
  const dist = levenshtein(q, p);
  const maxLen = Math.max(q.length, p.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

/** True when names should share history / library row. */
export function exerciseNamesMatch(a: string, b: string, minSimilarity = 0.9): boolean {
  const na = normalizeExerciseName(a);
  const nb = normalizeExerciseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Short names: require near-exact (avoid «жим» ≈ «жимка»)
  if (Math.min(na.length, nb.length) < 8) {
    return na === nb;
  }
  return exerciseNameSimilarity(na, nb) >= minSimilarity;
}

export type NamedRow = { nameNorm: string };

/**
 * Pick best library/history row for a query name.
 * Prefers exact normalize, then highest similarity ≥ threshold.
 */
export function pickBestNameMatch<T extends NamedRow>(
  rows: readonly T[],
  query: string,
  minSimilarity = 0.9,
): T | null {
  const key = normalizeExerciseName(query);
  if (!key) return null;
  const exact = rows.find((r) => r.nameNorm === key);
  if (exact) return exact;

  let best: T | null = null;
  let bestScore = 0;
  for (const row of rows) {
    if (!row.nameNorm) continue;
    if (Math.min(key.length, row.nameNorm.length) < 8 && key !== row.nameNorm) continue;
    const score = exerciseNameSimilarity(key, row.nameNorm);
    if (score >= minSimilarity && score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

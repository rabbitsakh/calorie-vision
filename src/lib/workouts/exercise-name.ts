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
  [/скваат/g, "скват"],
  [/приседания/g, "присед"],
  [/приседание/g, "присед"],
  [/гантель/g, "гантели"],
  [/гантеля/g, "гантели"],
];

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

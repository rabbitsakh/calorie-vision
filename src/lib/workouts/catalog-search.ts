/**
 * Нечёткий поиск по справочнику: название, синонимы, опечатки.
 * Недавние и частые упражнения пользователя поднимаются выше.
 */

import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import {
  catalogById,
  equipmentLabel,
  type CatalogExercise,
  type EquipmentKey,
  type TrackingType,
} from "@/lib/workouts/exercise-catalog";
import { normalizeExerciseName, scoreExercisePhrase } from "@/lib/workouts/exercise-name";
import { isMuscleGroupKey, muscleGroupLabel, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

export type CatalogSearchHit = {
  id: string;
  name: string;
  kind: ExerciseKind;
  tracking: TrackingType;
  primary: MuscleGroupKey[];
  primaryLabels: string[];
  secondary: MuscleGroupKey[];
  equipment: EquipmentKey;
  equipmentLabel: string;
  defaultRestSec: number;
  /** 0..1, выше — ближе к запросу. */
  score: number;
  source: "recent" | "catalog";
  useCount: number;
};

export type RecentExercise = {
  name: string;
  catalogId?: string | null;
  kind?: ExerciseKind | null;
  useCount?: number;
  lastUsedAt?: string | number | Date | null;
};

const RECENT_BOOST = 0.08;

function tokens(value: string): string[] {
  return normalizeExerciseName(value).split(" ").filter(Boolean);
}

/** Оценка совпадения запроса с одним упражнением справочника. 0 — мимо. */
export function scoreCatalogExercise(query: string, row: CatalogExercise): number {
  const q = normalizeExerciseName(query);
  if (!q) return 0;
  if (q === row.nameNorm) return 1;
  if (row.synonymNorms.includes(q)) return 1;

  let best = scoreExercisePhrase(q, row.nameNorm);
  for (const syn of row.synonymNorms) {
    const sim = scoreExercisePhrase(q, syn);
    if (sim > best) best = sim;
  }

  const qTokens = tokens(q);
  if (q.length >= 3) {
    const hay = [row.nameNorm, ...row.synonymNorms];
    for (const name of hay) {
      const nameTokens = name.split(" ");
      const prefix = name.startsWith(q) || nameTokens.some((token) => token.startsWith(q));
      if (prefix) best = Math.max(best, q.length >= 8 ? 0.9 : 0.8);
      if (qTokens.length >= 2) {
        const hit = qTokens.filter((t) => nameTokens.some((n) => n.startsWith(t) || t.startsWith(n))).length;
        if (hit === qTokens.length) best = Math.max(best, 0.88);
      }
    }
  }

  if (best < 0.72) return 0;
  return Math.round(best * 1000) / 1000;
}

function passesMuscle(row: CatalogExercise, muscle: MuscleGroupKey | null): boolean {
  if (!muscle) return true;
  return row.primary.includes(muscle) || row.secondary.includes(muscle);
}

function toHit(
  row: CatalogExercise,
  score: number,
  source: CatalogSearchHit["source"],
  useCount: number,
): CatalogSearchHit {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    tracking: row.tracking,
    primary: row.primary,
    primaryLabels: row.primary.map(muscleGroupLabel),
    secondary: row.secondary,
    equipment: row.equipment,
    equipmentLabel: equipmentLabel(row.equipment),
    defaultRestSec: row.defaultRestSec,
    score,
    source,
    useCount,
  };
}

/**
 * Пустой запрос: недавние сверху, затем справочник по группе.
 * С запросом: нечёткое совпадение, недавние с тем же id чуть выше.
 */
export function searchExerciseCatalog(opts: {
  query?: string;
  muscle?: string | null;
  catalog: readonly CatalogExercise[];
  recent?: readonly RecentExercise[];
  limit?: number;
}): CatalogSearchHit[] {
  const muscle =
    opts.muscle && isMuscleGroupKey(opts.muscle) ? opts.muscle : null;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 40);
  const query = (opts.query ?? "").trim();
  const recent = opts.recent ?? [];

  const recentByCatalog = new Map<string, RecentExercise>();
  const recentByNorm = new Map<string, RecentExercise>();
  for (const item of recent) {
    const norm = normalizeExerciseName(item.name);
    if (norm && !recentByNorm.has(norm)) recentByNorm.set(norm, item);
    if (item.catalogId && !recentByCatalog.has(item.catalogId)) {
      recentByCatalog.set(item.catalogId, item);
    }
  }

  if (!query) {
    const hits: CatalogSearchHit[] = [];
    const seen = new Set<string>();
    const rankedRecent = [...recent].sort((a, b) => {
      const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.useCount ?? 0) - (a.useCount ?? 0);
    });
    for (const item of rankedRecent) {
      const row =
        (item.catalogId ? catalogById(item.catalogId) : null) ??
        opts.catalog.find((c) => c.nameNorm === normalizeExerciseName(item.name)) ??
        null;
      if (!row || seen.has(row.id) || !passesMuscle(row, muscle)) continue;
      seen.add(row.id);
      hits.push(toHit(row, 1, "recent", item.useCount ?? 0));
      if (hits.length >= limit) return hits;
    }
    for (const row of opts.catalog) {
      if (seen.has(row.id) || !passesMuscle(row, muscle)) continue;
      hits.push(toHit(row, 0.5, "catalog", 0));
      if (hits.length >= limit) break;
    }
    return hits;
  }

  const scored: CatalogSearchHit[] = [];
  for (const row of opts.catalog) {
    if (!passesMuscle(row, muscle)) continue;
    const base = scoreCatalogExercise(query, row);
    if (base <= 0) continue;
    const recentHit = recentByCatalog.get(row.id) ?? recentByNorm.get(row.nameNorm);
    const score = Math.min(1, base + (recentHit ? RECENT_BOOST : 0));
    scored.push(
      toHit(row, Math.round(score * 1000) / 1000, recentHit ? "recent" : "catalog", recentHit?.useCount ?? 0),
    );
  }
  scored.sort((a, b) => b.score - a.score || b.useCount - a.useCount || a.name.localeCompare(b.name, "ru"));
  return scored.slice(0, limit);
}

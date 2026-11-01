/**
 * Turn stored FoodCorrection rows into an anonymized eval/dataset export.
 * Used to grow recognition quality from real user fixes (roadmap X1).
 */

export type CorrectionDatasetSourceRow = {
  originalKey: string;
  correctedName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  brand?: string | null;
  useCount: number;
};

export type CorrectionDatasetExportRow = {
  id: string;
  originalKey: string;
  correctedName: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  portionGrams: number | null;
  brand: string | null;
  useCount: number;
};

export type CorrectionDatasetExport = {
  exportedAt: string;
  minUseCount: number;
  count: number;
  rows: CorrectionDatasetExportRow[];
};

/** Stable anon id — no userId in the export. */
export function correctionDatasetRowId(row: Pick<CorrectionDatasetSourceRow, "originalKey" | "correctedName">): string {
  const key = `${row.originalKey}→${row.correctedName}`
    .toLowerCase()
    .replace(/[^a-z0-9а-яё→]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return key || "correction";
}

export function toCorrectionDatasetRow(row: CorrectionDatasetSourceRow): CorrectionDatasetExportRow {
  return {
    id: correctionDatasetRowId(row),
    originalKey: row.originalKey,
    correctedName: row.correctedName,
    calories: row.calories,
    protein: row.protein ?? null,
    fat: row.fat ?? null,
    carbs: row.carbs ?? null,
    fiber: row.fiber ?? null,
    sugar: row.sugar ?? null,
    portionGrams: row.portionGrams ?? null,
    brand: row.brand ?? null,
    useCount: row.useCount,
  };
}

/**
 * Keep high-signal corrections: repeated use, real rename or macro change.
 * Dedupes by originalKey preferring higher useCount.
 */
export function buildCorrectionDataset(
  rows: CorrectionDatasetSourceRow[],
  options?: { minUseCount?: number; limit?: number },
): CorrectionDatasetExport {
  const minUseCount = Math.max(1, options?.minUseCount ?? 2);
  const limit = Math.max(1, options?.limit ?? 500);

  const filtered = rows
    .filter((row) => row.useCount >= minUseCount)
    .filter((row) => row.originalKey.trim().length > 0 && row.correctedName.trim().length > 0)
    .sort((a, b) => b.useCount - a.useCount || a.originalKey.localeCompare(b.originalKey));

  const byKey = new Map<string, CorrectionDatasetSourceRow>();
  for (const row of filtered) {
    const prev = byKey.get(row.originalKey);
    if (!prev || row.useCount > prev.useCount) {
      byKey.set(row.originalKey, row);
    }
  }

  const exported = [...byKey.values()]
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, limit)
    .map(toCorrectionDatasetRow);

  return {
    exportedAt: new Date().toISOString(),
    minUseCount,
    count: exported.length,
    rows: exported,
  };
}

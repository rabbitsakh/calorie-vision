import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCorrectionDataset,
  correctionDatasetRowId,
  toCorrectionDatasetRow,
} from "./food-corrections-dataset.ts";

describe("buildCorrectionDataset", () => {
  it("filters by minUseCount and dedupes originalKey", () => {
    const exportPayload = buildCorrectionDataset(
      [
        {
          originalKey: "борщ",
          correctedName: "Борщ украинский",
          calories: 180,
          useCount: 5,
        },
        {
          originalKey: "борщ",
          correctedName: "Борщ",
          calories: 160,
          useCount: 2,
        },
        {
          originalKey: "чай",
          correctedName: "Чай чёрный",
          calories: 2,
          useCount: 1,
        },
      ],
      { minUseCount: 2 },
    );

    assert.equal(exportPayload.minUseCount, 2);
    assert.equal(exportPayload.count, 1);
    assert.equal(exportPayload.rows[0]?.correctedName, "Борщ украинский");
    assert.equal(exportPayload.rows[0]?.useCount, 5);
    assert.ok(!exportPayload.rows[0] || !("userId" in exportPayload.rows[0]));
  });

  it("keeps stable anonymized ids", () => {
    const id = correctionDatasetRowId({
      originalKey: "молоко 2.5%",
      correctedName: "Молоко 2,5%",
    });
    assert.match(id, /молоко/);
    const row = toCorrectionDatasetRow({
      originalKey: "a",
      correctedName: "B",
      calories: 10,
      useCount: 3,
    });
    assert.equal(row.id, correctionDatasetRowId(row));
  });
});

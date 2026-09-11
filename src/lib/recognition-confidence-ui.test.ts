import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confidenceShortLabel,
  formatConfidencePercent,
  getConfidenceTone,
  confidenceWhyHint,
  confidenceReshootHint,
  confidenceActionHint,
} from "./recognition-confidence-ui.ts";

test("formatConfidencePercent clamps and rounds", () => {
  assert.equal(formatConfidencePercent(0.856), "86%");
  assert.equal(formatConfidencePercent(1.2), "100%");
  assert.equal(formatConfidencePercent(-0.1), "0%");
});

test("getConfidenceTone uses threshold bands", () => {
  assert.equal(getConfidenceTone(0.82, 0.65), "high");
  assert.equal(getConfidenceTone(0.58, 0.65), "medium");
  assert.equal(getConfidenceTone(0.4, 0.65), "low");
});

test("confidenceShortLabel maps tone", () => {
  assert.match(confidenceShortLabel("low"), /Низкая/);
});

test("confidenceWhyHint explains medium and low", () => {
  assert.equal(confidenceWhyHint("high"), null);
  assert.match(confidenceWhyHint("medium") ?? "", /порции|названия/);
  assert.match(confidenceWhyHint("low") ?? "", /проверить|неоднознач/);
});

test("confidenceReshootHint only for low", () => {
  assert.equal(confidenceReshootHint("high"), null);
  assert.equal(confidenceReshootHint("medium"), null);
  assert.match(confidenceReshootHint("low") ?? "", /Переснимите/);
  assert.match(confidenceReshootHint("low", { photoKind: "package" }) ?? "", /упаковк/);
});

test("confidenceWhyHint drink-aware medium and low", () => {
  assert.match(confidenceWhyHint("medium", { dishName: "Апельсиновый сок" }) ?? "", /мл|объём/i);
  assert.match(confidenceWhyHint("low", { dishName: "Кофе латте" }) ?? "", /бутылк|налив|объём/i);
  assert.match(confidenceWhyHint("medium", { isDrink: true }) ?? "", /мл|объём/i);
  assert.match(confidenceWhyHint("medium", { dishName: "Борщ" }) ?? "", /порции|названия|упаковк/);
});

test("confidenceReshootHint drink-aware low", () => {
  assert.match(
    confidenceReshootHint("low", { dishName: "Пиво светлое" }) ?? "",
    /этикетк|налив|объём/i,
  );
  assert.match(
    confidenceReshootHint("low", { isDrink: true, photoKind: "package" }) ?? "",
    /бутылк|налив|этикетк/i,
  );
});

test("confidenceActionHint drink medium mentions volume", () => {
  assert.match(confidenceActionHint("medium", { dishName: "Молоко 2.5%" }) ?? "", /мл|объём/i);
});

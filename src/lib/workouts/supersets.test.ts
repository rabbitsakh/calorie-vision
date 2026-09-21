import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupBySuperset,
  nextSupersetLetter,
  parseSupersetGroup,
} from "./supersets.ts";

test("parseSupersetGroup", () => {
  assert.equal(parseSupersetGroup("a"), "A");
  assert.equal(parseSupersetGroup(""), null);
  assert.equal(parseSupersetGroup(null), null);
  assert.equal(parseSupersetGroup(undefined), undefined);
  assert.equal(parseSupersetGroup("!!"), null);
});

test("groupBySuperset keeps contiguous letters together", () => {
  const groups = groupBySuperset([
    { id: "1", sortOrder: 0, supersetGroup: "A" },
    { id: "2", sortOrder: 1, supersetGroup: "A" },
    { id: "3", sortOrder: 2, supersetGroup: null },
    { id: "4", sortOrder: 3, supersetGroup: "B" },
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0]!.group, "A");
  assert.equal(groups[0]!.items.length, 2);
  assert.equal(groups[1]!.group, null);
  assert.equal(groups[2]!.group, "B");
});

test("nextSupersetLetter", () => {
  assert.equal(nextSupersetLetter(["A", "B"]), "C");
  assert.equal(nextSupersetLetter([]), "A");
});

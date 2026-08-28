import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claimSaveCheerForFullscreen,
  clearSaveCheerPending,
  isSaveCheerClaimedByFullscreen,
  markSaveCheerPending,
} from "./save-cheer-coordination.ts";

test("fullscreen celebration suppresses pending save toast", () => {
  markSaveCheerPending();
  assert.equal(isSaveCheerClaimedByFullscreen(), false);
  claimSaveCheerForFullscreen();
  assert.equal(isSaveCheerClaimedByFullscreen(), true);
  clearSaveCheerPending();
  assert.equal(isSaveCheerClaimedByFullscreen(), false);
});

test("claim outside window does not suppress", () => {
  markSaveCheerPending();
  claimSaveCheerForFullscreen();
  assert.equal(isSaveCheerClaimedByFullscreen(), true);
  clearSaveCheerPending();
  markSaveCheerPending();
  assert.equal(isSaveCheerClaimedByFullscreen(), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyUndo,
  popUndoStack,
  pushUndoStack,
  shouldOfferWriteRetry,
  undoHasItems,
} from "@/lib/assistant-chat-ux";

test("undoHasItems", () => {
  assert.equal(undoHasItems(emptyUndo()), false);
  assert.equal(undoHasItems({ ...emptyUndo(), mealIds: ["a"] }), true);
});

test("pushUndoStack keeps last N", () => {
  let stack = pushUndoStack([], { ...emptyUndo(), mealIds: ["1"] });
  stack = pushUndoStack(stack, { ...emptyUndo(), mealIds: ["2"] });
  stack = pushUndoStack(stack, null);
  assert.equal(stack.length, 2);
  assert.deepEqual(stack[1]?.mealIds, ["2"]);
});

test("popUndoStack", () => {
  const stacked = pushUndoStack(
    pushUndoStack([], { ...emptyUndo(), waterIds: ["w1"] }),
    { ...emptyUndo(), mealIds: ["m1"] },
  );
  const { stack, popped } = popUndoStack(stacked);
  assert.deepEqual(popped?.mealIds, ["m1"]);
  assert.equal(stack.length, 1);
  assert.deepEqual(popUndoStack([]).popped, null);
});

test("shouldOfferWriteRetry only on explicit miss", () => {
  assert.equal(shouldOfferWriteRetry({ wrote: false, wantsWrite: true }), true);
  assert.equal(shouldOfferWriteRetry({ wrote: true, wantsWrite: true }), false);
  assert.equal(shouldOfferWriteRetry({ wrote: false, wantsWrite: false }), false);
  assert.equal(shouldOfferWriteRetry({ wrote: null, wantsWrite: true }), false);
});

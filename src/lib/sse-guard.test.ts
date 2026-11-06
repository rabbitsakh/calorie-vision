import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGuardedSse,
  isClosedControllerError,
  settleGuardedSse,
  type SseByteSink,
} from "./sse-guard.ts";

const CLOSED = "Invalid state: Controller is already closed";

function fakeController(): SseByteSink & {
  chunks: string[];
  state: "open" | "closed";
  closeCalls: number;
} {
  const sink = {
    chunks: [] as string[],
    state: "open" as "open" | "closed",
    closeCalls: 0,
    enqueue(chunk: Uint8Array) {
      if (sink.state === "closed") throw new TypeError(CLOSED);
      sink.chunks.push(new TextDecoder().decode(chunk));
    },
    close() {
      sink.closeCalls += 1;
      if (sink.state === "closed") throw new TypeError(CLOSED);
      sink.state = "closed";
    },
  };
  return sink;
}

test("обрыв: enqueue и повторный close не бросают Controller is already closed", async () => {
  const cases: Array<"enqueue" | "close" | "both"> = ["enqueue", "close", "both"];
  for (const mode of cases) {
    const controller = fakeController();
    const sse = createGuardedSse(controller);
    controller.state = "closed";
    if (mode === "enqueue" || mode === "both") {
      assert.equal(sse.send("done", { recognition: { dishName: "Вода", calories: 0 } }), false);
    }
    assert.doesNotThrow(() => sse.close());
    assert.doesNotThrow(() => sse.close());
    assert.equal(sse.isClosed(), true);
  }
});

test("abort до записи не шлёт событие и не считает это ошибкой распознавания", async () => {
  const controller = fakeController();
  const signal = AbortSignal.abort();
  const sse = createGuardedSse(controller, { signal });
  const errors: unknown[] = [];
  await settleGuardedSse(
    sse,
    async () => {
      assert.equal(sse.send("vision", { recognition: { calories: 0 } }), false);
      throw new TypeError(CLOSED);
    },
    (error) => errors.push(error),
  );
  assert.equal(errors.length, 0);
  assert.equal(controller.chunks.length, 0);
  assert.equal(controller.closeCalls, 1);
});

test("настоящая ошибка модели уходит событием error и поток закрывается один раз", async () => {
  const controller = fakeController();
  const sse = createGuardedSse(controller);
  await settleGuardedSse(
    sse,
    async () => {
      sse.send("image", { imagePath: "/api/uploads/local-fixture" });
      throw new Error("Не удалось распознать фото");
    },
    (error) => {
      sse.send("error", { error: error instanceof Error ? error.message : "ошибка" });
    },
  );
  const text = controller.chunks.join("");
  assert.match(text, /event: image/);
  assert.match(text, /event: error/);
  assert.match(text, /Не удалось распознать фото/);
  assert.equal(controller.state, "closed");
  assert.equal(controller.closeCalls, 1);
  assert.equal(isClosedControllerError(new TypeError(CLOSED)), true);
  assert.equal(isClosedControllerError(new Error("Не удалось распознать фото")), false);
});

test("два потока не делят закрытие", async () => {
  const first = fakeController();
  const second = fakeController();
  const a = createGuardedSse(first);
  const b = createGuardedSse(second);
  first.state = "closed";
  assert.equal(a.send("done", { ok: false }), false);
  assert.equal(b.send("done", { calories: 0 }), true);
  b.close();
  assert.equal(second.state, "closed");
  assert.equal(first.closeCalls, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  decideStaleActionReload,
  isStaleServerActionError,
  isStaleServerActionLog,
} from "./stale-server-action.ts";

const notFound = new Error(
  'Failed to find Server Action "abc". This request might be from an older or newer deployment.',
);
const reference = new Error(
  'The Server Reference ID did not match the expected format. Received "%%%".',
);
const unrecognized = Object.assign(new Error('Server Action "abc" was not found on the server.'), {
  name: "UnrecognizedActionError",
});

test("устаревший id действия узнаётся, обычная ошибка нет", () => {
  assert.equal(isStaleServerActionError(notFound), true);
  assert.equal(isStaleServerActionError(reference), true);
  assert.equal(isStaleServerActionError(unrecognized), true);
  assert.equal(isStaleServerActionError({ __NEXT_ERROR_CODE: "E788", message: "" }), true);
  assert.equal(isStaleServerActionError(new Error("Не удалось записать подход")), false);
  assert.equal(isStaleServerActionError("database unavailable"), false);
});

test("такой лог гасится, соседние сообщения нет", () => {
  assert.equal(isStaleServerActionLog([notFound]), true);
  assert.equal(isStaleServerActionLog(["Failed to find Server Action"]), true);
  assert.equal(isStaleServerActionLog(["Calorie Vision listening", 3000]), false);
  assert.equal(isStaleServerActionLog([new Error("prisma timeout")]), false);
});

test("перезагрузка только один раз на этот заход", () => {
  assert.equal(decideStaleActionReload(notFound, false), "reload");
  assert.equal(decideStaleActionReload(notFound, true), "show");
  assert.equal(decideStaleActionReload(new Error("сеть"), false), "ignore");
});

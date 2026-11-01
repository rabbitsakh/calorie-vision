import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mealOwnedByUser,
  notFoundMealResponse,
  notFoundResourceResponse,
  resourceOwnedByUser,
  unauthorizedResponse,
} from "./api-auth-guards.ts";

describe("resourceOwnedByUser", () => {
  it("rejects missing / foreign, accepts owner", () => {
    assert.equal(resourceOwnedByUser(null, "user-a"), false);
    assert.equal(resourceOwnedByUser({ userId: "user-b" }, "user-a"), false);
    assert.equal(resourceOwnedByUser({ userId: "user-a" }, "user-a"), true);
    assert.equal(mealOwnedByUser({ userId: "user-a" }, "user-a"), true);
  });
});

describe("API auth response contracts", () => {
  it("unauthorized is 401 with stable copy", () => {
    assert.deepEqual(unauthorizedResponse(), {
      error: "Войдите в аккаунт",
      status: 401,
    });
  });

  it("foreign or missing meal looks like 404 (no leak)", () => {
    assert.deepEqual(notFoundMealResponse(), {
      error: "Запись не найдена",
      status: 404,
    });
  });

  it("workout miss uses 404 copy", () => {
    assert.deepEqual(notFoundResourceResponse("Тренировка"), {
      error: "Тренировка не найдена",
      status: 404,
    });
  });
});

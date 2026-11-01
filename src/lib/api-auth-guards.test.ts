import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mealOwnedByUser,
  notFoundMealResponse,
  unauthorizedResponse,
} from "./api-auth-guards.ts";

describe("mealOwnedByUser", () => {
  it("rejects missing meal", () => {
    assert.equal(mealOwnedByUser(null, "user-a"), false);
    assert.equal(mealOwnedByUser(undefined, "user-a"), false);
  });

  it("rejects foreign userId (IDOR)", () => {
    assert.equal(mealOwnedByUser({ userId: "user-b" }, "user-a"), false);
  });

  it("accepts owner", () => {
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
});

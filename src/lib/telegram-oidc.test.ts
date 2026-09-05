import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTelegramUserId } from "./telegram-oidc.ts";

describe("resolveTelegramUserId", () => {
  it("prefers numeric id claim over sub", () => {
    assert.equal(resolveTelegramUserId({ id: 987654321, sub: "opaque-sub" }), "987654321");
  });

  it("uses numeric sub when id is missing", () => {
    assert.equal(resolveTelegramUserId({ sub: "123456789" }), "123456789");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealTelegramOidcState, unsealTelegramOidcState } from "./telegram-oidc-state.ts";

describe("telegram OIDC sealed state", () => {
  it("round-trips a PKCE verifier", () => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-oidc-state";
    const state = sealTelegramOidcState("verifier-value-123");
    const opened = unsealTelegramOidcState(state);
    assert.ok(opened);
    assert.equal(opened.verifier, "verifier-value-123");
  });

  it("rejects tampered state", () => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-oidc-state";
    const state = sealTelegramOidcState("verifier-value-123");
    assert.equal(unsealTelegramOidcState(`${state}x`), null);
  });

  it("rejects expired state", () => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-oidc-state";
    const state = sealTelegramOidcState("verifier-value-123", -10);
    assert.equal(unsealTelegramOidcState(state), null);
  });
});

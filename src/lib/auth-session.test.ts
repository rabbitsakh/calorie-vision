import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unauthorizedResponse } from "./api-auth-guards.ts";

describe("requireSession contract", () => {
  it("401 body matches unauthorizedResponse (routes must stay in sync)", () => {
    // requireSession returns NextResponse.json({ error }, { status: 401 })
    // with the same copy — keep this assertion if either side changes.
    assert.deepEqual(unauthorizedResponse(), {
      error: "Войдите в аккаунт",
      status: 401,
    });
  });
});

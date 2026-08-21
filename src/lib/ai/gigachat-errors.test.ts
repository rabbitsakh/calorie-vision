import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatGigaChatHttpError } from "./gigachat-errors.ts";

describe("formatGigaChatHttpError", () => {
  it("maps 429 and Too Many Requests to Russian guidance", () => {
    assert.match(
      formatGigaChatHttpError(429, JSON.stringify({ message: "Too Many Requests" })),
      /Слишком много запросов/,
    );
    assert.match(formatGigaChatHttpError(200, "Too Many Requests"), /Слишком много запросов/);
  });

  it("maps auth and server errors", () => {
    assert.match(formatGigaChatHttpError(401, "{}"), /ключ GigaChat/);
    assert.match(formatGigaChatHttpError(503, "{}"), /временно недоступен/);
  });
});

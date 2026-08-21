import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  humanizeClientFetchError,
  messageForApiHttpStatus,
  readApiJson,
} from "./read-api-json.ts";

describe("messageForApiHttpStatus", () => {
  it("maps gateway and rate-limit statuses", () => {
    assert.match(messageForApiHttpStatus(504), /не успел обработать/);
    assert.match(messageForApiHttpStatus(429), /минуты/);
    assert.match(messageForApiHttpStatus(413), /слишком большое/i);
  });

  it("detects HTML error pages", () => {
    assert.match(
      messageForApiHttpStatus(200, "<!DOCTYPE html><html><body>502</body></html>"),
      /ответ сервера/,
    );
  });
});

describe("humanizeClientFetchError", () => {
  it("hides Safari JSON pattern noise", () => {
    assert.match(
      humanizeClientFetchError(
        new Error("The string did not match the expected pattern."),
        "fallback",
      ),
      /ответ сервера/,
    );
  });

  it("keeps useful Russian API errors", () => {
    assert.equal(
      humanizeClientFetchError(new Error("Фото не найдено"), "fallback"),
      "Фото не найдено",
    );
  });
});

describe("readApiJson", () => {
  it("parses JSON bodies", async () => {
    const response = new Response(JSON.stringify({ error: "ok" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    const data = await readApiJson<{ error?: string }>(response);
    assert.equal(data.error, "ok");
  });

  it("throws a Russian message for empty and HTML bodies", async () => {
    await assert.rejects(
      () => readApiJson(new Response("", { status: 504 })),
      /не успел обработать/,
    );
    await assert.rejects(
      () =>
        readApiJson(
          new Response("<html>timeout</html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
        ),
      /не успел обработать|ответ сервера|временно/,
    );
  });
});

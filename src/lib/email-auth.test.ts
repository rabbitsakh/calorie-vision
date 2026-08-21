import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmailLoginConfigured, resolveEmailServer } from "./email-auth.ts";

describe("resolveEmailServer", () => {
  it("returns null when nothing is configured", () => {
    const prev = {
      EMAIL_SERVER: process.env.EMAIL_SERVER,
      EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
      EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
      EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    };

    delete process.env.EMAIL_SERVER;
    delete process.env.EMAIL_SERVER_HOST;
    delete process.env.EMAIL_SERVER_USER;
    delete process.env.EMAIL_SERVER_PASSWORD;

    try {
      assert.equal(resolveEmailServer(), null);
      assert.equal(isEmailLoginConfigured(), false);
    } finally {
      restoreEnv(prev);
    }
  });

  it("prefers discrete host/user/password over connection string", () => {
    const prev = {
      EMAIL_SERVER: process.env.EMAIL_SERVER,
      EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
      EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
      EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
      EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    };

    process.env.EMAIL_SERVER = "smtp://old:pass@smtp.example.com:587";
    process.env.EMAIL_SERVER_HOST = "smtp.yandex.ru";
    process.env.EMAIL_SERVER_USER = "noreply@calorievision.ru";
    process.env.EMAIL_SERVER_PASSWORD = "p@ss:word";
    process.env.EMAIL_SERVER_PORT = "465";

    try {
      assert.deepEqual(resolveEmailServer(), {
        host: "smtp.yandex.ru",
        port: 465,
        secure: true,
        auth: { user: "noreply@calorievision.ru", pass: "p@ss:word" },
      });
      assert.equal(isEmailLoginConfigured(), true);
    } finally {
      restoreEnv(prev);
    }
  });

  it("falls back to EMAIL_SERVER connection string", () => {
    const prev = {
      EMAIL_SERVER: process.env.EMAIL_SERVER,
      EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
      EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
      EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
    };

    process.env.EMAIL_SERVER = "smtp://user:pass@smtp.example.com:587";
    delete process.env.EMAIL_SERVER_HOST;
    delete process.env.EMAIL_SERVER_USER;
    delete process.env.EMAIL_SERVER_PASSWORD;

    try {
      assert.equal(resolveEmailServer(), "smtp://user:pass@smtp.example.com:587");
    } finally {
      restoreEnv(prev);
    }
  });
});

function restoreEnv(prev: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(prev)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

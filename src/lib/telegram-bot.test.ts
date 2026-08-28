import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TELEGRAM_BOT_USERNAME,
  buildTelegramWebhookUrl,
  formatTelegramFetchError,
  getTelegramBotUsername,
  parseTelegramCommand,
  telegramBotDeepLink,
  telegramRemindHelpText,
  telegramStartReplyText,
  verifyTelegramWebhookSecret,
} from "./telegram-bot.ts";

test("telegramStartReplyText mentions ration, commands and bot username", () => {
  const text = telegramStartReplyText();
  assert.match(text, /calorievision\.ru\/ration/);
  assert.match(text, /\/start/);
  assert.match(text, /\/remind/);
  assert.match(text, new RegExp(`@${DEFAULT_TELEGRAM_BOT_USERNAME}`));
});

test("telegramRemindHelpText points to push settings", () => {
  const text = telegramRemindHelpText();
  assert.match(text, /push/i);
  assert.match(text, /calorievision\.ru\/ration/);
});

test("telegramBotDeepLink uses public username when set", () => {
  const prev = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "@CalorieVisionBot";
  assert.equal(telegramBotDeepLink(), "https://t.me/CalorieVisionBot");
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = prev;
});

test("telegramBotDeepLink falls back to CalorieVisionAppBot", () => {
  const prev = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  assert.equal(telegramBotDeepLink(), "https://t.me/CalorieVisionAppBot");
  assert.equal(getTelegramBotUsername(), "CalorieVisionAppBot");
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = prev;
});

test("parseTelegramCommand handles /start@BotName", () => {
  assert.equal(parseTelegramCommand("/start"), "/start");
  assert.equal(parseTelegramCommand("/start@CalorieVisionAppBot"), "/start");
  assert.equal(parseTelegramCommand("/remind help"), "/remind");
  assert.equal(parseTelegramCommand("hello"), "");
});

test("buildTelegramWebhookUrl encodes secret", () => {
  const url = buildTelegramWebhookUrl("https://calorievision.ru", "tok/en+");
  assert.equal(
    url,
    "https://calorievision.ru/api/telegram/webhook?secret=tok%2Fen%2B",
  );
});

test("formatTelegramFetchError adds hint for fetch failed", () => {
  const text = formatTelegramFetchError(
    new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") }),
  );
  assert.match(text, /fetch failed/);
  assert.match(text, /curl -4/);
});

test("verifyTelegramWebhookSecret accepts query secret matching token", () => {
  const prev = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
  const ok = verifyTelegramWebhookSecret({
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams("secret=test-bot-token") },
  });
  assert.equal(ok, true);
  const bad = verifyTelegramWebhookSecret({
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams("secret=wrong") },
  });
  assert.equal(bad, false);
  process.env.TELEGRAM_BOT_TOKEN = prev;
});

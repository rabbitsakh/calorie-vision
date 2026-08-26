import assert from "node:assert/strict";
import { test } from "node:test";
import {
  telegramBotDeepLink,
  telegramRemindHelpText,
  telegramStartReplyText,
  verifyTelegramWebhookSecret,
} from "./telegram-bot.ts";

test("telegramStartReplyText mentions ration and commands", () => {
  const text = telegramStartReplyText();
  assert.match(text, /calorievision\.ru\/ration/);
  assert.match(text, /\/start/);
  assert.match(text, /\/remind/);
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

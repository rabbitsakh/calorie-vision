import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedAvatarUrl, isRemoteHttpUrl } from "./avatar-url";

test("isAllowedAvatarUrl accepts Google / Yandex / VK / Telegram hosts", () => {
  assert.equal(
    isAllowedAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocExample=s96-c"),
    true,
  );
  assert.equal(
    isAllowedAvatarUrl("https://avatars.yandex.net/get-yapic/123/islands-200"),
    true,
  );
  assert.equal(isAllowedAvatarUrl("https://sun1-89.userapi.com/impg/abc.jpg"), true);
  assert.equal(
    isAllowedAvatarUrl("https://t.me/i/userpic/320/username.jpg"),
    true,
  );
  assert.equal(
    isAllowedAvatarUrl("https://cdn4.telesco.pe/file/abc.jpg"),
    true,
  );
});

test("isAllowedAvatarUrl rejects http and arbitrary hosts", () => {
  assert.equal(isAllowedAvatarUrl("http://lh3.googleusercontent.com/a.jpg"), false);
  assert.equal(isAllowedAvatarUrl("https://evil.example/a.jpg"), false);
  assert.equal(isAllowedAvatarUrl("not-a-url"), false);
});

test("isRemoteHttpUrl", () => {
  assert.equal(isRemoteHttpUrl("https://x.test/a.png"), true);
  assert.equal(isRemoteHttpUrl("/api/uploads/abc"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  CAP_RESUME_TOKEN_KEY,
  capacitorResumeConsumeUrl,
  clearCapacitorResumeToken,
  getCapacitorResumeToken,
} from "./capacitor-resume.ts";

test("resume prefs key is stable", () => {
  assert.equal(CAP_RESUME_TOKEN_KEY, "cv_cap_resume_token_v1");
});

test("consume URL encodes token", () => {
  const url = capacitorResumeConsumeUrl("abc/def", "https://calorievision.ru");
  assert.equal(
    url,
    "https://calorievision.ru/api/auth/capacitor-resume?token=abc%2Fdef",
  );
});

test("get/clear are no-ops on web", async () => {
  assert.equal(await getCapacitorResumeToken(), null);
  await clearCapacitorResumeToken();
  assert.equal(await getCapacitorResumeToken(), null);
});

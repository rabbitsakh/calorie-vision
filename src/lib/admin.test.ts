import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_EMAIL,
  ADMIN_PAGE_SIZE,
  isAdminEmail,
  parseAdminPageOffset,
  parseAdminPageSize,
} from "./admin.ts";

test("recognizes the admin email regardless of case and spaces", () => {
  assert.equal(isAdminEmail(ADMIN_EMAIL), true);
  assert.equal(isAdminEmail("  RabbitSakh@Gmail.com "), true);
  assert.equal(isAdminEmail("other@gmail.com"), false);
  assert.equal(isAdminEmail(null), false);
  assert.equal(isAdminEmail(undefined), false);
  assert.equal(isAdminEmail(""), false);
});

test("parses admin list pagination", () => {
  assert.equal(parseAdminPageOffset(null), 0);
  assert.equal(parseAdminPageOffset("-3"), 0);
  assert.equal(parseAdminPageOffset("20"), 20);
  assert.equal(parseAdminPageSize(null), ADMIN_PAGE_SIZE);
  assert.equal(parseAdminPageSize("10"), 10);
  assert.equal(parseAdminPageSize("999"), 50);
  assert.equal(parseAdminPageSize("0"), 1);
});

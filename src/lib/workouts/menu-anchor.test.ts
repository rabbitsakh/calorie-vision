import assert from "node:assert/strict";
import test from "node:test";
import { menuAnchor } from "./menu-anchor.ts";

test("меню отдыха открывается под кнопкой, а не у низа страницы", () => {
  const box = menuAnchor({
    buttonTop: 80,
    buttonBottom: 124,
    buttonRight: 320,
    viewportHeight: 800,
    viewportWidth: 390,
    menuWidth: 176,
    menuHeight: 280,
  });
  assert.equal(box.top, 128);
  assert.ok(box.top + 280 < 800);
  assert.ok(box.left >= 8);
  assert.ok(box.left + 176 <= 390);
});

test("у нижнего края меню остаётся в видимой области", () => {
  const box = menuAnchor({
    buttonTop: 700,
    buttonBottom: 744,
    buttonRight: 360,
    viewportHeight: 800,
    viewportWidth: 390,
    menuWidth: 176,
    menuHeight: 280,
  });
  assert.ok(box.top >= 8);
  assert.ok(box.top + 280 <= 800 - 8);
  assert.ok(box.top < 700);
});

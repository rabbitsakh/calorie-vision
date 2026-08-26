import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCelebrationPortalHost,
  syncCelebrationPortalToVisualViewport,
} from "./celebration-portal.ts";

test("getCelebrationPortalHost returns null without document", () => {
  const hadDocument = typeof document !== "undefined";
  if (!hadDocument) {
    assert.equal(getCelebrationPortalHost(), null);
  }
});

test("getCelebrationPortalHost creates a fixed host on documentElement", () => {
  const html = {
    appendChild(this: unknown, node: { id: string }) {
      (globalThis as { __host?: unknown }).__host = node;
      return node;
    },
  };
  const created: {
    id: string;
    style: { cssText: string; top?: string; left?: string; width?: string; height?: string };
    setAttribute: (k: string, v: string) => void;
  }[] = [];
  (globalThis as { document?: unknown }).document = {
    getElementById: (id: string) => created.find((n) => n.id === id) ?? null,
    createElement: () => {
      const node = {
        id: "",
        style: { cssText: "" },
        setAttribute() {},
      };
      created.push(node);
      return node;
    },
    documentElement: html,
  };
  const host = getCelebrationPortalHost();
  assert.ok(host);
  assert.equal(host!.id, "cv-fs-celeb-host");
  assert.match(host!.style.cssText, /position:fixed/);
  assert.match(host!.style.cssText, /inset:0/);
  assert.match(host!.style.cssText, /width:auto/);
  assert.doesNotMatch(host!.style.cssText, /100vw/);
  delete (globalThis as { document?: unknown }).document;
});

test("syncCelebrationPortalToVisualViewport uses visualViewport when present", () => {
  const el = {
    style: {
      top: "",
      left: "",
      right: "",
      bottom: "",
      width: "",
      height: "",
    },
  };
  (globalThis as { window?: unknown }).window = {
    visualViewport: { offsetTop: 12, offsetLeft: 4, width: 390.4, height: 700.6 },
  };
  syncCelebrationPortalToVisualViewport(el as unknown as HTMLElement);
  assert.equal(el.style.top, "12px");
  assert.equal(el.style.left, "4px");
  assert.equal(el.style.right, "auto");
  assert.equal(el.style.bottom, "auto");
  assert.equal(el.style.width, "390px");
  assert.equal(el.style.height, "701px");
  delete (globalThis as { window?: unknown }).window;
});

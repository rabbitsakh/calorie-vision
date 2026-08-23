import assert from "node:assert/strict";
import { test } from "node:test";
import { getCelebrationPortalHost } from "./celebration-portal.ts";

test("getCelebrationPortalHost returns null without document", () => {
  // Node test env has no DOM by default for this module's first call path —
  // when document is undefined the helper returns null.
  const hadDocument = typeof document !== "undefined";
  if (!hadDocument) {
    assert.equal(getCelebrationPortalHost(), null);
  }
});

test("getCelebrationPortalHost creates a fixed host on documentElement", () => {
  // Minimal DOM stub for the helper.
  const html = { appendChild(this: unknown, node: { id: string }) { (globalThis as { __host?: unknown }).__host = node; return node; } };
  const created: { id: string; style: { cssText: string }; setAttribute: (k: string, v: string) => void }[] = [];
  (globalThis as { document?: unknown }).document = {
    getElementById: (id: string) => (created.find((n) => n.id === id) ?? null),
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
  assert.match(host!.style.cssText, /width:100vw/);
  // Cleanup stub so other tests are unaffected.
  delete (globalThis as { document?: unknown }).document;
});

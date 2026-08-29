import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeCelebrationPortal,
  getCelebrationPortalHost,
  openCelebrationPortal,
} from "./celebration-portal.ts";

function makeStyle() {
  const props = new Map<string, string>();
  const style: {
    cssText: string;
    pointerEvents: string;
    setProperty: (name: string, value: string, priority?: string) => void;
  } = {
    cssText: "",
    pointerEvents: "",
    setProperty(name: string, value: string, _priority?: string) {
      if (name === "pointer-events") {
        this.pointerEvents = value;
      }
      props.set(name, value);
      this.cssText = [...props.entries()].map(([k, v]) => `${k}:${v}`).join(";");
    },
  };
  return style;
}

test("getCelebrationPortalHost returns null without document", () => {
  const hadDocument = typeof document !== "undefined";
  if (!hadDocument) {
    assert.equal(getCelebrationPortalHost(), null);
  }
});

test("getCelebrationPortalHost creates a div host on documentElement", () => {
  const html = {
    appendChild(this: unknown, node: { id: string }) {
      (globalThis as { __host?: unknown }).__host = node;
      return node;
    },
  };
  const created: {
    id: string;
    tagName: string;
    style: ReturnType<typeof makeStyle>;
    setAttribute: (k: string, v: string) => void;
    getAttribute: (k: string) => string | null;
    removeAttribute: (k: string) => void;
    remove: () => void;
  }[] = [];
  const attrs = new Map<string, string>();
  (globalThis as { document?: unknown; window?: unknown }).document = {
    getElementById: (id: string) => created.find((n) => n.id === id) ?? null,
    createElement: (tag: string) => {
      const node = {
        id: "",
        tagName: tag.toUpperCase(),
        style: makeStyle(),
        setAttribute(k: string, v: string) {
          attrs.set(k, v);
        },
        getAttribute(k: string) {
          return attrs.get(k) ?? null;
        },
        removeAttribute(k: string) {
          attrs.delete(k);
        },
        remove() {
          const idx = created.indexOf(node);
          if (idx >= 0) created.splice(idx, 1);
        },
      };
      created.push(node);
      return node;
    },
    documentElement: html,
  };
  (globalThis as { window?: unknown }).window = {
    innerWidth: 390,
    innerHeight: 844,
  };
  const host = getCelebrationPortalHost();
  assert.ok(host);
  assert.equal(host!.id, "cv-fs-celeb-host");
  assert.equal((host as { tagName: string }).tagName, "DIV");
  const css = host!.style.cssText;
  assert.match(css, /position:\s*fixed/i);
  assert.match(css, /width:\s*390px/i);
  assert.match(css, /height:\s*844px/i);
  assert.doesNotMatch(css, /100vw/);
  delete (globalThis as { document?: unknown }).document;
  delete (globalThis as { window?: unknown }).window;
});

test("getCelebrationPortalHost replaces leftover dialog hosts", () => {
  const removed: string[] = [];
  const dialog = {
    id: "cv-fs-celeb-host",
    tagName: "DIALOG",
    open: true,
    style: makeStyle(),
    setAttribute() {},
    getAttribute() {
      return null;
    },
    removeAttribute() {},
    remove() {
      removed.push("dialog");
    },
    close() {
      this.open = false;
    },
  };
  const created: unknown[] = [];
  const html = {
    appendChild(node: unknown) {
      created.push(node);
      return node;
    },
  };
  let lookup: unknown = dialog;
  (globalThis as { document?: unknown; window?: unknown }).document = {
    getElementById: (id: string) =>
      id === "cv-fs-celeb-host" ? lookup : null,
    createElement: (tag: string) => {
      const node = {
        id: "",
        tagName: tag.toUpperCase(),
        style: makeStyle(),
        setAttribute() {},
        getAttribute() {
          return null;
        },
        removeAttribute() {},
        remove() {},
      };
      lookup = node;
      return node;
    },
    documentElement: html,
  };
  (globalThis as { window?: unknown }).window = {
    innerWidth: 390,
    innerHeight: 844,
  };
  const host = getCelebrationPortalHost();
  assert.ok(host);
  assert.equal((host as { tagName: string }).tagName, "DIV");
  assert.deepEqual(removed, ["dialog"]);
  delete (globalThis as { document?: unknown }).document;
  delete (globalThis as { window?: unknown }).window;
});

test("openCelebrationPortal enables pointer events; close disables", () => {
  const attrs = new Map<string, string>();
  const el = {
    style: makeStyle(),
    setAttribute(k: string, v: string) {
      attrs.set(k, v);
    },
    removeAttribute(k: string) {
      attrs.delete(k);
    },
    getAttribute(k: string) {
      return attrs.get(k) ?? null;
    },
  };
  (globalThis as { window?: unknown }).window = {
    innerWidth: 390,
    innerHeight: 844,
  };
  openCelebrationPortal(el as unknown as HTMLElement);
  assert.equal(el.style.pointerEvents, "auto");
  assert.equal(attrs.get("data-cv-celeb-open"), "1");
  closeCelebrationPortal(el as unknown as HTMLElement);
  assert.equal(el.style.pointerEvents, "none");
  assert.equal(attrs.has("data-cv-celeb-open"), false);
  delete (globalThis as { window?: unknown }).window;
});

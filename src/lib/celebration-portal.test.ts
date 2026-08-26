import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeCelebrationPortal,
  getCelebrationPortalHost,
  openCelebrationPortal,
} from "./celebration-portal.ts";

test("getCelebrationPortalHost returns null without document", () => {
  const hadDocument = typeof document !== "undefined";
  if (!hadDocument) {
    assert.equal(getCelebrationPortalHost(), null);
  }
});

test("getCelebrationPortalHost creates a dialog host on documentElement", () => {
  const html = {
    appendChild(this: unknown, node: { id: string }) {
      (globalThis as { __host?: unknown }).__host = node;
      return node;
    },
  };
  const created: {
    id: string;
    open?: boolean;
    style: { cssText: string; pointerEvents?: string };
    setAttribute: (k: string, v: string) => void;
    showModal?: () => void;
    close?: () => void;
  }[] = [];
  (globalThis as { document?: unknown }).document = {
    getElementById: (id: string) => created.find((n) => n.id === id) ?? null,
    createElement: (tag: string) => {
      const node = {
        id: "",
        open: false,
        style: { cssText: "", pointerEvents: "" },
        setAttribute() {},
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        tagName: tag.toUpperCase(),
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
  assert.match(host!.style.cssText, /width:100%/);
  assert.doesNotMatch(host!.style.cssText, /100vw/);
  delete (globalThis as { document?: unknown }).document;
});

test("openCelebrationPortal calls showModal and closeCelebrationPortal closes", () => {
  let modalOpen = false;
  const el = {
    open: false,
    style: { cssText: "", pointerEvents: "" },
    showModal() {
      modalOpen = true;
      this.open = true;
    },
    close() {
      modalOpen = false;
      this.open = false;
    },
  };
  openCelebrationPortal(el as unknown as HTMLElement);
  assert.equal(modalOpen, true);
  assert.equal(el.style.pointerEvents, "auto");
  closeCelebrationPortal(el as unknown as HTMLElement);
  assert.equal(modalOpen, false);
  assert.equal(el.style.pointerEvents, "none");
});

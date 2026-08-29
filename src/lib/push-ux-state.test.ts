import assert from "node:assert/strict";
import { test } from "node:test";
import type { PushCapability } from "./push-client.ts";
import {
  pushUxMatrixSteps,
  resolvePushUxState,
} from "./push-ux-state.ts";

function cap(partial: Partial<PushCapability> & Pick<PushCapability, "kind">): PushCapability {
  return {
    canSubscribe: false,
    isIos: false,
    isStandalone: false,
    permission: "default",
    title: "t",
    detail: "d",
    ...partial,
  };
}

test("ios browser → install-needed", () => {
  const state = resolvePushUxState({
    capability: cap({ kind: "ios-browser", isIos: true, isStandalone: false }),
    serverSubscribed: false,
  });
  assert.equal(state.id, "install-needed");
  assert.equal(state.primaryAction, "install");
});

test("denied on iOS → reinstall action", () => {
  const state = resolvePushUxState({
    capability: cap({
      kind: "denied",
      isIos: true,
      isStandalone: true,
      permission: "denied",
      canSubscribe: false,
    }),
    serverSubscribed: false,
  });
  assert.equal(state.id, "permission-denied");
  assert.equal(state.primaryAction, "reinstall");
  assert.match(state.detail, /удалите иконку/i);
});

test("granted without server sub → needs-resync", () => {
  const state = resolvePushUxState({
    capability: cap({
      kind: "granted",
      permission: "granted",
      canSubscribe: true,
      isStandalone: true,
    }),
    serverSubscribed: false,
  });
  assert.equal(state.id, "needs-resync");
  assert.equal(state.primaryAction, "resync");
});

test("granted + subscribed → active", () => {
  const state = resolvePushUxState({
    capability: cap({
      kind: "granted",
      permission: "granted",
      canSubscribe: true,
      isStandalone: true,
    }),
    serverSubscribed: true,
  });
  assert.equal(state.id, "active");
  assert.equal(state.tone, "ok");
});

test("default permission → ready-to-enable", () => {
  const state = resolvePushUxState({
    capability: cap({ kind: "default", canSubscribe: true, permission: "default" }),
    serverSubscribed: false,
  });
  assert.equal(state.id, "ready-to-enable");
  assert.equal(state.primaryAction, "enable");
});

test("matrix steps mark install → permission → subscription", () => {
  const steps = pushUxMatrixSteps("ready-to-enable");
  assert.equal(steps.length, 3);
  assert.equal(steps[0]?.status, "done");
  assert.equal(steps[1]?.status, "current");
  assert.equal(steps[2]?.status, "todo");
});

test("matrix for needs-resync highlights sync", () => {
  const steps = pushUxMatrixSteps("needs-resync");
  assert.equal(steps[2]?.status, "current");
  assert.equal(steps[2]?.label, "Синхронизация");
});

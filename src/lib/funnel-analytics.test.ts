import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  createHttpFunnelProvider,
  createMemoryFunnelProvider,
  hashFunnelUserId,
  isMealConfirmInput,
  resetFunnelActivityForTests,
  resolveFunnelProviders,
  sanitizeFunnelProps,
  selectReturnEvents,
  setFunnelProvidersForTests,
  trackFunnelEvent,
  FUNNEL_DAY_MS,
} from "./funnel-analytics.ts";

describe("funnel privacy", () => {
  it("hashes the user id and does not keep the raw id", () => {
    const userId = "user-secret-id";
    const hash = hashFunnelUserId(userId, "salt");
    assert.equal(hash.length, 64);
    assert.equal(hash.includes(userId), false);
    assert.equal(hashFunnelUserId(userId, "salt"), hash);
    assert.notEqual(hashFunnelUserId(userId, "other"), hash);
  });

  it("drops emails and unknown props", () => {
    assert.deepEqual(
      sanitizeFunnelProps({
        count: 2.4,
        surface: "recognize",
        email: "a@b.c",
        dishName: "борщ",
      }),
      { count: 2, surface: "recognize" },
    );
  });
});

describe("meal confirm signal", () => {
  it("treats a recognition save as a confirm and ignores a manual add", () => {
    assert.equal(isMealConfirmInput({ recognitionSource: "gigachat" }), true);
    assert.equal(isMealConfirmInput({ imagePath: "/uploads/a.jpg" }), true);
    assert.equal(isMealConfirmInput({ recognitionSource: "  ", imagePath: "" }), false);
  });
});

describe("selectReturnEvents", () => {
  const createdAtMs = 1_000_000;

  it("ignores the signup day", () => {
    assert.deepEqual(
      selectReturnEvents({
        createdAtMs,
        nowMs: createdAtMs + FUNNEL_DAY_MS - 1,
        already: { day1: false, day7: false },
      }),
      [],
    );
  });

  it("marks day 1 inside the first week and day 7 after that", () => {
    assert.deepEqual(
      selectReturnEvents({
        createdAtMs,
        nowMs: createdAtMs + 2 * FUNNEL_DAY_MS,
        already: { day1: false, day7: false },
      }),
      ["day_1_return"],
    );
    assert.deepEqual(
      selectReturnEvents({
        createdAtMs,
        nowMs: createdAtMs + 8 * FUNNEL_DAY_MS,
        already: { day1: false, day7: false },
      }),
      ["day_7_return"],
    );
  });

  it("does not emit a milestone twice", () => {
    assert.deepEqual(
      selectReturnEvents({
        createdAtMs,
        nowMs: createdAtMs + 3 * FUNNEL_DAY_MS,
        already: { day1: true, day7: false },
      }),
      [],
    );
    assert.deepEqual(
      selectReturnEvents({
        createdAtMs,
        nowMs: createdAtMs + 10 * FUNNEL_DAY_MS,
        already: { day1: false, day7: true },
      }),
      [],
    );
  });
});

describe("funnel providers", () => {
  it("defaults to the self-hosted table and keeps HTTP off without a key", () => {
    const providers = resolveFunnelProviders({});
    assert.deepEqual(
      providers.map((provider) => provider.id),
      ["db"],
    );

    assert.deepEqual(
      resolveFunnelProviders({
        FUNNEL_ANALYTICS: "http",
        FUNNEL_ANALYTICS_HTTP_URL: "https://example.test/funnel",
      }).map((provider) => provider.id),
      [],
    );
  });

  it("fans out to HTTP only when a URL and key are both set", () => {
    const ids = resolveFunnelProviders({
      FUNNEL_ANALYTICS: "db",
      FUNNEL_ANALYTICS_HTTP_URL: "https://example.test/funnel",
      FUNNEL_ANALYTICS_HTTP_KEY: "secret",
    }).map((provider) => provider.id);
    assert.deepEqual(ids, ["db", "http"]);
  });

  it("turns the whole layer off", () => {
    assert.deepEqual(resolveFunnelProviders({ FUNNEL_ANALYTICS: "off" }), []);
  });
});

describe("trackFunnelEvent", () => {
  afterEach(() => {
    setFunnelProvidersForTests(null);
    resetFunnelActivityForTests();
  });

  it("records signup once and meal confirms every time", async () => {
    const memory = createMemoryFunnelProvider();
    setFunnelProvidersForTests([memory]);

    await trackFunnelEvent({ name: "signup", userId: "user-secret-id", once: true });
    await trackFunnelEvent({ name: "signup", userId: "user-secret-id", once: true });
    await trackFunnelEvent({
      name: "meal_confirmed",
      userId: "user-secret-id",
      once: false,
      props: { count: 1, dishName: "суп" },
    });
    await trackFunnelEvent({
      name: "meal_confirmed",
      userId: "user-secret-id",
      once: false,
      props: { count: 2 },
    });

    assert.deepEqual(
      memory.events.map((event) => event.name),
      ["signup", "meal_confirmed", "meal_confirmed"],
    );
    assert.equal(memory.events[0]?.userHash?.includes("user-secret-id"), false);
    assert.deepEqual(memory.events[1]?.props, { count: 1 });
  });

  it("posts a hashed payload and never the raw user id", async () => {
    const bodies: string[] = [];
    const http = createHttpFunnelProvider({
      url: "https://example.test/funnel",
      key: "secret",
      fetchFn: async (_url, init) => {
        bodies.push(String(init?.body ?? ""));
        return new Response(null, { status: 204 });
      },
    });
    setFunnelProvidersForTests([http]);

    await trackFunnelEvent({
      name: "paywall_view",
      userId: "user-secret-id",
      once: false,
      props: { surface: "recognize" },
    });

    assert.equal(bodies.length, 1);
    assert.equal(bodies[0]?.includes("user-secret-id"), false);
    assert.match(bodies[0] ?? "", /paywall_view/);
    assert.match(bodies[0] ?? "", /recognize/);
  });
});

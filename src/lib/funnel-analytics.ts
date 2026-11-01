import { createHash } from "crypto";

/**
 * First-party product funnel. Stores a salted user hash and a short event name —
 * no email, phone, photo, or meal text.
 *
 * FUNNEL_ANALYTICS=db (default) writes the MySQL table.
 * FUNNEL_ANALYTICS=off disables everything.
 * FUNNEL_ANALYTICS=http sends to FUNNEL_ANALYTICS_HTTP_URL only when
 * FUNNEL_ANALYTICS_HTTP_KEY is also set; otherwise that provider stays off.
 * With db (or the default), a configured HTTP endpoint is an extra fan-out.
 */

export const FUNNEL_EVENTS = [
  "signup",
  "first_photo_recognized",
  "meal_confirmed",
  "day_1_return",
  "day_7_return",
  "paywall_view",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export const FUNNEL_DAY_MS = 24 * 60 * 60 * 1000;

const ONCE_EVENTS = new Set<FunnelEventName>([
  "signup",
  "first_photo_recognized",
  "day_1_return",
  "day_7_return",
]);

const STRING_PROPS = new Set(["surface"]);
const NUMBER_PROPS = new Set(["count"]);

export type FunnelEventRecord = {
  name: FunnelEventName;
  userHash: string | null;
  props?: Record<string, string | number>;
  occurredAt: Date;
};

export interface FunnelAnalyticsProvider {
  readonly id: string;
  track(event: FunnelEventRecord): Promise<void>;
  has?(userHash: string, name: FunnelEventName): Promise<boolean>;
}

export type FunnelEnv = Record<string, string | undefined>;

const DEFAULT_HASH_SALT = "cv-funnel-v1";

let testProviders: FunnelAnalyticsProvider[] | null = null;
let warned = false;
const seenActivity = new Set<string>();

export function hashFunnelUserId(
  userId: string,
  salt = process.env.FUNNEL_HASH_SALT?.trim() || DEFAULT_HASH_SALT,
): string {
  return createHash("sha256").update(`${salt}:${userId}`).digest("hex");
}

export function sanitizeFunnelProps(
  props: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(props)) {
    if (NUMBER_PROPS.has(key) && typeof value === "number" && Number.isFinite(value)) {
      out[key] = Math.max(0, Math.min(100, Math.round(value)));
      continue;
    }
    if (
      STRING_PROPS.has(key) &&
      typeof value === "string" &&
      /^[a-z0-9_-]{1,32}$/.test(value)
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Photo confirm sheet → diary. Manual quick-add has neither field. */
export function isMealConfirmInput(body: {
  recognitionSource?: string | null;
  imagePath?: string | null;
}): boolean {
  return Boolean(body.recognitionSource?.trim() || body.imagePath?.trim());
}

/**
 * D1 is a return in [1d, 7d). D7 is the first return at or after 7 days.
 * A user who only comes back on day 10 counts for D7, not D1.
 */
export function selectReturnEvents(input: {
  createdAtMs: number;
  nowMs: number;
  already: { day1: boolean; day7: boolean };
}): Array<"day_1_return" | "day_7_return"> {
  if (!Number.isFinite(input.createdAtMs) || !Number.isFinite(input.nowMs)) return [];
  const age = input.nowMs - input.createdAtMs;
  if (age < FUNNEL_DAY_MS) return [];
  const due: Array<"day_1_return" | "day_7_return"> = [];
  if (!input.already.day1 && age < 7 * FUNNEL_DAY_MS) due.push("day_1_return");
  if (!input.already.day7 && age >= 7 * FUNNEL_DAY_MS) due.push("day_7_return");
  return due;
}

export function createMemoryFunnelProvider(): FunnelAnalyticsProvider & {
  events: FunnelEventRecord[];
} {
  const events: FunnelEventRecord[] = [];
  return {
    id: "memory",
    events,
    async has(userHash, name) {
      return events.some((event) => event.userHash === userHash && event.name === name);
    },
    async track(event) {
      events.push({ ...event, props: event.props ? { ...event.props } : undefined });
    },
  };
}

export function createHttpFunnelProvider(options: {
  url: string;
  key: string;
  fetchFn?: typeof fetch;
}): FunnelAnalyticsProvider {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    id: "http",
    async track(event) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2_000);
      try {
        await fetchFn(options.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.key}`,
          },
          body: JSON.stringify({
            event: event.name,
            userHash: event.userHash,
            props: event.props ?? {},
            occurredAt: event.occurredAt.toISOString(),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

const dbProvider: FunnelAnalyticsProvider = {
  id: "db",
  async track(event) {
    const { persistFunnelEvent } = await import("@/lib/funnel-analytics-store");
    await persistFunnelEvent(event);
  },
  async has(userHash, name) {
    const { hasFunnelEvent } = await import("@/lib/funnel-analytics-store");
    return hasFunnelEvent(userHash, name);
  },
};

export function resolveFunnelProviders(env: FunnelEnv = process.env): FunnelAnalyticsProvider[] {
  const mode = (env.FUNNEL_ANALYTICS ?? "db").trim().toLowerCase();
  if (mode === "off" || mode === "0" || mode === "false") return [];

  const httpUrl = env.FUNNEL_ANALYTICS_HTTP_URL?.trim();
  const httpKey = env.FUNNEL_ANALYTICS_HTTP_KEY?.trim();
  const http =
    httpUrl && httpKey ? createHttpFunnelProvider({ url: httpUrl, key: httpKey }) : null;

  if (mode === "http") return http ? [http] : [];

  const providers: FunnelAnalyticsProvider[] = [dbProvider];
  if (http && mode !== "memory") providers.push(http);
  if (mode === "memory") return [];
  return providers;
}

function activeProviders(): FunnelAnalyticsProvider[] {
  return testProviders ?? resolveFunnelProviders();
}

export function isFunnelAnalyticsEnabled(): boolean {
  return activeProviders().length > 0;
}

export function setFunnelProvidersForTests(providers: FunnelAnalyticsProvider[] | null): void {
  testProviders = providers;
}

export function resetFunnelActivityForTests(): void {
  seenActivity.clear();
  warned = false;
}

function warnOnce(error: unknown): void {
  if (warned) return;
  warned = true;
  const message = error instanceof Error ? error.message : "unknown error";
  console.warn(`funnel analytics skipped: ${message}`);
}

export async function trackFunnelEvent(input: {
  name: FunnelEventName;
  userId?: string | null;
  once?: boolean;
  props?: Record<string, string | number | boolean | null>;
  occurredAt?: Date;
}): Promise<void> {
  try {
    const providers = activeProviders();
    if (providers.length === 0) return;

    const userHash = input.userId ? hashFunnelUserId(input.userId) : null;
    const once = input.once ?? ONCE_EVENTS.has(input.name);
    if (once && userHash) {
      for (const provider of providers) {
        if (provider.has && (await provider.has(userHash, input.name))) return;
      }
    }

    const event: FunnelEventRecord = {
      name: input.name,
      userHash,
      props: sanitizeFunnelProps(input.props),
      occurredAt: input.occurredAt ?? new Date(),
    };

    await Promise.all(
      providers.map(async (provider) => {
        try {
          await provider.track(event);
        } catch (error) {
          warnOnce(error);
        }
      }),
    );
  } catch (error) {
    warnOnce(error);
  }
}

export function trackSignup(userId: string): void {
  void trackFunnelEvent({ name: "signup", userId, once: true });
}

export function trackFirstPhotoRecognized(userId: string): void {
  void trackFunnelEvent({ name: "first_photo_recognized", userId, once: true });
}

export function trackMealConfirmed(userId: string, count = 1): void {
  void trackFunnelEvent({
    name: "meal_confirmed",
    userId,
    once: false,
    props: { count },
  });
}

export function trackPaywallView(
  userId: string,
  surface: "recognize" | "recognize_stream",
): void {
  void trackFunnelEvent({
    name: "paywall_view",
    userId,
    once: false,
    props: { surface },
  });
}

async function recordReturnMilestones(userId: string, nowMs: number): Promise<void> {
  const { loadUserCreatedAt } = await import("@/lib/funnel-analytics-store");
  const createdAt = await loadUserCreatedAt(userId);
  if (!createdAt) return;

  const userHash = hashFunnelUserId(userId);
  const providers = activeProviders();
  let day1 = false;
  let day7 = false;
  for (const provider of providers) {
    if (!provider.has) continue;
    if (!day1 && (await provider.has(userHash, "day_1_return"))) day1 = true;
    if (!day7 && (await provider.has(userHash, "day_7_return"))) day7 = true;
  }

  const due = selectReturnEvents({
    createdAtMs: createdAt.getTime(),
    nowMs,
    already: { day1, day7 },
  });
  for (const name of due) {
    await trackFunnelEvent({ name, userId, once: true, occurredAt: new Date(nowMs) });
  }
}

/** Once per user per UTC day. Failures never affect the request. */
export function noteUserActivity(userId: string, nowMs = Date.now()): void {
  if (!userId || !isFunnelAnalyticsEnabled()) return;
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const key = `${userId}:${day}`;
  if (seenActivity.has(key)) return;
  seenActivity.add(key);
  if (seenActivity.size > 10_000) seenActivity.clear();
  void recordReturnMilestones(userId, nowMs).catch((error) => warnOnce(error));
}

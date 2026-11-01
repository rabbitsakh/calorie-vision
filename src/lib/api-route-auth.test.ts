import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";

process.env.DATABASE_URL ||= "mysql://calorie:password@127.0.0.1:3306/calorie_vision";
process.env.NEXTAUTH_SECRET ||= "test-secret-test-secret-test-secret";
process.env.NEXTAUTH_URL ||= "http://localhost:3000";
process.env.FUNNEL_ANALYTICS = "off";

// next-auth's getServerSession() reads next/headers and throws outside a request.
// Seed the CJS cache before any route import so anonymous calls return 401.
const require = createRequire(import.meta.url);
const nextAuthId = require.resolve("next-auth");
require.cache[nextAuthId] = {
  id: nextAuthId,
  filename: nextAuthId,
  loaded: true,
  exports: {
    async getServerSession() {
      return null;
    },
    default() {
      return async function unauthorized() {
        return new Response(JSON.stringify({ error: "Войдите в аккаунт" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      };
    },
  },
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Intentionally reachable without a session: health, login, OAuth start,
 * public VAPID key, and the guest photo trial.
 * capacitor-resume GET redeems a one-time token (redirect), POST needs a session.
 */
const PUBLIC_ROUTES = new Set([
  "GET /api/health",
  "HEAD /api/health",
  "OPTIONS /api/health",
  "GET /api/auth/[...nextauth]",
  "POST /api/auth/[...nextauth]",
  "GET /api/auth/login-options",
  "GET /api/auth/telegram/start",
  "GET /api/auth/telegram/callback",
  "GET /api/auth/native-bridge/consume",
  "GET /api/auth/capacitor-resume",
  "GET /api/push/vapid",
  "POST /api/recognize/guest",
]);

const ROOT = join(import.meta.dirname, "..", "..");
const API_ROOT = join(ROOT, "src", "app", "api");

type RouteCase = {
  method: HttpMethod;
  path: string;
  file: string;
  public: boolean;
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (name === "route.ts") acc.push(path);
  }
  return acc;
}

function exportedMethods(source: string): HttpMethod[] {
  const found = new Set<HttpMethod>();
  for (const match of source.matchAll(
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
  )) {
    found.add(match[1] as HttpMethod);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const named = part.trim().match(/^(?:[\w.]+\s+as\s+)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/);
      if (named) found.add(named[1] as HttpMethod);
    }
  }
  return HTTP_METHODS.filter((method) => found.has(method));
}

function toApiPath(file: string): string {
  const rel = relative(join(ROOT, "src", "app"), file).replace(/\\/g, "/");
  return `/${rel.replace(/\/route\.ts$/, "")}`;
}

const routeFiles = walk(API_ROOT).sort();
const cases: RouteCase[] = routeFiles.flatMap((file) => {
  const path = toApiPath(file);
  return exportedMethods(readFileSync(file, "utf8")).map((method) => ({
    method,
    path,
    file: relative(ROOT, file),
    public: PUBLIC_ROUTES.has(`${method} ${path}`),
  }));
});

const protectedCases = cases.filter((routeCase) => !routeCase.public);

describe("API route auth catalog", () => {
  it("covers every route file, including the public allowlist", () => {
    assert.ok(routeFiles.length >= 80, `expected ~85 route files, found ${routeFiles.length}`);
    assert.ok(protectedCases.length >= 70, `expected most routes to be protected, found ${protectedCases.length}`);
    const filesInCases = new Set(cases.map((routeCase) => routeCase.file));
    for (const file of routeFiles) {
      assert.ok(filesInCases.has(relative(ROOT, file)), `no methods discovered in ${file}`);
    }
  });
});

describe("protected API routes reject unauthenticated requests", () => {
  for (const routeCase of protectedCases) {
    it(`${routeCase.method} ${routeCase.path} → 401`, async () => {
      const mod = (await import(pathToFileURL(join(ROOT, routeCase.file)).href)) as Record<
        string,
        unknown
      >;
      const handler = mod[routeCase.method];
      assert.equal(typeof handler, "function", `${routeCase.file} exports ${routeCase.method}`);

      const request = new NextRequest(`http://localhost:3000${routeCase.path}`, {
        method: routeCase.method,
      });
      const response = await (handler as (req: NextRequest, ctx: unknown) => Promise<Response>)(
        request,
        {
          params: Promise.resolve({
            id: "abcdefabcdefabcdefabcdef",
            exerciseId: "abcdefabcdefabcdefabcdef",
            setId: "abcdefabcdefabcdefabcdef",
            nextauth: ["session"],
          }),
        },
      );

      assert.equal(response.status, 401, `${routeCase.method} ${routeCase.path}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("json")) {
        const body = (await response.json()) as { error?: string };
        assert.match(body.error ?? "", /Войдите в аккаунт|unauthorized|Unauthorized|Нет доступа/i);
      }
    });
  }
});

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";

// Edge bundle cannot import node:fs (readPackageVersion). Use build-injected env instead.
const releaseVersion =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || process.env.npm_package_version?.trim() || "0.0.0";

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  release: `calorie-vision@${releaseVersion}`,
  tracesSampleRate: 0.05,
  environment: process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV,
});

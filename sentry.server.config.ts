import * as Sentry from "@sentry/nextjs";
import { readPackageVersion } from "@/lib/read-package-version";

const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  release: `calorie-vision@${readPackageVersion()}`,
  tracesSampleRate: 0.05,
  environment: process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV,
});

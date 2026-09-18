import { withSentryConfig } from "@sentry/nextjs";
import { readPackageVersion } from "./src/lib/read-package-version";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const appVersion = readPackageVersion();

console.info(`Calorie Vision v${appVersion}`);

/** Parallel webpack workers spike RSS on small VPS and get SIGKILL'd by the OOM killer. */
const buildCpus = Number.parseInt(process.env.NEXT_BUILD_CPUS ?? "1", 10);

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  // CI packs `.next/standalone` and ships it to the VPS (no on-server `next build`).
  output: "standalone" as const,
  trailingSlash: true,
  // NextAuth callbacks and API POSTs break when Next.js 308-redirects them to a trailing slash.
  skipTrailingSlashRedirect: true,
  productionBrowserSourceMaps: false,
  // Prisma engines + sharp are not always picked up by file tracing.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/sharp/**/*",
    ],
  },
  experimental: {
    // Lower peak memory during `next build` (slightly slower compile).
    webpackMemoryOptimizations: true,
    cpus: Number.isFinite(buildCpus) && buildCpus > 0 ? buildCpus : 1,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

const sentryEnabled = Boolean(
  process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),
);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN?.trim(),
      },
      widenClientFileUpload: false,
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig;

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPackageVersion } from "./src/lib/read-package-version";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const appVersion = readPackageVersion();

console.info(`Calorie Vision v${appVersion}`);

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  // NextAuth callbacks and API POSTs break when Next.js 308-redirects them to a trailing slash.
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  // NextAuth callbacks and API POSTs break when Next.js 308-redirects them to a trailing slash.
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_GIT_SHA: gitSha(),
  },
};

export default nextConfig;

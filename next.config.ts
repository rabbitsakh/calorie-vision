import { execSync } from "node:child_process";
import { versionFromCommitCount } from "./src/lib/app-version";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function gitCommitCount(): number {
  try {
    return Number.parseInt(
      execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim(),
      10,
    );
  } catch {
    return 0;
  }
}

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  // NextAuth callbacks and API POSTs break when Next.js 308-redirects them to a trailing slash.
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: versionFromCommitCount(gitCommitCount()),
  },
};

export default nextConfig;

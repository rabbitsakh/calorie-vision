import { countGitCommits } from "./src/lib/git-commit-count";
import { versionFromCommitCount } from "./src/lib/app-version";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const commitCount = countGitCommits();
const appVersion = versionFromCommitCount(commitCount);

console.info(`Calorie Vision v${appVersion} (${commitCount} commits)`);

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

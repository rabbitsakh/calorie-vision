import { execSync } from "node:child_process";
import {
  displayedBuildCommit,
  displayedBuildVersion,
  stampBuildVersion,
  type BuildIdentity,
} from "./build-identity";
import { readPackageVersion } from "./read-package-version";

function runGit(args: string): string | null {
  try {
    const out = execSync(`git ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Число merge-коммитов первой родительской линии. null, если git недоступен. */
export function readGitMergeCount(): number | null {
  const raw = runGit("rev-list --count --first-parent --merges HEAD");
  if (!raw) return null;
  const count = Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function readGitShortSha(): string | null {
  return runGit("rev-parse --short=7 HEAD");
}

/** Штамп для next.config: считается из git, не из отката package.json. */
export function readBuildStamp(): BuildIdentity {
  return {
    version: stampBuildVersion(readGitMergeCount(), readPackageVersion()),
    commit: displayedBuildCommit(null, readGitShortSha()),
  };
}

/**
 * Версия уже собранного процесса.
 * Env, зашитый на build, важнее живого package.json.
 */
export function readDisplayedBuildIdentity(): BuildIdentity {
  return {
    version: displayedBuildVersion(
      process.env.NEXT_PUBLIC_APP_VERSION,
      readGitMergeCount(),
      readPackageVersion(),
    ),
    commit: displayedBuildCommit(process.env.NEXT_PUBLIC_APP_COMMIT, readGitShortSha()),
  };
}

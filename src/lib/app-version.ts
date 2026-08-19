/** First release in the PR-based scheme. Sequence 1 → 0.4.0. */
export const APP_VERSION_BASE = "0.4.0";

/** Z (patch) rolls at 20; Y (minor) rolls at 10; X (major) grows without limit. */
export const PATCHES_PER_MINOR = 20;
export const MINORS_PER_MAJOR = 10;

/**
 * Merge count at sequence 1 (0.4.0). Calibrated so the current main history maps to 0.5.9.
 * sequence = mergeCount - APP_VERSION_EPOCH_MERGES + 1
 */
export const APP_VERSION_EPOCH_MERGES = 21;

export type AppVersionParts = {
  major: number;
  minor: number;
  patch: number;
};

export function parseAppVersion(version: string): AppVersionParts {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid app version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatVersionParts({ major, minor, patch }: AppVersionParts): string {
  return `${major}.${minor}.${patch}`;
}

/** +1 Z per PR; +1 Y every 20 Z; +1 X every 10 Y. */
export function incrementAppVersion(version: string): string {
  let { major, minor, patch } = parseAppVersion(version);
  patch += 1;
  if (patch >= PATCHES_PER_MINOR) {
    patch = 0;
    minor += 1;
    if (minor >= MINORS_PER_MAJOR) {
      minor = 0;
      major += 1;
    }
  }
  return formatVersionParts({ major, minor, patch });
}

/** Map a 1-based PR sequence onto versions starting at APP_VERSION_BASE. */
export function versionFromSequence(sequence: number, start = APP_VERSION_BASE): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Version sequence must be an integer ≥ 1, got ${sequence}`);
  }

  let version = start;
  for (let step = 1; step < sequence; step += 1) {
    version = incrementAppVersion(version);
  }
  return version;
}

export function versionFromPullRequestCount(
  mergeCount: number,
  epochMerges = APP_VERSION_EPOCH_MERGES,
): string {
  const sequence = Math.max(1, mergeCount - epochMerges + 1);
  return versionFromSequence(sequence);
}

export function formatAppVersion(version: string): string {
  return `v${version}`;
}

export function getAppVersionLabel(): string {
  return formatAppVersion(process.env.NEXT_PUBLIC_APP_VERSION ?? APP_VERSION_BASE);
}

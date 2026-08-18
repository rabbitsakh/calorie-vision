/** First version of the 0–9 patch/minor scheme. Sequence 1 is 0.4.0. */
export const APP_VERSION_BASE = "0.4.0";

/**
 * Git commit count on the repo before sequence 1.
 * Sequence = max(1, commitCount - epoch). Epoch 58 maps 78 commits to 0.5.9.
 */
export const APP_VERSION_EPOCH_COMMITS = 58;

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

function versionFromUnits(units: number): string {
  if (!Number.isInteger(units) || units < 0) {
    throw new Error(`Invalid version units: ${units}`);
  }
  return formatVersionParts({
    major: Math.floor(units / 100),
    minor: Math.floor((units % 100) / 10),
    patch: units % 10,
  });
}

function unitsFromParts({ major, minor, patch }: AppVersionParts): number {
  return major * 100 + minor * 10 + patch;
}

/** Patch 0–9, then minor; minor 0–9, then major. 0.4.9 → 0.5.0, 0.9.9 → 1.0.0. */
export function incrementAppVersion(version: string): string {
  return versionFromUnits(unitsFromParts(parseAppVersion(version)) + 1);
}

/**
 * Sequential versions from a 1-based index.
 * 1 → 0.4.0, 10 → 0.4.9, 11 → 0.5.0, 12 → 0.5.1.
 */
export function versionFromSequence(sequence: number, start = APP_VERSION_BASE): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Version sequence must be an integer ≥ 1, got ${sequence}`);
  }
  return versionFromUnits(unitsFromParts(parseAppVersion(start)) + (sequence - 1));
}

export function versionFromCommitCount(
  commitCount: number,
  epochCommits = APP_VERSION_EPOCH_COMMITS,
): string {
  return versionFromSequence(Math.max(1, commitCount - epochCommits));
}

export function formatAppVersion(version: string): string {
  return `v${version}`;
}

export function getAppVersionLabel(): string {
  return formatAppVersion(process.env.NEXT_PUBLIC_APP_VERSION ?? APP_VERSION_BASE);
}

import { APP_VERSION_BASE, versionFromPullRequestCount } from "./app-version";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
/** git rev-parse --short, обычно 7, иногда длиннее. */
const SHA_RE = /^[0-9a-f]{7,40}$/i;

export type BuildIdentity = {
  version: string;
  commit: string | null;
};

export function normalizeSemver(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return SEMVER_RE.test(text) ? text : null;
}

export function normalizeShortSha(value: string | null | undefined): string | null {
  const text = value?.trim().toLowerCase() ?? "";
  return SHA_RE.test(text) ? text : null;
}

/**
 * Версия, которую печатаем в сборку.
 * Счётчик merge на main важнее застывшего package.json: его откатывает deploy.
 */
export function stampBuildVersion(
  mergeCount: number | null | undefined,
  packageVersion: string | null | undefined,
): string {
  if (mergeCount != null && Number.isInteger(mergeCount) && mergeCount > 0) {
    return versionFromPullRequestCount(mergeCount);
  }
  return normalizeSemver(packageVersion) ?? APP_VERSION_BASE;
}

/**
 * Что показывать в health и UI.
 * Сначала штамп сборки (NEXT_PUBLIC_APP_VERSION), потом пересчёт по git, и только
 * затем package.json — иначе после `git restore` health снова врёт 3.1.7.
 */
export function displayedBuildVersion(
  envVersion: string | null | undefined,
  mergeCount: number | null | undefined,
  packageVersion: string | null | undefined,
): string {
  return normalizeSemver(envVersion) ?? stampBuildVersion(mergeCount, packageVersion);
}

export function displayedBuildCommit(
  envCommit: string | null | undefined,
  gitSha: string | null | undefined,
): string | null {
  return normalizeShortSha(envCommit) ?? normalizeShortSha(gitSha);
}

export function formatBuildVersionLabel(version: string, commit?: string | null): string {
  const sha = normalizeShortSha(commit);
  return sha ? `v${version} · ${sha}` : `v${version}`;
}

/** Тело /api/health: прежние поля на месте, commit добавлен. */
export function buildHealthBody(identity: BuildIdentity): {
  ok: true;
  service: "calorie-vision";
  version: string;
  commit: string | null;
} {
  return {
    ok: true,
    service: "calorie-vision",
    version: identity.version,
    commit: identity.commit,
  };
}

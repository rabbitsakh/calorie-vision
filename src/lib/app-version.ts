export function formatAppVersion(version: string, sha: string): string {
  return `v${version} · ${sha}`;
}

export function getAppVersionLabel(): string {
  return formatAppVersion(
    process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    process.env.NEXT_PUBLIC_GIT_SHA ?? "dev",
  );
}

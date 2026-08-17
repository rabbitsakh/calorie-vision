const { execSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const APP_VERSION_BASE = "0.4.0";
const APP_VERSION_EPOCH_COMMITS = 16;

function countGitCommits() {
  try {
    const shallow =
      execSync("git rev-parse --is-shallow-repository", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true";
    if (shallow) {
      execSync("git fetch --unshallow", { stdio: "ignore" });
    }
  } catch {
    // Not a git checkout, or the repo is already complete.
  }

  try {
    const count = Number.parseInt(
      execSync("git rev-list --count HEAD", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
      10,
    );
    return Number.isFinite(count) ? count : 0;
  } catch {
    return 0;
  }
}

function parseAppVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Invalid app version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function versionFromCommitCount(commitCount) {
  const sequence = Math.max(1, commitCount - APP_VERSION_EPOCH_COMMITS);
  const parsed = parseAppVersion(APP_VERSION_BASE);
  const units = parsed.major * 100 + parsed.minor * 10 + parsed.patch + (sequence - 1);
  return `${Math.floor(units / 100)}.${Math.floor((units % 100) / 10)}.${units % 10}`;
}

const commitCount = countGitCommits();
const version = versionFromCommitCount(commitCount);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

packageJson.version = version;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.info(`Calorie Vision v${version} (${commitCount} commits)`);

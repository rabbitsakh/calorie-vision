import { countGitCommits } from "../src/lib/git-commit-count.ts";
import { versionFromCommitCount } from "../src/lib/app-version.ts";
import { readPackageVersion } from "../src/lib/read-package-version.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const commitCount = countGitCommits();
const suggested = versionFromCommitCount(commitCount);
const current = readPackageVersion();
const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

console.info(`package.json: v${current}`);
console.info(`from commits: v${suggested} (${commitCount} commits)`);

if (process.argv.includes("--write")) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  packageJson.version = suggested;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.info(`Updated package.json to v${suggested}`);
} else {
  console.info("Pass --write to copy the commit-based version into package.json");
}

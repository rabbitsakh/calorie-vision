import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countGitCommits } from "../src/lib/git-commit-count.ts";
import { versionFromCommitCount } from "../src/lib/app-version.ts";

const commitCount = countGitCommits();
const version = versionFromCommitCount(commitCount);
const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };

packageJson.version = version;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.info(`Calorie Vision v${version} (${commitCount} commits)`);

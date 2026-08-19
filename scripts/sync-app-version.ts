import { versionFromPullRequestCount } from "../src/lib/app-version.ts";
import { countGitMergeCommits } from "./lib/git-merge-count.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mergeCount = countGitMergeCommits();
const version = versionFromPullRequestCount(mergeCount);
const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };

packageJson.version = version;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.info(`Calorie Vision v${version} (${mergeCount} merged PRs on main)`);

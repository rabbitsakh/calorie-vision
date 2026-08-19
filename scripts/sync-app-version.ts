import { versionFromPullRequestCount } from "../src/lib/app-version.ts";
import { countGitMergeCommits } from "./lib/git-merge-count.ts";
import { buildChangelogFromMerges } from "./lib/build-changelog.ts";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mergeCount = countGitMergeCommits();
const version = versionFromPullRequestCount(mergeCount);
const packageJsonPath = join(root, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };

packageJson.version = version;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

const changelog = buildChangelogFromMerges();
const changelogDir = join(root, "src", "data");
mkdirSync(changelogDir, { recursive: true });
writeFileSync(join(changelogDir, "changelog.json"), `${JSON.stringify(changelog, null, 2)}\n`);

console.info(`Calorie Vision v${version} (${mergeCount} merged PRs on main)`);
console.info(`Changelog: ${changelog.length} releases, latest v${changelog[0]?.version ?? "?"}`);

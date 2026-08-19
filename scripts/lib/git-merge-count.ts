import { execSync } from "node:child_process";

/** Count merge commits on the first-parent line — one bump per merged PR on main. */
export function countGitMergeCommits(): number {
  try {
    const count = Number.parseInt(
      execSync("git rev-list --count --first-parent --merges HEAD", {
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

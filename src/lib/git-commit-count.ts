import { execSync } from "node:child_process";

export function countGitCommits(): number {
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

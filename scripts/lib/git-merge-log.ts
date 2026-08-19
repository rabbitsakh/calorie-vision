import { execSync } from "node:child_process";

export type GitMergeEntry = {
  /** 1-based index among merges on the first-parent line, oldest first. */
  index: number;
  dateKey: string;
  title: string;
};

function parseTitle(subject: string, body: string): string {
  const fromBody = body.trim().split("\n").find((line) => line.trim());
  if (fromBody) {
    return fromBody.trim();
  }
  return subject.trim();
}

/** Merge commits on main, oldest first — one entry per merged PR. */
export function listGitMergeEntries(): GitMergeEntry[] {
  try {
    const raw = execSync("git log --first-parent --merges --reverse --format=%aI%x1f%s%x1f%b%x1e", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const records = raw
      .split("\x1e")
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const entries: GitMergeEntry[] = [];
    let index = 0;

    for (const record of records) {
      const [isoDate, subject, body] = record.split("\x1f");
      if (!isoDate || !subject) {
        continue;
      }

      index += 1;
      entries.push({
        index,
        dateKey: isoDate.slice(0, 10),
        title: parseTitle(subject, body ?? ""),
      });
    }

    return entries;
  } catch {
    return [];
  }
}

"use client";

import Link from "next/link";
import changelog from "@/data/changelog.json";

type ChangelogEntry = {
  version: string;
  date: string;
  summary: string;
  items: Array<{ kind: string; text: string }>;
};

const ENTRIES = changelog as ChangelogEntry[];

/** Soft “what’s next / recent” strip from the shipped changelog. */
export function ProfileRoadmap() {
  const recent = ENTRIES.slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <section className="card p-4 md:p-6">
      <h2 className="font-display text-lg font-semibold text-slate-900">Недавнее</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Последние улучшения приложения — коротко и по делу
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {recent.map((entry) => {
          const highlights = entry.items.slice(0, 2).map((item) => item.text);
          return (
            <li key={entry.version} className="border-l-2 border-teal-600/40 pl-3">
              <p className="text-sm font-semibold text-slate-900">
                v{entry.version}
                <span className="ml-2 font-normal text-slate-500">{entry.date}</span>
              </p>
              {highlights.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                  {highlights.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-sm text-slate-600">
                  {entry.summary
                    .replace(/^feat\([^)]+\):\s*/i, "")
                    .replace(/^fix\([^)]+\):\s*/i, "")
                    .replace(/^chore\([^)]+\):\s*/i, "")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        Полный список — в админке для команды.{" "}
        <Link href={"/ration"} className="font-medium text-teal-800 underline-offset-2 hover:underline">
          К рациону
        </Link>
      </p>
    </section>
  );
}

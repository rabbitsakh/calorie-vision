"use client";

import { getAppVersionLabel } from "@/lib/app-version";
import {
  CHANGELOG,
  CHANGELOG_KIND_LABELS,
  formatChangelogDate,
  type ChangelogItemKind,
} from "@/lib/changelog";

const KIND_STYLES: Record<ChangelogItemKind, string> = {
  feature: "bg-teal-100 text-teal-800",
  fix: "bg-amber-100 text-amber-800",
  improvement: "bg-slate-100 text-slate-700",
};

const KIND_DOTS: Record<ChangelogItemKind, string> = {
  feature: "bg-teal-500",
  fix: "bg-amber-500",
  improvement: "bg-slate-400",
};

export function AdminChangelog() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <section className="card p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Calorie Vision</h2>
            <p className="mt-1 text-sm text-slate-500">
              История обновлений из merged PR на main — синхронизируется с версией при деплое.
            </p>
          </div>
          <div className="rounded-2xl bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900">
            Текущая версия: {getAppVersionLabel()}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {CHANGELOG.map((release, index) => (
          <article key={release.version} className="card overflow-hidden">
            <header className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 md:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-700 px-3 py-1 text-sm font-semibold text-white">
                  v{release.version}
                </span>
                <time className="text-sm text-slate-500" dateTime={release.date}>
                  {formatChangelogDate(release.date)}
                </time>
                {index === 0 ? (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                    последняя
                  </span>
                ) : null}
              </div>
              {release.summary ? (
                <p className="mt-2 text-base font-medium text-slate-900">{release.summary}</p>
              ) : null}
            </header>

            <ul className="divide-y divide-slate-100 px-4 py-2 md:px-6">
              {release.items.map((item) => (
                <li key={item.text} className="flex items-start gap-3 py-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOTS[item.kind]}`} />
                  <p className="min-w-0 text-sm leading-relaxed text-slate-700">
                    <span className={`mr-1.5 rounded px-1.5 py-0.5 text-xs font-semibold ${KIND_STYLES[item.kind]}`}>
                      {CHANGELOG_KIND_LABELS[item.kind]}
                    </span>
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

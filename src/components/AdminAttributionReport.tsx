"use client";

import { useEffect, useState } from "react";
import type { AttributionReportRow } from "@/lib/signup-attribution-report";
import { withBasePath } from "@/lib/paths";

export function AdminAttributionReport() {
  const [rows, setRows] = useState<AttributionReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(withBasePath("/api/admin/attribution"));
        if (!response.ok) {
          if (!cancelled) setError("Не удалось загрузить источники");
          return;
        }
        const data = (await response.json()) as { rows?: AttributionReportRow[] };
        if (!cancelled) setRows(data.rows ?? []);
      } catch {
        if (!cancelled) setError("Не удалось загрузить источники");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card overflow-x-auto p-4 md:p-6">
      <h2 className="text-lg font-semibold">Источники регистраций</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Первая метка с /go: utm_source, utm_medium, utm_campaign. Окна считаются от момента регистрации.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {rows === null && !error ? <p className="mt-3 text-sm text-[var(--muted)]">Загрузка…</p> : null}
      {rows && rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Регистраций пока нет.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <table className="mt-4 w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="py-2 pr-3 font-semibold">source</th>
              <th className="py-2 pr-3 font-semibold">medium</th>
              <th className="py-2 pr-3 font-semibold">campaign</th>
              <th className="py-2 pr-3 font-semibold">7 дней</th>
              <th className="py-2 pr-3 font-semibold">30 дней</th>
              <th className="py-2 font-semibold">Всего</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.source}|${row.medium}|${row.campaign}|${row.unlabeled}`} className="border-b border-[var(--border-hairline)]">
                <td className="py-2 pr-3 font-medium">{row.source}</td>
                <td className="py-2 pr-3">{row.medium}</td>
                <td className="py-2 pr-3">{row.campaign}</td>
                <td className="py-2 pr-3 tabular-nums">{row.d7}</td>
                <td className="py-2 pr-3 tabular-nums">{row.d30}</td>
                <td className="py-2 tabular-nums">{row.all}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

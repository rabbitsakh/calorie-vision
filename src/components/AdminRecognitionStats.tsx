"use client";

import { useEffect, useState } from "react";
import { DaisyLoading } from "@/components/DaisyLoading";
import { withBasePath } from "@/lib/paths";

type RecognitionStats = {
  totalRecognitions: number;
  correctedCount: number;
  correctionRate: number;
  avgConfidence: number | null;
  topMisrecognized: Array<{ dish: string; count: number }>;
  savedCorrections: number;
  error?: string;
};

export function AdminRecognitionStats() {
  const [stats, setStats] = useState<RecognitionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/admin/recognition"));
        const data = (await resp.json()) as RecognitionStats;
        if (!resp.ok) throw new Error(data.error ?? "Ошибка загрузки");
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="card overflow-hidden p-4 md:p-6">
      <h2 className="mb-4 text-lg font-semibold">Точность распознавания</h2>
      {loading ? <DaisyLoading /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {stats ? (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Всего распознаваний</p>
              <p className="mt-1 text-2xl font-bold">{stats.totalRecognitions.toLocaleString("ru")}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Исправлено пользователями</p>
              <p className="mt-1 text-2xl font-bold">{stats.correctedCount.toLocaleString("ru")}</p>
            </div>
            <div className={`rounded-2xl px-4 py-3 ${stats.correctionRate > 20 ? "bg-amber-50" : "bg-teal-50"}`}>
              <p className="text-xs uppercase tracking-wide text-slate-500">Процент исправлений</p>
              <p className={`mt-1 text-2xl font-bold ${stats.correctionRate > 20 ? "text-amber-700" : "text-teal-700"}`}>
                {stats.correctionRate}%
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Средняя уверенность</p>
              <p className="mt-1 text-2xl font-bold">
                {stats.avgConfidence !== null ? `${stats.avgConfidence}%` : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Память исправлений</p>
            <p className="text-lg font-semibold">{stats.savedCorrections} уникальных блюд в базе</p>
          </div>

          {stats.topMisrecognized.length > 0 ? (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">Чаще всего исправляют</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Оригинальное название</th>
                      <th>Кол-во исправлений</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topMisrecognized.map((row) => (
                      <tr key={row.dish}>
                        <td className="font-medium">{row.dish}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

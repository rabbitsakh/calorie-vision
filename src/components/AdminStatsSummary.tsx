"use client";

import { useEffect, useState } from "react";
import { DaisyLoading } from "@/components/DaisyLoading";
import type { AdminStatsResponse } from "@/lib/admin";
import { withBasePath } from "@/lib/paths";

const ROWS: Array<{ key: keyof AdminStatsResponse; label: string }> = [
  { key: "userCount", label: "Пользователи" },
  { key: "mealCount", label: "Записанные блюда" },
  { key: "weightCount", label: "Измерения веса" },
  { key: "photoCount", label: "Загруженные фото" },
];

export function AdminStatsSummary() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(withBasePath("/api/admin/stats"));
        const data = (await response.json()) as AdminStatsResponse & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Не удалось загрузить статистику");
        }
        if (!cancelled) {
          setStats(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card overflow-hidden p-4 md:p-6">
      <h2 className="mb-3 text-lg font-semibold">Сводка</h2>
      {loading ? <DaisyLoading /> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {stats ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Показатель</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="font-semibold text-slate-900">{stats[row.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

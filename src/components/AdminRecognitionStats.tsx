"use client";

import { useEffect, useState } from "react";
import { DaisyLoading } from "@/components/DaisyLoading";
import { withBasePath } from "@/lib/paths";

type LatencyBlock = {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};

type RecognitionStats = {
  totalRecognitions: number;
  correctedCount: number;
  correctionRate: number;
  avgConfidence: number | null;
  confidenceCalibration?: {
    currentLowConfidence: number;
    suggestedLowConfidence: number;
    buckets: Array<{
      bucketMin: number;
      bucketMax: number;
      count: number;
      correctedCount: number;
      correctionRate: number;
    }>;
  };
  topMisrecognized: Array<{ dish: string; count: number }>;
  savedCorrections: number;
  bySource?: Array<{ source: string; label: string; count: number }>;
  byPhotoKind?: Array<{ photoKind: string; count: number }>;
  telemetry?: {
    windowDays: number;
    eventCount: number;
    acceptedLatency: LatencyBlock;
    chatCalls: { count: number; p50: number | null; p95: number | null; max: number | null };
    latencyByPass: Array<{ pass: string; count: number; p50Ms: number | null; p95Ms: number | null }>;
    retryReasons: Array<{ key: string; count: number }>;
    specialistPasses: Array<{ key: string; count: number }>;
    promptVariants: Array<{ key: string; count: number }>;
    enrichmentTimeouts: number;
    enrichmentTotal: number;
  };
  error?: string;
};

function formatMs(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)} с`;
  return `${Math.round(value)} мс`;
}

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

  const telemetry = stats?.telemetry;

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

          {stats.confidenceCalibration && stats.confidenceCalibration.buckets.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">Калибровка confidence</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Порог «низкая уверенность» сейчас</p>
                  <p className="text-lg font-bold">
                    {Math.round(stats.confidenceCalibration.currentLowConfidence * 100)}%
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Рекомендация по данным</p>
                  <p className="text-lg font-bold">
                    {Math.round(stats.confidenceCalibration.suggestedLowConfidence * 100)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Env: RECOGNITION_LOW_CONFIDENCE или NEXT_PUBLIC_RECOGNITION_LOW_CONFIDENCE
                  </p>
                </div>
              </div>
              <div className="admin-table-wrap mt-4">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Confidence</th>
                      <th>N</th>
                      <th>Исправлено</th>
                      <th>% исправлений</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.confidenceCalibration.buckets.map((row) => (
                      <tr key={row.bucketMin}>
                        <td className="font-medium">
                          {Math.round(row.bucketMin * 100)}–{Math.round(row.bucketMax * 100)}%
                        </td>
                        <td>{row.count}</td>
                        <td>{row.correctedCount}</td>
                        <td>{row.correctionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {telemetry && telemetry.eventCount > 0 ? (
            <div className="rounded-2xl border border-teal-100 bg-teal-50/50 px-4 py-4">
              <p className="mb-3 text-sm font-semibold text-teal-900">
                Pipeline telemetry · последние {telemetry.windowDays} дн.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-xs text-slate-500">Latency p50 (accepted)</p>
                  <p className="text-lg font-bold">{formatMs(telemetry.acceptedLatency.p50Ms)}</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-xs text-slate-500">Latency p95 (accepted)</p>
                  <p className="text-lg font-bold">{formatMs(telemetry.acceptedLatency.p95Ms)}</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-xs text-slate-500">Chat calls p95</p>
                  <p className="text-lg font-bold">{telemetry.chatCalls.p95 ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-xs text-slate-500">Enrichment timeout</p>
                  <p className="text-lg font-bold">
                    {telemetry.enrichmentTotal > 0
                      ? `${Math.round((telemetry.enrichmentTimeouts / telemetry.enrichmentTotal) * 100)}%`
                      : "—"}
                  </p>
                </div>
              </div>

              {telemetry.latencyByPass.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Latency по этапам
                  </p>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Этап</th>
                          <th>N</th>
                          <th>p50</th>
                          <th>p95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telemetry.latencyByPass.map((row) => (
                          <tr key={row.pass}>
                            <td className="font-medium">{row.pass}</td>
                            <td>{row.count}</td>
                            <td>{formatMs(row.p50Ms)}</td>
                            <td>{formatMs(row.p95Ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {telemetry.retryReasons.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Retry reasons
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {telemetry.retryReasons.map((row) => (
                      <span
                        key={row.key}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {row.key} · {row.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {telemetry.specialistPasses.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Specialist passes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {telemetry.specialistPasses.map((row) => (
                      <span
                        key={row.key}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {row.key} · {row.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {telemetry.promptVariants.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Prompt variants (accepted)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {telemetry.promptVariants.map((row) => (
                      <span
                        key={row.key}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {row.key} · {row.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : telemetry ? (
            <p className="text-sm text-slate-500">
              Telemetry пока пуст — данные появятся после распознаваний с миграцией{" "}
              <code className="text-xs">migrate-recognition-telemetry.sql</code>.
            </p>
          ) : null}

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Память исправлений</p>
            <p className="text-lg font-semibold">{stats.savedCorrections} уникальных блюд в базе</p>
          </div>

          {stats.bySource && stats.bySource.length > 0 ? (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">По источнику распознавания</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Источник</th>
                      <th>Записей</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bySource.map((row) => (
                      <tr key={row.source}>
                        <td className="font-medium">{row.label}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {stats.byPhotoKind && stats.byPhotoKind.length > 0 ? (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">По типу фото</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Записей</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byPhotoKind.map((row) => (
                      <tr key={row.photoKind}>
                        <td className="font-medium">{row.photoKind}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

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

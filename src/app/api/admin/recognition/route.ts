import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { summarizeLatencyMs } from "@/lib/ai/recognition-percentiles";
import { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TELEMETRY_WINDOW_DAYS = 7;

function countByKey<T extends string>(
  rows: Array<{ key: T | null; count: number }>,
): Array<{ key: T; count: number }> {
  return rows
    .filter((row): row is { key: T; count: number } => row.key !== null)
    .sort((a, b) => b.count - a.count);
}

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const since = new Date(Date.now() - TELEMETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      totalRecognitions,
      correctedCount,
      avgConfidenceRaw,
      topMisrecognized,
      corrections,
      bySource,
      byPhotoKind,
      telemetryRows,
    ] = await Promise.all([
      prisma.mealEntry.count({ where: { confidence: { not: null } } }),
      prisma.mealEntry.count({ where: { wasCorrected: true } }),
      prisma.mealEntry.aggregate({
        _avg: { confidence: true },
        where: { confidence: { not: null } },
      }),
      prisma.mealEntry.groupBy({
        by: ["originalDish"],
        where: { wasCorrected: true, originalDish: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.foodCorrection.count(),
      prisma.mealEntry.groupBy({
        by: ["recognitionSource"],
        _count: { id: true },
        where: { recognitionSource: { not: null } },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.mealEntry.groupBy({
        by: ["photoKind"],
        _count: { id: true },
        where: { photoKind: { not: null } },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.recognitionPassLog.findMany({
        where: { createdAt: { gte: since } },
        select: {
          pass: true,
          latencyMs: true,
          chatCalls: true,
          retryReason: true,
          specialistPass: true,
          promptVariant: true,
          enrichmentTimedOut: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
    ]);

    const correctionRate =
      totalRecognitions > 0
        ? Math.round((correctedCount / totalRecognitions) * 100)
        : 0;

    const acceptedLatencies = telemetryRows
      .filter((row) => row.pass === "accepted" && row.latencyMs !== null)
      .map((row) => row.latencyMs!);
    const latencySummary = summarizeLatencyMs(acceptedLatencies);

    const chatCalls = telemetryRows
      .filter((row) => row.pass === "accepted" && row.chatCalls !== null)
      .map((row) => row.chatCalls!);
    const chatCallsSummary = summarizeLatencyMs(chatCalls);

    const byPassMap = new Map<string, number[]>();
    for (const row of telemetryRows) {
      if (row.latencyMs === null) continue;
      const bucket = byPassMap.get(row.pass) ?? [];
      bucket.push(row.latencyMs);
      byPassMap.set(row.pass, bucket);
    }

    const latencyByPass = [...byPassMap.entries()].map(([pass, values]) => ({
      pass,
      ...summarizeLatencyMs(values),
    }));

    const retryReasonCounts = new Map<string, number>();
    for (const row of telemetryRows) {
      if (!row.retryReason) continue;
      retryReasonCounts.set(row.retryReason, (retryReasonCounts.get(row.retryReason) ?? 0) + 1);
    }

    const specialistCounts = new Map<string, number>();
    for (const row of telemetryRows) {
      if (!row.specialistPass) continue;
      specialistCounts.set(row.specialistPass, (specialistCounts.get(row.specialistPass) ?? 0) + 1);
    }

    const enrichmentRows = telemetryRows.filter((row) => row.pass === "enrichment");
    const enrichmentTimeouts = enrichmentRows.filter((row) => row.enrichmentTimedOut).length;

    const promptVariantCounts = new Map<string, number>();
    for (const row of telemetryRows) {
      if (row.pass !== "accepted") continue;
      const key = row.promptVariant?.trim() || "main";
      promptVariantCounts.set(key, (promptVariantCounts.get(key) ?? 0) + 1);
    }

    return NextResponse.json({
      totalRecognitions,
      correctedCount,
      correctionRate,
      avgConfidence: avgConfidenceRaw._avg.confidence
        ? Math.round(avgConfidenceRaw._avg.confidence * 100)
        : null,
      topMisrecognized: topMisrecognized
        .filter((row) => row.originalDish)
        .map((row) => ({
          dish: decodeHtmlEntities(row.originalDish!),
          count: row._count.id,
        })),
      savedCorrections: corrections,
      bySource: bySource.map((row) => ({
        source: row.recognitionSource ?? "unknown",
        label:
          RECOGNITION_SOURCE_LABELS[row.recognitionSource ?? ""] ??
          row.recognitionSource ??
          "Неизвестно",
        count: row._count.id,
      })),
      byPhotoKind: byPhotoKind.map((row) => ({
        photoKind: row.photoKind ?? "unknown",
        count: row._count.id,
      })),
      telemetry: {
        windowDays: TELEMETRY_WINDOW_DAYS,
        eventCount: telemetryRows.length,
        acceptedLatency: latencySummary,
        chatCalls: {
          count: chatCallsSummary.count,
          p50: chatCallsSummary.p50Ms,
          p95: chatCallsSummary.p95Ms,
          max: chatCallsSummary.maxMs,
        },
        latencyByPass,
        retryReasons: countByKey(
          [...retryReasonCounts.entries()].map(([key, count]) => ({ key, count })),
        ),
        specialistPasses: countByKey(
          [...specialistCounts.entries()].map(([key, count]) => ({ key, count })),
        ),
        enrichmentTimeouts,
        enrichmentTotal: enrichmentRows.length,
        promptVariants: countByKey(
          [...promptVariantCounts.entries()].map(([key, count]) => ({ key, count })),
        ),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

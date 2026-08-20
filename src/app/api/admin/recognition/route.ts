import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { RECOGNITION_SOURCE_LABELS } from "@/lib/food-types";
import { decodeHtmlEntities } from "@/lib/html-text";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const [
      totalRecognitions,
      correctedCount,
      avgConfidenceRaw,
      topMisrecognized,
      corrections,
      bySource,
      byPhotoKind,
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
    ]);

    const correctionRate =
      totalRecognitions > 0
        ? Math.round((correctedCount / totalRecognitions) * 100)
        : 0;

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
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

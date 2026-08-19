import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
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
      sourceBreakdown,
    ] = await Promise.all([
      // Total meal entries from AI recognition (have confidence set)
      prisma.mealEntry.count({ where: { confidence: { not: null } } }),

      // How many were user-corrected
      prisma.mealEntry.count({ where: { wasCorrected: true } }),

      // Average confidence across recognized entries
      prisma.mealEntry.aggregate({
        _avg: { confidence: true },
        where: { confidence: { not: null } },
      }),

      // Top misrecognized dishes (originalDish with most corrections)
      prisma.mealEntry.groupBy({
        by: ["originalDish"],
        where: { wasCorrected: true, originalDish: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),

      // Total corrections in memory
      prisma.foodCorrection.count(),

      // Breakdown by source-like flags
      prisma.mealEntry.groupBy({
        by: ["wasCorrected"],
        _count: { id: true },
        where: { confidence: { not: null } },
      }),
    ]);

    const correctionRate = totalRecognitions > 0
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
        .map((row) => ({ dish: row.originalDish!, count: row._count.id })),
      savedCorrections: corrections,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

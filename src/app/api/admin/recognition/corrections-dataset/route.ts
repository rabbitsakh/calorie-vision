import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { buildCorrectionDataset } from "@/lib/food-corrections-dataset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin export of anonymized FoodCorrection rows for eval / prompt tuning (roadmap X1).
 * GET ?minUseCount=2&limit=500
 */
export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const url = new URL(request.url);
    const minUseCount = Number.parseInt(url.searchParams.get("minUseCount") ?? "2", 10);
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "500", 10);

    const rows = await prisma.foodCorrection.findMany({
      select: {
        originalKey: true,
        correctedName: true,
        calories: true,
        protein: true,
        fat: true,
        carbs: true,
        fiber: true,
        sugar: true,
        portionGrams: true,
        brand: true,
        useCount: true,
      },
      orderBy: { useCount: "desc" },
      take: 2000,
    });

    const dataset = buildCorrectionDataset(rows, {
      minUseCount: Number.isFinite(minUseCount) ? minUseCount : 2,
      limit: Number.isFinite(limit) ? limit : 500,
    });

    return NextResponse.json(dataset);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось выгрузить датасет правок" }, { status: 500 });
  }
}

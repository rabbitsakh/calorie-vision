import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { EXERCISE_CATALOG } from "@/lib/workouts/exercise-catalog";
import { searchExerciseCatalog } from "@/lib/workouts/catalog-search";
import type { ExerciseKind } from "@/lib/workouts/exercise-kind";

export const dynamic = "force-dynamic";

/** GET ?q=&muscle=&limit= — справочник с нечётким поиском, недавние сверху. */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const muscle = request.nextUrl.searchParams.get("muscle");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 20;

    const recent = await prisma.workoutExerciseLibrary.findMany({
      where: { userId: session.user.id },
      orderBy: [{ lastUsedAt: "desc" }, { useCount: "desc" }],
      take: 40,
      select: {
        name: true,
        catalogId: true,
        kind: true,
        useCount: true,
        lastUsedAt: true,
      },
    });

    const hits = searchExerciseCatalog({
      query: q,
      muscle,
      catalog: EXERCISE_CATALOG,
      recent: recent.map((row) => ({
        name: row.name,
        catalogId: row.catalogId,
        kind: row.kind as ExerciseKind,
        useCount: row.useCount,
        lastUsedAt: row.lastUsedAt,
      })),
      limit,
    });

    return NextResponse.json({ hits });
  } catch (error) {
    console.error("GET /api/workouts/catalog", error);
    return NextResponse.json({ error: "Не удалось найти упражнения" }, { status: 500 });
  }
}

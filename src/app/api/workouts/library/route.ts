import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import {
  seedLibraryFromHistory,
  serializeLibraryEntry,
  touchExerciseLibrary,
} from "@/lib/workouts/library";
import { isMuscleGroupKey } from "@/lib/workouts/muscle-groups";

export const dynamic = "force-dynamic";

/** GET ?q=&limit= — search / list library (seeds from history if empty). */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    await seedLibraryFromHistory(prisma, session.user.id);

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 80) : 40;

    const rows = await prisma.workoutExerciseLibrary.findMany({
      where: {
        userId: session.user.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { nameNorm: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastUsedAt: "desc" }, { useCount: "desc" }],
      take: limit,
    });

    return NextResponse.json({ entries: rows.map(serializeLibraryEntry) });
  } catch (error) {
    console.error("GET /api/workouts/library", error);
    return NextResponse.json({ error: "Не удалось загрузить библиотеку" }, { status: 500 });
  }
}

/** POST { name, kind?, muscleGroup? } — create / bump library entry. */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const body = (await request.json()) as {
      name?: string;
      kind?: unknown;
      muscleGroup?: string | null;
    };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) {
      return NextResponse.json({ error: "Укажите название" }, { status: 400 });
    }
    const muscleGroup =
      body.muscleGroup != null && String(body.muscleGroup).trim()
        ? String(body.muscleGroup).trim()
        : null;
    if (muscleGroup && !isMuscleGroupKey(muscleGroup)) {
      return NextResponse.json({ error: "Некорректная группа мышц" }, { status: 400 });
    }

    await touchExerciseLibrary(prisma, session.user.id, {
      name,
      kind: parseExerciseKind(body.kind, "strength"),
      muscleGroup,
    });

    const row = await prisma.workoutExerciseLibrary.findUniqueOrThrow({
      where: {
        userId_nameNorm: {
          userId: session.user.id,
          nameNorm: normalizeExerciseName(name),
        },
      },
    });

    return NextResponse.json({ entry: serializeLibraryEntry(row) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts/library", error);
    return NextResponse.json({ error: "Не удалось сохранить упражнение" }, { status: 500 });
  }
}

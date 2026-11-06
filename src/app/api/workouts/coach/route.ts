import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import { toDateKeyTz } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { parseAssistantPrefs } from "@/lib/assistant-prefs";
import { buildCoachPreview, parseCoachInput } from "@/lib/workouts/coach-plan";
import { buildMuscleRecoveryMap } from "@/lib/workouts/muscle-volume";
import { sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

/** Черновик тренировки. В дневник ничего не пишет. */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const input = parseCoachInput(await request.json().catch(() => null));
    if (!input) {
      return NextResponse.json({ error: "Проверьте цель, время и опыт" }, { status: 400 });
    }

    let limitations = input.limitations;
    let freshness: Array<{ key: string; status: "fresh" | "recovering" | "loaded" }> = [];
    let food: { mealCount: number; calories: number } | null = null;
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { timezone: true, assistantPrefsJson: true },
      });
      const notes = parseAssistantPrefs(user?.assistantPrefsJson).notes.join("; ");
      limitations = [input.limitations, notes].filter(Boolean).join(". ").slice(0, 240);
      const today = toDateKeyTz(new Date(), user?.timezone);
      const [history, meals] = await Promise.all([
        prisma.workoutSession.findMany({
          where: { userId: session.user.id },
          include: sessionInclude,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 40,
        }),
        prisma.mealEntry.aggregate({
          where: { userId: session.user.id, date: today },
          _sum: { calories: true },
          _count: true,
        }),
      ]);
      const muscleMap = buildMuscleRecoveryMap(
        history.map((row) => ({
          date: row.date,
          endedAt: row.endedAt,
          startedAt: row.startedAt,
          sessionGroups: row.muscles.map((muscle) => muscle.groupKey),
          exercises: row.exercises.map((exercise) => ({
            catalogId: exercise.catalogId,
            muscleGroup: exercise.muscleGroup,
            kind: exercise.kind,
            sets: exercise.sets,
          })),
        })),
        { weekOf: today, now: new Date() },
      );
      freshness = muscleMap.rows.map((row) => ({ key: row.key, status: row.status }));
      food = { mealCount: meals._count, calories: meals._sum.calories ?? 0 };
    } catch (error) {
      console.error("POST /api/workouts/coach context", error);
    }

    const limit = await checkRateLimitAsync(`gym-coach:${session.user.id}`, 12, 60 * 60_000);
    const preview = await buildCoachPreview({
      request: { ...input, limitations },
      freshness,
      food,
      complete: limit.allowed
        ? (prompt) =>
            completeChat([{ role: "user", content: prompt }], 0.2, { retries: 1, cache: false })
        : null,
    });
    if (!limit.allowed && preview.source === "fallback") {
      preview.note = `Слишком частые запросы — показан запасной шаблон. ${preview.note}`.slice(0, 280);
    }

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("POST /api/workouts/coach", error);
    return NextResponse.json({ error: "Не удалось собрать тренировку" }, { status: 500 });
  }
}

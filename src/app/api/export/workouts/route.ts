import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { buildWorkoutPdf } from "@/lib/workouts/export-pdf";
import {
  buildWorkoutCsv,
  workoutExportDateWhere,
  resolveWorkoutExportTimezone,
  type WorkoutExportSession,
} from "@/lib/workouts/export-csv";
import { workoutExportFilename } from "@/lib/workouts/export-href";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response || !session?.user?.id) {
      return response ?? NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
    }

    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    const from = requireDateKey(request.nextUrl.searchParams.get("from"));
    const to = requireDateKey(request.nextUrl.searchParams.get("to"));

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    const timezone = resolveWorkoutExportTimezone(user?.timezone);

    const date = workoutExportDateWhere(from, to);
    const stored = await prisma.workoutSession.findMany({
      where: { userId: session.user.id, ...(date ? { date } : {}) },
      orderBy: [{ date: "asc" }, { startedAt: "asc" }, { createdAt: "asc" }],
      include: {
        muscles: true,
        exercises: { include: { sets: true } },
      },
    });

    const sessions: WorkoutExportSession[] = stored.map((row) => ({
      date: row.date,
      note: row.note,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      muscles: row.muscles.map((muscle) => muscle.groupKey),
      exercises: row.exercises.map((exercise) => ({
        name: exercise.name,
        kind: exercise.kind,
        note: exercise.note,
        sortOrder: exercise.sortOrder,
        sets: exercise.sets.map((set) => ({
          weightKg: set.weightKg,
          reps: set.reps,
          distanceKm: set.distanceKm,
          durationSec: set.durationSec,
          setType: set.setType,
          completed: set.completed,
          rpe: set.rpe,
          sortOrder: set.sortOrder,
        })),
      })),
    }));

    if (format === "pdf") {
      const pdfBuffer = await buildWorkoutPdf({ sessions, timezone, from, to });
      const filename = workoutExportFilename("pdf", from, to);
      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const csv = buildWorkoutCsv(sessions, timezone);
    const filename = workoutExportFilename("csv", from, to);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Ошибка экспорта" }, { status: 500 });
  }
}

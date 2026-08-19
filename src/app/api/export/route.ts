import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

function escCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const from = fromParam ? requireDateKey(fromParam) : null;
    const to = toParam ? requireDateKey(toParam) : null;

    const where: Record<string, unknown> = { userId: session.user.id };
    if (from && to) {
      where.date = { gte: from, lte: to };
    } else if (from) {
      where.date = { gte: from };
    } else if (to) {
      where.date = { lte: to };
    }

    const entries = await prisma.mealEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        date: true,
        createdAt: true,
        dishName: true,
        mealType: true,
        calories: true,
        protein: true,
        fat: true,
        carbs: true,
        portionGrams: true,
        wasCorrected: true,
        confidence: true,
      },
    });

    const MEAL_TYPE_RU: Record<string, string> = {
      BREAKFAST: "Завтрак",
      LUNCH: "Обед",
      DINNER: "Ужин",
      SNACK: "Перекус",
    };

    const header = ["Дата", "Время", "Приём пищи", "Блюдо", "Ккал", "Белки г", "Жиры г", "Углеводы г", "Порция г", "Исправлено"].join(",");
    const rows = entries.map((e) => {
      const time = new Date(e.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      return [
        escCsv(e.date),
        escCsv(time),
        escCsv(e.mealType ? MEAL_TYPE_RU[e.mealType] : ""),
        escCsv(decodeHtmlEntities(e.dishName)),
        escCsv(e.calories),
        escCsv(e.protein),
        escCsv(e.fat),
        escCsv(e.carbs),
        escCsv(e.portionGrams),
        escCsv(e.wasCorrected ? "да" : ""),
      ].join(",");
    });

    const csv = "\uFEFF" + [header, ...rows].join("\r\n"); // BOM for Excel

    const filename = from && to ? `calorie-vision-${from}-${to}.csv` : "calorie-vision-export.csv";

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

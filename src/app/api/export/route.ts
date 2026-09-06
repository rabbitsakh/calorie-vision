import { existsSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { decodeHtmlEntities } from "@/lib/html-text";

export const dynamic = "force-dynamic";

const MEAL_TYPE_RU: Record<string, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перекус",
};

function escCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function buildCsv(userId: string, from: string | null, to: string | null) {
  const where: Record<string, unknown> = { userId };
  if (from && to) where.date = { gte: from, lte: to };
  else if (from) where.date = { gte: from };
  else if (to) where.date = { lte: to };

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
      fiber: true,
      sugar: true,
      portionGrams: true,
      wasCorrected: true,
    },
  });

  const header = ["Дата", "Время", "Приём пищи", "Блюдо", "Ккал", "Белки г", "Жиры г", "Углеводы г", "Клетчатка г", "Сахар г", "Порция г", "Исправлено"].join(",");
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
      escCsv(e.fiber),
      escCsv(e.sugar),
      escCsv(e.portionGrams),
      escCsv(e.wasCorrected ? "да" : ""),
    ].join(",");
  });

  return "\uFEFF" + [header, ...rows].join("\r\n");
}

async function buildPdf(userId: string, from: string | null, to: string | null): Promise<Buffer> {
  const where: Record<string, unknown> = { userId };
  if (from && to) where.date = { gte: from, lte: to };
  else if (from) where.date = { gte: from };
  else if (to) where.date = { lte: to };

  const entries = await prisma.mealEntry.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // Group by date
  const byDate = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  // Dynamic import to avoid bundling issues
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const regularFont = path.join(process.cwd(), "fonts", "DejaVuSans.ttf");
    const boldFont = path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf");
    const hasCyrillicFonts = existsSync(regularFont) && existsSync(boldFont);
    if (hasCyrillicFonts) {
      doc.registerFont("CV-Regular", regularFont);
      doc.registerFont("CV-Bold", boldFont);
    }
    const fontRegular = hasCyrillicFonts ? "CV-Regular" : "Helvetica";
    const fontBold = hasCyrillicFonts ? "CV-Bold" : "Helvetica-Bold";
    const t = (value: string) => value;

    const periodStr = from && to ? `${from} — ${to}` : from ?? to ?? "всё время";
    doc
      .fontSize(22)
      .font(fontBold)
      .fillColor("#0f766e")
      .text("Calorie Vision", { align: "center" });
    doc
      .fontSize(12)
      .font(fontRegular)
      .fillColor("#334155")
      .text(t("Дневник питания"), { align: "center" });
    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text(t(`Период: ${periodStr}`), { align: "center" });
    doc.moveDown(0.4);
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#99f6e4")
      .lineWidth(1.5)
      .stroke();
    doc.fillColor("#000000");
    doc.moveDown(1);

    for (const [date, dayEntries] of byDate.entries()) {
      const totalCal = dayEntries.reduce((s, e) => s + e.calories, 0);
      doc.fontSize(12).font(fontBold).text(`${date}  (${totalCal} ккал)`);
      doc.moveDown(0.2);

      for (const e of dayEntries) {
        const macros = [
          e.protein ? `P:${e.protein}g` : null,
          e.fat ? `F:${e.fat}g` : null,
          e.carbs ? `C:${e.carbs}g` : null,
          e.fiber ? `Fi:${e.fiber}g` : null,
          e.sugar ? `S:${e.sugar}g` : null,
        ].filter(Boolean).join(" ");
        const line = `  ${t(decodeHtmlEntities(e.dishName))} — ${e.calories} ккал${macros ? `  ${macros}` : ""}`;
        doc.fontSize(10).font(fontRegular).text(line);
      }
      doc.moveDown(0.5);

      if (doc.y > 720) {
        doc.addPage();
      }
    }

    doc.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const from = fromParam ? requireDateKey(fromParam) : null;
    const to = toParam ? requireDateKey(toParam) : null;

    if (format === "pdf") {
      const pdfBuffer = await buildPdf(session.user.id, from, to);
      const filename = from && to ? `calorie-vision-${from}-${to}.pdf` : "calorie-vision-export.pdf";
      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // CSV (default)
    const csv = await buildCsv(session.user.id, from, to);
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

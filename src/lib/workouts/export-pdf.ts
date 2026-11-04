import { existsSync } from "node:fs";
import path from "node:path";
import {
  buildWorkoutPdfBlocks,
  type WorkoutExportSession,
} from "@/lib/workouts/export-csv";

export async function buildWorkoutPdf(input: {
  sessions: readonly WorkoutExportSession[];
  timezone: string;
  from: string | null;
  to: string | null;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const blocks = buildWorkoutPdfBlocks(input.sessions, input.timezone);

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

    const periodStr =
      input.from && input.to
        ? `${input.from} — ${input.to}`
        : (input.from ?? input.to ?? "всё время");

    doc.fontSize(22).font(fontBold).fillColor("#0f766e").text("Calorie Vision", { align: "center" });
    doc.fontSize(12).font(fontRegular).fillColor("#334155").text("Дневник тренировок", { align: "center" });
    doc.fontSize(10).fillColor("#64748b").text(`Период: ${periodStr}`, { align: "center" });
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#99f6e4").lineWidth(1.5).stroke();
    doc.fillColor("#000000");
    doc.moveDown(1);

    if (blocks.length === 0) {
      doc.fontSize(11).font(fontRegular).text("Нет тренировок за выбранный период.");
      doc.end();
      return;
    }

    for (const block of blocks) {
      doc.fontSize(12).font(fontBold).fillColor("#0f172a").text(block.heading);
      if (block.muscles) {
        doc.fontSize(9).font(fontRegular).fillColor("#64748b").text(block.muscles);
      }
      doc.fillColor("#000000");
      doc.moveDown(0.15);
      for (const line of block.lines) {
        doc.fontSize(10).font(fontRegular).text(line);
        if (doc.y > 760) doc.addPage();
      }
      doc.moveDown(0.55);
      if (doc.y > 720) doc.addPage();
    }

    doc.end();
  });
}

import { existsSync } from "node:fs";
import path from "node:path";

export type PdfBlock = {
  heading: string;
  sub?: string;
  lines: string[];
};

export type PdfSection = {
  title: string;
  empty: string;
  blocks: PdfBlock[];
};

/**
 * One A4 document with DejaVu so Cyrillic is real text, not missing glyphs.
 * Falls back to Helvetica only when the font files are absent.
 */
export async function renderPdfDocument(input: {
  subtitle: string;
  periodLabel: string;
  timezone: string;
  sections: PdfSection[];
}): Promise<Buffer> {
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

    doc.fontSize(22).font(fontBold).fillColor("#0f766e").text("Calorie Vision", { align: "center" });
    doc.fontSize(12).font(fontRegular).fillColor("#334155").text(input.subtitle, { align: "center" });
    doc.fontSize(10).fillColor("#64748b").text(`Период: ${input.periodLabel}`, { align: "center" });
    doc.fontSize(9).text(`Время: ${input.timezone}`, { align: "center" });
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#99f6e4").lineWidth(1.5).stroke();
    doc.fillColor("#000000");
    doc.moveDown(1);

    const multiple = input.sections.length > 1;
    for (const section of input.sections) {
      if (multiple || section.title !== input.subtitle) {
        doc.fontSize(16).font(fontBold).fillColor("#0f766e").text(section.title);
        doc.moveDown(0.35);
      }
      if (section.blocks.length === 0) {
        doc.fontSize(11).font(fontRegular).fillColor("#334155").text(section.empty);
        doc.fillColor("#000000");
        doc.moveDown(0.8);
        continue;
      }
      for (const block of section.blocks) {
        doc.fontSize(12).font(fontBold).fillColor("#0f172a").text(block.heading);
        if (block.sub) {
          doc.fontSize(9).font(fontRegular).fillColor("#64748b").text(block.sub);
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
      doc.moveDown(0.4);
    }

    doc.end();
  });
}

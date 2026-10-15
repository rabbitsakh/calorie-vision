/**
 * R4 — share an unlocked collection sticker as a simple PNG card.
 */

import { rewardDef, stickerGlyph } from "@/lib/rewards";

export type ShareStickerResult = "shared" | "downloaded" | "failed";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/** Draw a soft share card for a sticker reward. */
export async function renderStickerSharePng(stickerKey: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const def = rewardDef(stickerKey);
  if (!def || def.group !== "sticker") return null;

  const w = 720;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#ECFDF5");
  grad.addColorStop(1, "#CCFBF1");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Card plate
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 48, 72, w - 96, h - 180, 36);
  ctx.fill();

  const glyph = stickerGlyph(stickerKey) ?? "✨";
  ctx.font = "120px system-ui, Apple Color Emoji, Segoe UI Emoji, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, w / 2, 300);

  ctx.fillStyle = "#134E4A";
  ctx.font = "bold 42px Georgia, 'Times New Roman', serif";
  ctx.fillText(def.title, w / 2, 430);

  ctx.fillStyle = "#0F766E";
  ctx.font = "28px system-ui, sans-serif";
  wrapCentered(ctx, def.description, w / 2, 500, w - 160, 36);

  ctx.fillStyle = "#115E59";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText("Calorie Vision", w / 2, h - 70);

  ctx.fillStyle = "#5EEAD4";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText("наклейка из коллекции", w / 2, h - 40);

  return canvasToBlob(canvas);
}

export async function shareStickerCard(stickerKey: string): Promise<ShareStickerResult> {
  try {
    const blob = await renderStickerSharePng(stickerKey);
    if (!blob) return "failed";
    const def = rewardDef(stickerKey);
    const file = new File([blob], `calorie-vision-sticker-${stickerKey}.png`, {
      type: "image/png",
    });
    const title = def?.title ?? "Наклейка";
    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: "Calorie Vision",
        text: `${title} — наклейка из коллекции Calorie Vision`,
      });
      return "shared";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

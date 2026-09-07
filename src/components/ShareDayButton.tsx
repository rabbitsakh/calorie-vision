"use client";

import { useCallback, useState } from "react";
import { withBasePath } from "@/lib/paths";

type ShareDayCardProps = {
  date: string;
  timezone?: string | null;
  className?: string;
  /** Full secondary button (legacy) or quiet menu row inside ShareMenu. */
  variant?: "button" | "menu";
  onDone?: () => void;
};

type DayTotals = {
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  streak?: number | null;
  targetCalories?: number | null;
};

/**
 * Canvas share card for the selected day (kcal / macros / streak).
 */
export function ShareDayButton({
  date,
  className = "",
  variant = "button",
  onDone,
}: ShareDayCardProps) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const share = useCallback(async () => {
    setBusy(true);
    setHint(null);
    try {
      const [mealsResp, streakResp] = await Promise.all([
        fetch(withBasePath(`/api/meals?date=${encodeURIComponent(date)}`)),
        fetch(withBasePath("/api/streak")),
      ]);
      if (!mealsResp.ok) throw new Error("meals");
      const mealsJson = (await mealsResp.json()) as {
        totalCalories?: number;
        totalProtein?: number;
        totalFat?: number;
        totalCarbs?: number;
        target?: { calories?: number } | null;
      };
      let streak: number | null = null;
      if (streakResp.ok) {
        const s = (await streakResp.json()) as { streak?: number };
        streak = typeof s.streak === "number" ? s.streak : null;
      }

      const totals: DayTotals = {
        totalCalories: Math.round(mealsJson.totalCalories ?? 0),
        totalProtein: Math.round(mealsJson.totalProtein ?? 0),
        totalFat: Math.round(mealsJson.totalFat ?? 0),
        totalCarbs: Math.round(mealsJson.totalCarbs ?? 0),
        streak,
        targetCalories:
          mealsJson.target?.calories != null ? Math.round(mealsJson.target.calories) : null,
      };

      const blob = await renderSharePng(date, totals);
      const file = new File([blob], `calorie-vision-${date}.png`, { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Calorie Vision",
          text: `Мой день ${date} в Calorie Vision`,
        });
        setHint("Отправлено");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        setHint("Картинка скачана");
      }
      onDone?.();
    } catch {
      setHint("Не удалось поделиться");
    } finally {
      setBusy(false);
      window.setTimeout(() => setHint(null), 2500);
    }
  }, [date, onDone]);

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitem"
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${className}`.trim()}
        disabled={busy}
        onClick={() => void share()}
      >
        <span>{busy ? "Готовим…" : "День"}</span>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <button
        type="button"
        className="btn btn-secondary text-sm"
        disabled={busy}
        onClick={() => void share()}
      >
        {busy ? "Готовим…" : "Поделиться днём"}
      </button>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}

async function renderSharePng(date: string, totals: DayTotals): Promise<Blob> {
  const w = 720;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0f766e");
  grad.addColorStop(0.55, "#0d9488");
  grad.addColorStop(1, "#134e4a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(560, 140, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ecfdf5";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("Calorie Vision", 48, 72);

  ctx.fillStyle = "rgba(236,253,245,0.8)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText(date, 48, 110);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 96px system-ui, sans-serif";
  ctx.fillText(String(totals.totalCalories), 48, 260);
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  if (totals.targetCalories != null) {
    ctx.fillText(`из ${totals.targetCalories} ккал`, 48, 310);
  } else {
    ctx.fillText("ккал за день", 48, 310);
  }

  const macros = [
    ["Белки", `${totals.totalProtein} г`],
    ["Жиры", `${totals.totalFat} г`],
    ["Углеводы", `${totals.totalCarbs} г`],
  ] as const;
  let x = 48;
  for (const [label, value] of macros) {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    roundRect(ctx, x, 360, 200, 110, 20);
    ctx.fill();
    ctx.fillStyle = "rgba(236,253,245,0.75)";
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillText(label, x + 18, 400);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 32px system-ui, sans-serif";
    ctx.fillText(value, x + 18, 444);
    x += 220;
  }

  if (totals.streak != null && totals.streak > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 48, 520, 624, 100, 24);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 36px system-ui, sans-serif";
    ctx.fillText(`Серия ${totals.streak} ${daysWord(totals.streak)}`, 72, 582);
  }

  ctx.fillStyle = "rgba(236,253,245,0.65)";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText("calorievision.ru", 48, 840);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/png");
  });
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

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

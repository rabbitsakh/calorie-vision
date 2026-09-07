"use client";

import { useCallback, useState } from "react";
import { withBasePath } from "@/lib/paths";

type ShareWeekButtonProps = {
  endDate: string;
  className?: string;
  variant?: "button" | "menu";
  onDone?: () => void;
};

type WeekShareData = {
  weekLabel: string;
  daysLogged: number;
  avgCalories: number;
  avgWaterMl: number;
  avgFiber?: number;
  avgSugar?: number;
  calorieTarget: number | null;
  fiberTarget?: number | null;
  sugarTarget?: number | null;
  streak?: number | null;
};

/** Canvas share card for the soft weekly summary. */
export function ShareWeekButton({
  endDate,
  className = "",
  variant = "button",
  onDone,
}: ShareWeekButtonProps) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const share = useCallback(async () => {
    setBusy(true);
    setHint(null);
    try {
      const [weekResp, streakResp] = await Promise.all([
        fetch(withBasePath(`/api/weekly-report?end=${encodeURIComponent(endDate)}`)),
        fetch(withBasePath("/api/streak")),
      ]);
      if (!weekResp.ok) throw new Error("week");
      const week = (await weekResp.json()) as WeekShareData;
      let streak: number | null = null;
      if (streakResp.ok) {
        const s = (await streakResp.json()) as { streak?: number };
        streak = typeof s.streak === "number" ? s.streak : null;
      }

      const blob = await renderWeekPng({ ...week, streak });
      const file = new File([blob], `calorie-vision-week-${endDate}.png`, { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "Calorie Vision",
          text: `Моя неделя ${week.weekLabel} в Calorie Vision`,
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
  }, [endDate, onDone]);

  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitem"
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${className}`.trim()}
        disabled={busy}
        onClick={() => void share()}
      >
        <span>{busy ? "Готовим…" : "Неделя"}</span>
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
        {busy ? "Готовим…" : "Поделиться неделей"}
      </button>
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}

async function renderWeekPng(data: WeekShareData): Promise<Blob> {
  const w = 720;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0f766e");
  grad.addColorStop(0.55, "#14b8a6");
  grad.addColorStop(1, "#134e4a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(560, 160, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ecfdf5";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("Calorie Vision", 48, 72);

  ctx.fillStyle = "rgba(236,253,245,0.85)";
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText(data.weekLabel || "Неделя", 48, 110);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 88px system-ui, sans-serif";
  ctx.fillText(String(Math.round(data.avgCalories || 0)), 48, 250);
  ctx.font = "600 26px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  if (data.calorieTarget != null) {
    ctx.fillText(`ср. ккал / цель ${Math.round(data.calorieTarget)}`, 48, 300);
  } else {
    ctx.fillText("средние ккал за неделю", 48, 300);
  }

  const cards = [
    ["Дней с едой", String(data.daysLogged)],
    ["Вода ср.", `${Math.round(data.avgWaterMl || 0)} мл`],
  ] as const;
  let x = 48;
  for (const [label, value] of cards) {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    roundRect(ctx, x, 360, 300, 110, 20);
    ctx.fill();
    ctx.fillStyle = "rgba(236,253,245,0.75)";
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillText(label, x + 18, 400);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 32px system-ui, sans-serif";
    ctx.fillText(value, x + 18, 444);
    x += 320;
  }

  const fiberSugarParts: string[] = [];
  if (data.fiberTarget != null) {
    fiberSugarParts.push(
      `клетчатка ${Math.round(data.avgFiber ?? 0)}/${Math.round(data.fiberTarget)} г`,
    );
  }
  if (data.sugarTarget != null) {
    fiberSugarParts.push(
      `сахар ${Math.round(data.avgSugar ?? 0)}/${Math.round(data.sugarTarget)} г`,
    );
  }
  if (fiberSugarParts.length > 0) {
    ctx.fillStyle = "rgba(236,253,245,0.85)";
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(fiberSugarParts.join(" · "), 48, 510);
  }

  if (data.streak != null && data.streak > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 48, fiberSugarParts.length > 0 ? 540 : 520, 624, 100, 24);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 36px system-ui, sans-serif";
    ctx.fillText(`Серия ${data.streak} дн.`, 72, fiberSugarParts.length > 0 ? 602 : 582);
  }

  ctx.fillStyle = "rgba(236,253,245,0.65)";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText("без оценок — просто спокойная неделя", 48, 780);
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

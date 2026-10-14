import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import {
  ruleNextSessionTip,
  type NextSessionTarget,
} from "@/lib/workouts/next-session-targets";
import type { ProgressionLever, ProgressionOption } from "@/lib/workouts/progression";

export const dynamic = "force-dynamic";

const LEVERS = new Set<ProgressionLever>(["weight", "volume", "reps"]);
const KINDS = new Set(["progress", "hold", "stall", "deload", "base"]);

function parseOptions(raw: unknown): ProgressionOption[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgressionOption[] = [];
  for (const item of raw.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lever =
      typeof o.lever === "string" && LEVERS.has(o.lever as ProgressionLever)
        ? (o.lever as ProgressionLever)
        : null;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
    const line = typeof o.line === "string" ? o.line.trim().slice(0, 120) : "";
    if (!lever || !label || !line) continue;
    out.push({
      lever,
      label,
      line,
      suggestedKg:
        typeof o.suggestedKg === "number" && Number.isFinite(o.suggestedKg)
          ? o.suggestedKg
          : null,
      suggestedReps:
        typeof o.suggestedReps === "number" && Number.isFinite(o.suggestedReps)
          ? o.suggestedReps
          : null,
    });
  }
  return out;
}

function parseTargets(raw: unknown): NextSessionTarget[] {
  if (!Array.isArray(raw)) return [];
  const out: NextSessionTarget[] = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name.trim().slice(0, 80) : "";
    const line = typeof t.line === "string" ? t.line.trim().slice(0, 160) : "";
    const adviceKind =
      typeof t.adviceKind === "string" && KINDS.has(t.adviceKind)
        ? (t.adviceKind as NextSessionTarget["adviceKind"])
        : "hold";
    if (!name || !line) continue;
    const kg =
      typeof t.suggestedKg === "number" && Number.isFinite(t.suggestedKg)
        ? t.suggestedKg
        : null;
    const basisKg =
      typeof t.basisKg === "number" && Number.isFinite(t.basisKg) ? t.basisKg : null;
    const primaryLever =
      typeof t.primaryLever === "string" && LEVERS.has(t.primaryLever as ProgressionLever)
        ? (t.primaryLever as ProgressionLever)
        : null;
    out.push({
      name,
      adviceKind,
      title: adviceKind,
      line,
      suggestedKg: kg,
      basisKg,
      primaryLever,
      options: parseOptions(t.options),
    });
  }
  return out;
}

/**
 * POST { targets: NextSessionTarget[] }
 * → short tip (rule-based; optional GigaChat one-liner).
 * Does not touch parse-log.
 */
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => ({}))) as {
      targets?: unknown;
    };
    const targets = parseTargets(body.targets);
    let tip = ruleNextSessionTip(targets);
    let source: "gigachat" | "rules" = "rules";

    const hasCreds = Boolean(
      process.env.GIGACHAT_CREDENTIALS?.trim() ||
        (process.env.GIGACHAT_CLIENT_ID?.trim() &&
          process.env.GIGACHAT_CLIENT_SECRET?.trim()),
    );

    if (hasCreds && targets.length > 0) {
      try {
        const lines = targets
          .map((t) => {
            const opts = t.options
              .map((o) => `${o.label}: ${o.line}`)
              .join(" | ");
            return opts
              ? `- ${t.name}: ${opts} (фокус по правилам: ${t.primaryLever ?? t.adviceKind})`
              : `- ${t.line} (${t.adviceKind})`;
          })
          .join("\n");
        const prompt = [
          "Ты — краткий тренер по силовой/кардио. Ответь ОДНИМ коротким предложением на русском (макс 140 символов).",
          "Без списков, без медицины, без стыда. Выбери ОДИН рычаг: вес, тоннаж (+подход) или повторы — не предлагай всё сразу.",
          "Опирайся на макс. рабочий вес (не дроп-сет) и варианты ниже — не выдумывай упражнения и веса.",
          `Варианты:\n${lines}`,
        ].join("\n");
        const ai = await completeChat([{ role: "user", content: prompt }], 0.5, {
          retries: 1,
        });
        const cleaned = ai.replace(/^["«]|["»]$/g, "").trim();
        if (cleaned.length >= 16 && cleaned.length <= 200) {
          tip = cleaned;
          source = "gigachat";
        }
      } catch {
        // keep rule tip
      }
    }

    return NextResponse.json({ tip, source });
  } catch (error) {
    console.error("POST /api/workouts/next-tip", error);
    return NextResponse.json({ error: "Не удалось получить совет" }, { status: 500 });
  }
}

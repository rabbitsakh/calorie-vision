import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import { ruleNextSessionTip } from "@/lib/workouts/next-session-targets";

export const dynamic = "force-dynamic";

type TipTarget = {
  name?: unknown;
  adviceKind?: unknown;
  line?: unknown;
  suggestedKg?: unknown;
};

function parseTargets(raw: unknown): Array<{
  name: string;
  adviceKind: "progress" | "hold" | "stall" | "deload" | "base";
  title: string;
  line: string;
  suggestedKg: number | null;
}> {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set(["progress", "hold", "stall", "deload", "base"]);
  const out: Array<{
    name: string;
    adviceKind: "progress" | "hold" | "stall" | "deload" | "base";
    title: string;
    line: string;
    suggestedKg: number | null;
  }> = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const t = item as TipTarget;
    const name = typeof t.name === "string" ? t.name.trim().slice(0, 80) : "";
    const line = typeof t.line === "string" ? t.line.trim().slice(0, 160) : "";
    const adviceKind =
      typeof t.adviceKind === "string" && kinds.has(t.adviceKind)
        ? (t.adviceKind as "progress" | "hold" | "stall" | "deload" | "base")
        : "hold";
    if (!name || !line) continue;
    const kg =
      typeof t.suggestedKg === "number" && Number.isFinite(t.suggestedKg)
        ? t.suggestedKg
        : null;
    out.push({ name, adviceKind, title: adviceKind, line, suggestedKg: kg });
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
        const lines = targets.map((t) => `- ${t.line} (${t.adviceKind})`).join("\n");
        const prompt = [
          "Ты — краткий тренер по силовой/кардио. Ответь ОДНИМ коротким предложением на русском (макс 140 символов).",
          "Без списков, без медицины, без стыда. Один конкретный фокус на следующую тренировку.",
          "Опирайся только на цели ниже — не выдумывай упражнения.",
          `Цели:\n${lines}`,
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

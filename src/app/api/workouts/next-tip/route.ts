import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { completeChat } from "@/lib/ai/gigachat";
import {
  ruleNextSessionTip,
  type NextSessionTarget,
} from "@/lib/workouts/next-session-targets";
import type { ProgressionLever, ProgressionOption } from "@/lib/workouts/progression";
import {
  buildTipPrompt,
  detectLeverInTip,
  pickTipFocus,
  ruleTipForFocus,
  stripLeverAnnotation,
} from "@/lib/workouts/tip-lever";

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
      leverRemembered: t.leverRemembered === true,
      options: parseOptions(t.options),
    });
  }
  return out;
}

/**
 * POST { targets: NextSessionTarget[] }
 * → short tip locked to ONE lever (prefs / primary). Optional GigaChat phrasing.
 */
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => ({}))) as {
      targets?: unknown;
      recoveryHitNames?: unknown;
      earlyUser?: unknown;
    };
    const targets = parseTargets(body.targets);
    const recoveryHitNames = Array.isArray(body.recoveryHitNames)
      ? body.recoveryHitNames.filter((n): n is string => typeof n === "string")
      : [];
    const earlyUser = body.earlyUser === true;
    const focus = pickTipFocus(targets);
    const recoveryHit = Boolean(
      focus &&
        recoveryHitNames.some(
          (n) => n.trim().toLowerCase() === focus.exerciseName.trim().toLowerCase(),
        ),
    );
    let tip = focus
      ? ruleTipForFocus(focus, { recoveryHit, earlyUser })
      : ruleNextSessionTip(targets, { recoveryHitNames, earlyUser });
    let source: "gigachat" | "rules" = "rules";
    let lever: ProgressionLever | null = focus?.lever ?? null;
    const exerciseName: string | null = focus?.exerciseName ?? null;
    const fromPreference = Boolean(focus?.fromPreference);

    const hasCreds = Boolean(
      process.env.GIGACHAT_CREDENTIALS?.trim() ||
        (process.env.GIGACHAT_CLIENT_ID?.trim() &&
          process.env.GIGACHAT_CLIENT_SECRET?.trim()),
    );

    if (hasCreds && focus) {
      try {
        const prompt = buildTipPrompt(focus, { earlyUser });
        const ai = await completeChat([{ role: "user", content: prompt }], 0.4, {
          retries: 1,
        });
        const cleaned = ai.replace(/^["«]|["»]$/g, "").trim();
        if (cleaned.length >= 16 && cleaned.length <= 200) {
          const stripped = stripLeverAnnotation(cleaned);
          const allowed = focus.options.map((o) => o.lever);
          // Preference is locked — ignore AI lever codes that disagree.
          if (focus.fromPreference) {
            tip = stripped.tip;
            lever = focus.lever;
            source = "gigachat";
          } else {
            const detected =
              stripped.lever && allowed.includes(stripped.lever)
                ? stripped.lever
                : detectLeverInTip(stripped.tip, allowed);
            // Only accept AI tip if it clearly talks about one allowed lever.
            if (detected && allowed.includes(detected)) {
              tip = stripped.tip;
              lever = detected;
              source = "gigachat";
            }
            // else keep rule tip for the primary lever
          }
        }
      } catch {
        // keep rule tip
      }
    }

    return NextResponse.json({
      tip,
      source,
      lever,
      exerciseName,
      fromPreference,
    });
  } catch (error) {
    console.error("POST /api/workouts/next-tip", error);
    return NextResponse.json({ error: "Не удалось получить совет" }, { status: 500 });
  }
}

import { completeChat } from "@/lib/ai/gigachat";
import { parseWorkoutText, type ParsedExerciseBlock, type ParsedSet } from "@/lib/workouts/parse-text";

function hasCredentials(): boolean {
  return Boolean(process.env.GIGACHAT_CREDENTIALS?.trim());
}

function sanitizeBlocks(raw: unknown): ParsedExerciseBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedExerciseBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { name?: unknown; sets?: unknown };
    const name = typeof rec.name === "string" ? rec.name.trim().slice(0, 120) : "";
    if (!name || !Array.isArray(rec.sets)) continue;
    const sets: ParsedSet[] = [];
    for (const s of rec.sets) {
      if (!s || typeof s !== "object") continue;
      const sr = s as { weightKg?: unknown; reps?: unknown };
      const weightKg = typeof sr.weightKg === "number" ? sr.weightKg : Number(sr.weightKg);
      const reps = typeof sr.reps === "number" ? sr.reps : Number(sr.reps);
      if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg < 0 || reps <= 0 || reps > 500) {
        continue;
      }
      if (weightKg > 1000) continue;
      sets.push({ weightKg, reps: Math.floor(reps) });
    }
    if (sets.length === 0) continue;
    out.push({ name, sets });
  }
  return out;
}

async function parseWithGigaChat(text: string): Promise<ParsedExerciseBlock[]> {
  const reply = await completeChat(
    [
      {
        role: "system",
        content:
          "Ты парсер тренировочного лога. Верни ТОЛЬКО JSON-массив объектов " +
          '{ "name": string, "sets": [{ "weightKg": number, "reps": number }] }. ' +
          "Без markdown. Вес в кг, повторения целые. Если имя неясно — «Упражнение».",
      },
      { role: "user", content: text.slice(0, 2000) },
    ],
    0.1,
    { retries: 2 },
  );

  const jsonMatch = reply.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    return sanitizeBlocks(JSON.parse(jsonMatch[0]));
  } catch {
    return [];
  }
}

export type ParseWorkoutResult = {
  blocks: ParsedExerciseBlock[];
  source: "regex" | "gigachat" | "empty";
};

/** Prefer deterministic regex; fall back to GigaChat for free-form notes. */
export async function parseWorkoutLog(text: string): Promise<ParseWorkoutResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { blocks: [], source: "empty" };
  }

  const regexBlocks = parseWorkoutText(trimmed);
  const regexSetCount = regexBlocks.reduce((n, b) => n + b.sets.length, 0);
  if (regexSetCount > 0) {
    return { blocks: regexBlocks, source: "regex" };
  }

  if (!hasCredentials()) {
    return { blocks: [], source: "empty" };
  }

  try {
    const aiBlocks = await parseWithGigaChat(trimmed);
    if (aiBlocks.length > 0) {
      return { blocks: aiBlocks, source: "gigachat" };
    }
  } catch (error) {
    console.warn("workout parse GigaChat failed", error);
  }

  return { blocks: [], source: "empty" };
}

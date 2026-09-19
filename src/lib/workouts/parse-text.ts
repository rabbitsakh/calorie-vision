export type ParsedSet = {
  weightKg: number;
  reps: number;
};

export type ParsedExerciseBlock = {
  name: string;
  sets: ParsedSet[];
};

/**
 * Deterministic parse of gym shorthand, e.g.:
 * "Жим лёжа 80x8, 80x8, 82.5×6"
 * "Присед: 100×5 100×5"
 * "80/8 82.5/6" (name optional — caller supplies)
 */
export function parseWorkoutText(raw: string): ParsedExerciseBlock[] {
  const text = raw.replace(/\r/g, "\n").trim();
  if (!text) return [];

  const blocks: ParsedExerciseBlock[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const parsed = parseOneLine(line);
    if (parsed) blocks.push(parsed);
  }

  // Single-line blob without newlines but multiple exercises separated by ;
  if (blocks.length === 0 && /;/.test(text)) {
    for (const part of text.split(";").map((p) => p.trim()).filter(Boolean)) {
      const parsed = parseOneLine(part);
      if (parsed) blocks.push(parsed);
    }
  }

  return blocks;
}

function parseOneLine(line: string): ParsedExerciseBlock | null {
  const sets = extractSets(line);
  if (sets.length === 0) return null;

  // Strip set tokens to recover the exercise name.
  let namePart = line
    .replace(/(\d+(?:[.,]\d+)?)\s*[xх×/]\s*(\d{1,3})/gi, " ")
    .replace(/[,;]+/g, " ")
    .replace(/[:\-–—]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Drop trailing punctuation leftovers
  namePart = namePart.replace(/^[:\-–—]\s*/, "").replace(/\s*[:\-–—]$/, "").trim();

  const name = namePart || "Упражнение";
  return { name, sets };
}

function extractSets(line: string): ParsedSet[] {
  const out: ParsedSet[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*[xх×/]\s*(\d{1,3})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const weightKg = Number(m[1].replace(",", "."));
    const reps = Number(m[2]);
    if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg < 0 || reps <= 0 || reps > 500) {
      continue;
    }
    if (weightKg > 1000) continue;
    out.push({ weightKg, reps });
  }
  return out;
}

export function parseSetsOnly(raw: string): ParsedSet[] {
  return extractSets(raw.replace(/\r/g, "\n"));
}

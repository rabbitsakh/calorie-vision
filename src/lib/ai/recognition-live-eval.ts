import fs from "node:fs/promises";
import path from "node:path";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { recognizeWithGigaChat } from "@/lib/ai/gigachat";
import { normalizeRecognitionNutrition } from "@/lib/recognition-nutrition";

/** Put golden photos in repo-root `eval-fixtures/` (gitignored binary assets). */
export const EVAL_FIXTURES_DIR = path.join(process.cwd(), "eval-fixtures");

export type LiveRecognitionEvalCase = {
  id: string;
  description: string;
  /** File name inside eval-fixtures/ (e.g. plate-borscht.jpg) */
  imageFile: string;
  expect: {
    dishNameIncludes?: string;
    photoKind?: string;
    minCalories?: number;
    /** Multi-item / canteen trays must return at least this many items. */
    minItems?: number;
  };
};

/** Live golden set (Wave 8: 30–50 slots). Missing images skip without failing the suite. */
const LIVE_EVAL_SEED: LiveRecognitionEvalCase[] = [
  {
    id: "live-plate-borscht",
    description: "Plate photo — borscht",
    imageFile: "plate-borscht.jpg",
    expect: { dishNameIncludes: "борщ", minCalories: 150 },
  },
  {
    id: "live-label-yogurt",
    description: "Label photo — yogurt",
    imageFile: "label-yogurt.jpg",
    expect: { photoKind: "label", minCalories: 50 },
  },
  {
    id: "live-drink-bottle",
    description: "Drink bottle label",
    imageFile: "drink-bottle.jpg",
    expect: {
      dishNameIncludes: "пиво|кола|напиток|молоко|сок|квас",
      minCalories: 40,
      photoKind: "label|package",
    },
  },
  {
    id: "live-plate-oatmeal",
    description: "Plate photo — oatmeal",
    imageFile: "plate-oatmeal.jpg",
    expect: { dishNameIncludes: "овсян|каша", minCalories: 80 },
  },
  {
    id: "live-package-bar",
    description: "Package bar / snack",
    imageFile: "package-bar.jpg",
    expect: { dishNameIncludes: "батончик|бар|протеин|snack|шоколад", minCalories: 40 },
  },
];

/** Extra slots — drop photos into eval-fixtures/ with matching names to activate. */
const LIVE_EVAL_EXTRA_NAMES = [
  "plate-salad",
  "plate-pasta",
  "plate-soup",
  "plate-steak",
  "plate-sushi",
  "plate-pizza",
  "plate-rice-chicken",
  "plate-pelmeni",
  "plate-blini",
  "label-juice",
  "label-cheese",
  "label-bread",
  "label-cereal",
  "label-chocolate",
  "label-cottage",
  "package-chips",
  "package-cookies",
  "barcode-milk",
  "barcode-kefir",
  "canteen-tray",
  "canteen-soup",
  "drink-smoothie",
  "drink-coffee",
  "snack-apple",
  "snack-banana",
  "multi-plate-2",
  "multi-plate-3",
  "ready-meal-sticker",
  "cafe-salad",
  "cafe-bowl",
] as const;

/** Stricter expects for ready-meal / cafe / label live slots (no new binaries). */
const LIVE_EVAL_TIGHT_EXPECTS: Record<
  string,
  LiveRecognitionEvalCase["expect"]
> = {
  "label-juice": { photoKind: "label", minCalories: 20 },
  "label-cheese": { photoKind: "label", minCalories: 80 },
  "label-bread": { photoKind: "label", minCalories: 40 },
  "label-cereal": { photoKind: "label", minCalories: 40 },
  "label-chocolate": { photoKind: "label", minCalories: 80 },
  "label-cottage": { photoKind: "label", minCalories: 50 },
  "drink-smoothie": {
    dishNameIncludes: "смузи|smoothie|сок|йогурт|напиток",
    photoKind: "label|package|meal",
    minCalories: 40,
  },
  "drink-coffee": {
    dishNameIncludes: "кофе|латте|капучино|американо|эспрессо",
    photoKind: "label|package|meal",
    minCalories: 5,
  },
  "multi-plate-2": {
    dishNameIncludes: ",| и |/|\\+",
    minCalories: 150,
    minItems: 2,
  },
  "multi-plate-3": {
    dishNameIncludes: ",| и |/|\\+",
    minCalories: 200,
    minItems: 3,
  },
  "canteen-tray": {
    dishNameIncludes: ",| и |/|\\+|поднос|комплекс|обед",
    photoKind: "meal",
    minCalories: 250,
    minItems: 2,
  },
  "canteen-soup": {
    dishNameIncludes: "суп|борщ|щи|солянка|харчо|рассольник",
    photoKind: "meal",
    minCalories: 80,
  },
  "plate-soup": {
    dishNameIncludes: "суп|борщ|щи|солянка|харчо|рассольник|крем-суп",
    photoKind: "meal",
    minCalories: 80,
  },
  "plate-salad": {
    dishNameIncludes: "салат",
    photoKind: "meal",
    minCalories: 80,
  },
  "plate-pasta": {
    dishNameIncludes: "паста|макарон|спагет|пенне|фарфалле|лапш",
    photoKind: "meal",
    minCalories: 200,
  },
  "ready-meal-sticker": {
    photoKind: "label|package",
    dishNameIncludes: "рис|куриц|салат|плов|паста|котлет|греч",
    minCalories: 150,
  },
  "cafe-salad": {
    photoKind: "label|package",
    dishNameIncludes: "салат|цезарь|греческ",
    minCalories: 120,
  },
  "cafe-bowl": {
    photoKind: "label|package",
    dishNameIncludes: "боул|bowl|рис|салат|киноа|поке",
    minCalories: 150,
  },
};

export const LIVE_RECOGNITION_EVAL_CASES: LiveRecognitionEvalCase[] = [
  ...LIVE_EVAL_SEED,
  ...LIVE_EVAL_EXTRA_NAMES.map((name) => ({
    id: `live-${name}`,
    description: `Live fixture ${name}`,
    imageFile: `${name}.jpg`,
    expect: LIVE_EVAL_TIGHT_EXPECTS[name] ?? { minCalories: 10 },
  })),
];

export type LiveEvalCaseResult = {
  id: string;
  passed: boolean;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
  latencyMs?: number;
};

export function liveEvalEnabled(): boolean {
  return (
    process.env.RECOGNITION_LIVE_EVAL === "1" &&
    Boolean(process.env.GIGACHAT_CREDENTIALS?.trim())
  );
}

function dishNameMatches(pattern: string, dishName: string): boolean {
  return new RegExp(pattern, "i").test(dishName);
}

function photoKindMatches(pattern: string, photoKind: string | undefined): boolean {
  if (!photoKind) return false;
  if (pattern.includes("|")) {
    return new RegExp(`^(?:${pattern})$`, "i").test(photoKind);
  }
  return photoKind === pattern;
}

function evaluateLiveResult(
  fixture: LiveRecognitionEvalCase,
  result: FoodRecognitionResult,
): string[] {
  const errors: string[] = [];
  const expect = fixture.expect;

  if (expect.dishNameIncludes && !dishNameMatches(expect.dishNameIncludes, result.dishName)) {
    errors.push(`dishName "${result.dishName}" missing /${expect.dishNameIncludes}/`);
  }
  if (expect.photoKind && !photoKindMatches(expect.photoKind, result.photoKind)) {
    errors.push(`photoKind ${result.photoKind} !== ${expect.photoKind}`);
  }
  if (expect.minCalories !== undefined && result.calories < expect.minCalories) {
    errors.push(`calories ${result.calories} < ${expect.minCalories}`);
  }
  if (expect.minItems !== undefined) {
    const itemCount = result.items?.length ?? 0;
    if (itemCount < expect.minItems) {
      errors.push(`items ${itemCount} < ${expect.minItems}`);
    }
  }

  return errors;
}

export async function runLiveRecognitionEvalCase(
  fixture: LiveRecognitionEvalCase,
): Promise<LiveEvalCaseResult> {
  const imagePath = path.join(EVAL_FIXTURES_DIR, fixture.imageFile);

  try {
    await fs.access(imagePath);
  } catch {
    return {
      id: fixture.id,
      passed: true,
      skipped: true,
      skipReason: `missing image ${fixture.imageFile}`,
      errors: [],
    };
  }

  if (!liveEvalEnabled()) {
    return {
      id: fixture.id,
      passed: true,
      skipped: true,
      skipReason: "RECOGNITION_LIVE_EVAL=1 and GIGACHAT_CREDENTIALS required",
      errors: [],
    };
  }

  const startedAt = Date.now();
  try {
    const buffer = await fs.readFile(imagePath);
    const vision = await recognizeWithGigaChat(buffer, fixture.imageFile);
    const normalized = normalizeRecognitionNutrition(vision);
    const errors = evaluateLiveResult(fixture, normalized);

    return {
      id: fixture.id,
      passed: errors.length === 0,
      skipped: false,
      errors,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: fixture.id,
      passed: false,
      skipped: false,
      errors: [error instanceof Error ? error.message : "live eval failed"],
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function runLiveRecognitionEvalSuite(cases: LiveRecognitionEvalCase[]): Promise<{
  passed: number;
  failed: number;
  skipped: number;
  results: LiveEvalCaseResult[];
}> {
  const results: LiveEvalCaseResult[] = [];

  for (const fixture of cases) {
    results.push(await runLiveRecognitionEvalCase(fixture));
  }

  const actionable = results.filter((result) => !result.skipped);
  const failed = actionable.filter((result) => !result.passed).length;
  const skipped = results.filter((result) => result.skipped).length;

  return {
    passed: actionable.length - failed,
    failed,
    skipped,
    results,
  };
}

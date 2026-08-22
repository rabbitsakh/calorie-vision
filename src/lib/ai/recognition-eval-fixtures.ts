/**
 * Offline recognition eval fixtures: golden GigaChat JSON → parse/enrich expectations.
 * Used by recognition-eval.test.ts — no live AI calls.
 */
export type RecognitionEvalCase = {
  id: string;
  description: string;
  rawModelJson: string;
  expect: {
    dishNameIncludes?: string;
    photoKind?: string;
    minItems?: number;
    minCalories?: number;
    shouldRetry?: boolean;
  };
};

export const RECOGNITION_EVAL_CASES: RecognitionEvalCase[] = [
  {
    id: "plate-multi",
    description: "Mixed plate returns separate items with calories",
    rawModelJson: JSON.stringify({
      photoKind: "meal",
      dishName: "Стейк, картофель, салат",
      brand: "",
      barcode: "",
      calories: 670,
      protein: 46,
      fat: 33,
      carbs: 32,
      portionGrams: 430,
      confidence: 0.78,
      alternatives: [],
      items: [
        {
          dishName: "Стейк говяжий",
          calories: 400,
          protein: 40,
          fat: 20,
          carbs: 0,
          portionGrams: 150,
          confidence: 0.82,
        },
        {
          dishName: "Картофель запечённый",
          calories: 180,
          protein: 4,
          fat: 6,
          carbs: 28,
          portionGrams: 200,
          confidence: 0.8,
        },
        {
          dishName: "Салат овощной",
          calories: 90,
          protein: 2,
          fat: 7,
          carbs: 4,
          portionGrams: 80,
          confidence: 0.7,
        },
      ],
      per100g: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }),
    expect: {
      dishNameIncludes: "Стейк",
      photoKind: "meal",
      minItems: 3,
      minCalories: 600,
      shouldRetry: false,
    },
  },
  {
    id: "plate-list-without-items",
    description: "Comma-separated meal without items should trigger retry heuristic",
    rawModelJson: JSON.stringify({
      photoKind: "meal",
      dishName: "Курица, рис, овощи",
      calories: 520,
      protein: 35,
      fat: 12,
      carbs: 50,
      portionGrams: 400,
      confidence: 0.7,
      alternatives: [],
      items: [],
      per100g: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }),
    expect: {
      photoKind: "meal",
      minItems: 0,
      minCalories: 500,
      shouldRetry: true,
    },
  },
  {
    id: "single-soup",
    description: "Single dish keeps empty items",
    rawModelJson: JSON.stringify({
      photoKind: "meal",
      dishName: "Борщ с мясом",
      calories: 280,
      protein: 14,
      fat: 12,
      carbs: 28,
      portionGrams: 350,
      confidence: 0.86,
      alternatives: [],
      items: [],
      per100g: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }),
    expect: {
      dishNameIncludes: "Борщ",
      photoKind: "meal",
      minItems: 0,
      minCalories: 250,
      shouldRetry: false,
    },
  },
  {
    id: "label-per100g",
    description: "Label with per100g parses for later enrichment",
    rawModelJson: JSON.stringify({
      photoKind: "label",
      dishName: "Творог 5%",
      brand: "Простоквашино",
      barcode: "",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      portionGrams: 180,
      confidence: 0.9,
      alternatives: [],
      items: [],
      per100g: { calories: 121, protein: 16, fat: 5, carbs: 3 },
    }),
    expect: {
      dishNameIncludes: "Творог",
      photoKind: "label",
      minCalories: 0,
      shouldRetry: false,
    },
  },
  {
    id: "zero-calorie-named-item",
    description: "Recognized name with zero calories still parses for backfill",
    rawModelJson: JSON.stringify({
      photoKind: "meal",
      dishName: "Картофель фри",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      portionGrams: 150,
      confidence: 0.75,
      alternatives: [],
      items: [],
      per100g: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }),
    expect: {
      dishNameIncludes: "Картофель",
      photoKind: "meal",
      minCalories: 0,
      shouldRetry: true,
    },
  },
  {
    id: "vague-meal-name",
    description: "Vague dish name should trigger smarter retry",
    rawModelJson: JSON.stringify({
      photoKind: "meal",
      dishName: "Обед",
      calories: 450,
      protein: 20,
      fat: 15,
      carbs: 40,
      portionGrams: 350,
      confidence: 0.55,
      alternatives: [],
      items: [],
      per100g: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }),
    expect: {
      dishNameIncludes: "Обед",
      photoKind: "meal",
      shouldRetry: true,
    },
  },
  {
    id: "empty-label-table",
    description: "Label without per100g or calories should retry",
    rawModelJson: JSON.stringify({
      photoKind: "label",
      dishName: "Йогурт",
      brand: "",
      barcode: "",
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      portionGrams: 0,
      confidence: 0.6,
      alternatives: [],
      items: [],
      per100g: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }),
    expect: {
      photoKind: "label",
      shouldRetry: true,
    },
  },
];

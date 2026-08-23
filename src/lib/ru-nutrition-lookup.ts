import type { PackNutrition } from "@/lib/open-food-facts";

export type RuNutritionEntry = {
  keys: string[];
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams: number;
};

/** Typical RU home/cafe portions — offline fallback when OFF misses. */
export const RU_NUTRITION_ENTRIES: RuNutritionEntry[] = [
  { keys: ["борщ", "борщ с мясом"], dishName: "Борщ с мясом", calories: 280, protein: 12, fat: 14, carbs: 22, portionGrams: 300 },
  { keys: ["щи", "щи из свежей капусты"], dishName: "Щи", calories: 220, protein: 9, fat: 10, carbs: 18, portionGrams: 300 },
  { keys: ["солянка", "солянка мясная"], dishName: "Солянка", calories: 310, protein: 14, fat: 22, carbs: 12, portionGrams: 300 },
  { keys: ["гречка", "гречневая каша", "гречка рассыпчатая"], dishName: "Гречневая каша", calories: 180, protein: 6, fat: 2, carbs: 36, portionGrams: 200 },
  { keys: ["рис", "рис белый", "рис отварной"], dishName: "Рис отварной", calories: 260, protein: 5, fat: 1, carbs: 58, portionGrams: 200 },
  { keys: ["овсянка", "овсяная каша"], dishName: "Овсяная каша", calories: 220, protein: 7, fat: 5, carbs: 36, fiber: 4, portionGrams: 250 },
  { keys: ["макароны", "паста"], dishName: "Макароны отварные", calories: 280, protein: 9, fat: 2, carbs: 56, portionGrams: 200 },
  { keys: ["картофель", "картофельное пюре", "пюре"], dishName: "Картофельное пюре", calories: 240, protein: 5, fat: 8, carbs: 36, portionGrams: 200 },
  { keys: ["котлета", "котлета куриная", "куриная котлета"], dishName: "Котлета куриная", calories: 280, protein: 22, fat: 16, carbs: 12, portionGrams: 120 },
  { keys: ["куриная грудка", "грудка куриная", "куриное филе"], dishName: "Куриная грудка", calories: 248, protein: 46, fat: 5, carbs: 0, portionGrams: 150 },
  { keys: ["свинина", "свиная отбивная"], dishName: "Свиная отбивная", calories: 360, protein: 28, fat: 24, carbs: 4, portionGrams: 150 },
  { keys: ["говядина", "стейк", "стейк говяжий"], dishName: "Стейк говяжий", calories: 400, protein: 40, fat: 20, carbs: 0, portionGrams: 150 },
  { keys: ["рыба", "лосось", "лосось запечённый"], dishName: "Лосось запечённый", calories: 350, protein: 34, fat: 22, carbs: 0, portionGrams: 150 },
  { keys: ["яичница", "яйца", "яйцо жареное"], dishName: "Яичница", calories: 220, protein: 14, fat: 18, carbs: 2, portionGrams: 120 },
  { keys: ["омлет"], dishName: "Омлет", calories: 260, protein: 16, fat: 20, carbs: 3, portionGrams: 150 },
  { keys: ["творог", "творог 5%", "творог 9%"], dishName: "Творог 5%", calories: 180, protein: 28, fat: 8, carbs: 6, portionGrams: 150 },
  { keys: ["салат", "салат овощной", "овощной салат"], dishName: "Салат овощной", calories: 90, protein: 2, fat: 7, carbs: 4, fiber: 2, portionGrams: 150 },
  { keys: ["цезарь", "салат цезарь"], dishName: "Салат Цезарь", calories: 420, protein: 22, fat: 28, carbs: 18, portionGrams: 250 },
  { keys: ["оливье", "салат оливье"], dishName: "Салат оливье", calories: 380, protein: 8, fat: 28, carbs: 24, portionGrams: 200 },
  { keys: ["винегрет"], dishName: "Винегрет", calories: 180, protein: 3, fat: 10, carbs: 18, fiber: 4, portionGrams: 200 },
  { keys: ["пельмени", "пельмени домашние"], dishName: "Пельмени", calories: 520, protein: 22, fat: 24, carbs: 52, portionGrams: 250 },
  { keys: ["вареники", "вареники с творогом"], dishName: "Вареники с творогом", calories: 380, protein: 14, fat: 10, carbs: 58, portionGrams: 200 },
  { keys: ["блины", "блин", "блины с творогом"], dishName: "Блины", calories: 320, protein: 10, fat: 12, carbs: 42, portionGrams: 150 },
  { keys: ["сырники"], dishName: "Сырники", calories: 340, protein: 18, fat: 14, carbs: 36, portionGrams: 150 },
  { keys: ["хлеб", "хлеб белый", "батон"], dishName: "Хлеб белый", calories: 160, protein: 5, fat: 1, carbs: 32, portionGrams: 60 },
  { keys: ["бутерброд", "бутер"], dishName: "Бутерброд с колбасой", calories: 280, protein: 12, fat: 14, carbs: 26, portionGrams: 100 },
  { keys: ["плов", "плов с говядиной"], dishName: "Плов с говядиной", calories: 560, protein: 26, fat: 22, carbs: 58, portionGrams: 300 },
  { keys: ["голубцы"], dishName: "Голубцы", calories: 320, protein: 16, fat: 18, carbs: 22, portionGrams: 250 },
  { keys: ["котлеты", "котлеты домашние"], dishName: "Котлеты домашние", calories: 420, protein: 24, fat: 28, carbs: 16, portionGrams: 200 },
  { keys: ["котлета по-киевски"], dishName: "Котлета по-киевски", calories: 480, protein: 26, fat: 32, carbs: 14, portionGrams: 180 },
  { keys: ["чебурек", "чебуреки"], dishName: "Чебурек", calories: 380, protein: 14, fat: 20, carbs: 36, portionGrams: 120 },
  { keys: ["шашлык", "шашлык из свинины"], dishName: "Шашлык из свинины", calories: 450, protein: 32, fat: 32, carbs: 2, portionGrams: 200 },
  { keys: ["шаурма"], dishName: "Шаурма", calories: 520, protein: 22, fat: 24, carbs: 52, portionGrams: 280 },
  { keys: ["бургер", "гамбургер", "чизбургер"], dishName: "Бургер", calories: 540, protein: 26, fat: 28, carbs: 44, portionGrams: 220 },
  { keys: ["пицца", "пizza", "пицца маргарита"], dishName: "Пицца", calories: 680, protein: 28, fat: 26, carbs: 78, portionGrams: 250 },
  { keys: ["суши", "ролл", "филадельфия"], dishName: "Ролл Филадельфия", calories: 320, protein: 14, fat: 12, carbs: 38, portionGrams: 120 },
  { keys: ["компот"], dishName: "Компот", calories: 80, protein: 0, fat: 0, carbs: 20, sugar: 18, portionGrams: 250 },
  {
    keys: ["молоко", "молоко 2.5%", "молоко 2,5%", "молоко 3.2%", "молоко 3,2%", "молоко ультрапастеризованное"],
    dishName: "Молоко 2,5%",
    calories: 120,
    protein: 3,
    fat: 2.5,
    carbs: 5,
    sugar: 5,
    portionGrams: 250,
  },
  { keys: ["кофе", "кофе с молоком", "латte", "латте"], dishName: "Кофе латте", calories: 120, protein: 6, fat: 5, carbs: 12, sugar: 10, portionGrams: 250 },
  { keys: ["чай", "чай с сахаром"], dishName: "Чай с сахаром", calories: 40, protein: 0, fat: 0, carbs: 10, sugar: 10, portionGrams: 250 },
  { keys: ["квас"], dishName: "Квас", calories: 90, protein: 0, fat: 0, carbs: 22, sugar: 18, portionGrams: 330 },
  { keys: ["сок", "сок яблочный"], dishName: "Сок яблочный", calories: 110, protein: 0, fat: 0, carbs: 26, sugar: 24, portionGrams: 250 },
  { keys: ["кефир"], dishName: "Кефир 2,5%", calories: 120, protein: 6, fat: 5, carbs: 9, portionGrams: 250 },
  { keys: ["йогурт", "греческий йогурт"], dishName: "Греческий йогурт", calories: 150, protein: 12, fat: 6, carbs: 10, portionGrams: 150 },
  { keys: ["сметана", "сметана 20%"], dishName: "Сметана 20%", calories: 80, protein: 1, fat: 8, carbs: 2, portionGrams: 30 },
  { keys: ["сыр", "сыр твёрдый"], dishName: "Сыр твёрдый", calories: 350, protein: 24, fat: 28, carbs: 0, portionGrams: 50 },
  { keys: ["колбаса", "колбаса докторская"], dishName: "Колбаса", calories: 280, protein: 12, fat: 24, carbs: 2, portionGrams: 100 },
  { keys: ["ветчина"], dishName: "Ветчина", calories: 180, protein: 18, fat: 10, carbs: 2, portionGrams: 80 },
  { keys: ["икра", "красная икра"], dishName: "Красная икра", calories: 120, protein: 12, fat: 8, carbs: 1, portionGrams: 30 },
  { keys: ["форель", "форель слабосолёная"], dishName: "Форель слабосолёная", calories: 180, protein: 20, fat: 10, carbs: 0, portionGrams: 80 },
  { keys: ["минтай", "рыба жареная"], dishName: "Рыба жареная", calories: 280, protein: 26, fat: 16, carbs: 6, portionGrams: 150 },
  { keys: ["картофель фри", "фри"], dishName: "Картофель фри", calories: 365, protein: 4, fat: 17, carbs: 48, portionGrams: 150 },
  { keys: ["чипсы", "chips", "lays"], dishName: "Чипсы", calories: 320, protein: 4, fat: 20, carbs: 32, portionGrams: 60 },
  { keys: ["батончик", "snickers", "сникерс"], dishName: "Шоколадный батончик", calories: 250, protein: 4, fat: 12, carbs: 32, sugar: 26, portionGrams: 50 },
  { keys: ["мороженое", "пломбир"], dishName: "Мороженое", calories: 220, protein: 4, fat: 12, carbs: 24, sugar: 22, portionGrams: 100 },
  { keys: ["печенье", "печенье овсяное"], dishName: "Печенье", calories: 180, protein: 3, fat: 8, carbs: 24, sugar: 12, portionGrams: 40 },
  { keys: ["торт", "торт медовик"], dishName: "Торт", calories: 420, protein: 5, fat: 18, carbs: 58, sugar: 38, portionGrams: 120 },
  { keys: ["кarbonara", "паста карбонара", "carbonara"], dishName: "Паста карбонара", calories: 520, protein: 22, fat: 24, carbs: 48, portionGrams: 280 },
  { keys: ["болоньезе", "паста болоньезе", "bolognese"], dishName: "Паста болоньезе", calories: 480, protein: 24, fat: 18, carbs: 52, portionGrams: 280 },
  { keys: ["хурма"], dishName: "Хурма", calories: 102, protein: 1, fat: 0, carbs: 26, fiber: 3, sugar: 18, portionGrams: 150 },
  { keys: ["банан"], dishName: "Банан", calories: 120, protein: 1, fat: 0, carbs: 28, fiber: 3, sugar: 16, portionGrams: 120 },
  { keys: ["яблоко"], dishName: "Яблоко", calories: 95, protein: 0, fat: 0, carbs: 22, fiber: 4, sugar: 18, portionGrams: 180 },
];

function normalizeRuLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function tokenizeRuLookupKey(name: string): string[] {
  return normalizeRuLookupKey(name).split(" ").filter(Boolean);
}

function matchScore(query: string, key: string): number {
  const q = normalizeRuLookupKey(query);
  const k = normalizeRuLookupKey(key);
  if (q === k) {
    return 100;
  }

  const qTokens = tokenizeRuLookupKey(query);
  const kTokens = tokenizeRuLookupKey(key);
  if (qTokens.length === 0 || kTokens.length === 0) {
    return 0;
  }

  if (kTokens.length >= qTokens.length && qTokens.every((token, index) => kTokens[index] === token)) {
    return 95 - (kTokens.length - qTokens.length);
  }

  if (kTokens.every((token) => qTokens.includes(token))) {
    return 90 - Math.abs(qTokens.length - kTokens.length);
  }

  if (qTokens.every((token) => kTokens.includes(token))) {
    if (qTokens.length === 1 && kTokens.length > 1 && kTokens[0] !== qTokens[0]) {
      return 0;
    }
    return 80 - Math.abs(qTokens.length - kTokens.length);
  }

  if (qTokens[0] === kTokens[0]) {
    return 75;
  }

  const overlap = qTokens.filter((token) => kTokens.includes(token)).length;
  if (overlap > 0) {
    const coverage = overlap / Math.max(qTokens.length, kTokens.length);
    return Math.round(30 + coverage * 30);
  }

  return 0;
}

/** Offline RU staples lookup — returns null when no confident match. */
export function lookupRuNutritionTable(dishName: string): PackNutrition | null {
  const query = dishName.trim();
  if (query.length < 3) {
    return null;
  }

  let best: { entry: RuNutritionEntry; score: number } | null = null;

  for (const entry of RU_NUTRITION_ENTRIES) {
    for (const key of entry.keys) {
      const score = matchScore(query, key);
      if (score >= 70 && (!best || score > best.score)) {
        best = { entry, score };
      }
    }
  }

  if (!best) {
    return null;
  }

  const { entry } = best;
  return {
    dishName: entry.dishName,
    calories: entry.calories,
    protein: entry.protein,
    fat: entry.fat,
    carbs: entry.carbs,
    fiber: entry.fiber,
    sugar: entry.sugar,
    portionGrams: entry.portionGrams,
    explicitPackGrams: true,
  };
}

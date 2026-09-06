/**
 * Small offline RU barcode → product hint cache for common SKUs.
 * Used as a last-resort lookup when Open Food Facts / network is unavailable.
 */

export type RuSkuHint = {
  barcode: string;
  name: string;
  brand?: string;
  /** kcal per 100 g/ml when known */
  kcalPer100?: number;
  portionGrams?: number;
};

/** Curated starter set — extend over time; keep entries conservative. */
export const RU_SKU_CACHE: RuSkuHint[] = [
  {
    barcode: "4607025390055",
    name: "Творог 5%",
    brand: "Простоквашино",
    kcalPer100: 121,
    portionGrams: 180,
  },
  {
    barcode: "4607025231266",
    name: "Кефир 3.2%",
    brand: "Простоквашино",
    kcalPer100: 56,
    portionGrams: 900,
  },
  {
    barcode: "4600605020959",
    name: "Гречневая крупа ядрица",
    brand: "Увелка",
    kcalPer100: 313,
    portionGrams: 100,
  },
  {
    barcode: "4605246001234",
    name: "Овсяные хлопья Геркулес",
    brand: "Русский продукт",
    kcalPer100: 350,
    portionGrams: 40,
  },
  {
    barcode: "4600494660159",
    name: "Молоко 2.5%",
    brand: "Домик в деревне",
    kcalPer100: 52,
    portionGrams: 1000,
  },
  {
    barcode: "4607025391120",
    name: "Йогурт натуральный 2%",
    brand: "Простоквашино",
    kcalPer100: 60,
    portionGrams: 120,
  },
  {
    barcode: "4607025234014",
    name: "Сметана 20%",
    brand: "Простоквашино",
    kcalPer100: 206,
    portionGrams: 180,
  },
  {
    barcode: "4600494661200",
    name: "Ряженка 4%",
    brand: "Домик в деревне",
    kcalPer100: 67,
    portionGrams: 450,
  },
  {
    barcode: "4607012390011",
    name: "Масло сливочное 82.5%",
    brand: "Вологодское",
    kcalPer100: 748,
    portionGrams: 10,
  },
  {
    barcode: "4607004890123",
    name: "Сыр Российский 50%",
    brand: "Лактис",
    kcalPer100: 364,
    portionGrams: 30,
  },
  {
    barcode: "4607001450018",
    name: "Хлеб белый нарезка",
    brand: "Хлебный дом",
    kcalPer100: 266,
    portionGrams: 30,
  },
  {
    barcode: "4600605022014",
    name: "Рис круглозерный",
    brand: "Увелка",
    kcalPer100: 333,
    portionGrams: 60,
  },
  {
    barcode: "4600605023103",
    name: "Макароны перья",
    brand: "Макфа",
    kcalPer100: 344,
    portionGrams: 80,
  },
  {
    barcode: "4607003340012",
    name: "Мука пшеничная высший сорт",
    brand: "Макфа",
    kcalPer100: 334,
    portionGrams: 100,
  },
  {
    barcode: "4607003341101",
    name: "Сахар-песок",
    brand: "Русский сахар",
    kcalPer100: 399,
    portionGrams: 10,
  },
  {
    barcode: "4607065330010",
    name: "Яйца куриные С1 10 шт",
    brand: "Роскар",
    kcalPer100: 157,
    portionGrams: 55,
  },
  {
    barcode: "4607001542010",
    name: "Колбаса варёная Докторская",
    brand: "Мираторг",
    kcalPer100: 257,
    portionGrams: 50,
  },
  {
    barcode: "4600494330015",
    name: "Сок яблочный",
    brand: "Добрый",
    kcalPer100: 46,
    portionGrams: 200,
  },
  {
    barcode: "4600494331203",
    name: "Вода питьевая негазированная",
    brand: "Святой источник",
    kcalPer100: 0,
    portionGrams: 500,
  },
  {
    barcode: "4607001770019",
    name: "Чай чёрный байховый",
    brand: "Greenfield",
    kcalPer100: 0,
    portionGrams: 2,
  },
  {
    barcode: "4607001772105",
    name: "Кофе растворимый",
    brand: "Jacobs",
    kcalPer100: 94,
    portionGrams: 2,
  },
  {
    barcode: "4600600770014",
    name: "Шоколад молочный",
    brand: "Алёнка",
    kcalPer100: 550,
    portionGrams: 25,
  },
  {
    barcode: "4600600771103",
    name: "Печенье Юбилейное",
    brand: "Юбилейное",
    kcalPer100: 458,
    portionGrams: 30,
  },
  {
    barcode: "4607025392202",
    name: "Сырок творожный глазированный",
    brand: "Простоквашино",
    kcalPer100: 407,
    portionGrams: 40,
  },
  {
    barcode: "4607004892104",
    name: "Творожный сыр",
    brand: "Hochland",
    kcalPer100: 214,
    portionGrams: 30,
  },
  {
    barcode: "4600494662306",
    name: "Молоко 3.2%",
    brand: "Домик в деревне",
    kcalPer100: 60,
    portionGrams: 1000,
  },
  {
    barcode: "4600605024209",
    name: "Горох колотый",
    brand: "Увелка",
    kcalPer100: 298,
    portionGrams: 50,
  },
  {
    barcode: "4607001451107",
    name: "Хлеб бородинский",
    brand: "Хлебный дом",
    kcalPer100: 201,
    portionGrams: 40,
  },

  {
    barcode: "4607001452203",
    name: "Хлеб белый нарезной",
    brand: "Хлебный дом",
    kcalPer100: 265,
    portionGrams: 30,
  },
  {
    barcode: "4607025393018",
    name: "Йогурт питьевой 1.5%",
    brand: "Простоквашино",
    kcalPer100: 52,
    portionGrams: 290,
  },
  {
    barcode: "4600494663402",
    name: "Сливки 10%",
    brand: "Домик в деревне",
    kcalPer100: 118,
    portionGrams: 100,
  },
  {
    barcode: "4607025235080",
    name: "Творожная масса с изюмом",
    brand: "Простоквашино",
    kcalPer100: 321,
    portionGrams: 180,
  },
  {
    barcode: "4600605025305",
    name: "Пшено шлифованное",
    brand: "Увелка",
    kcalPer100: 342,
    portionGrams: 60,
  },
  {
    barcode: "4607003342207",
    name: "Макароны спирали",
    brand: "Макфа",
    kcalPer100: 344,
    portionGrams: 80,
  },
  {
    barcode: "4600494332101",
    name: "Сок апельсиновый",
    brand: "Добрый",
    kcalPer100: 45,
    portionGrams: 200,
  },
  {
    barcode: "4607001773201",
    name: "Какао-порошок",
    brand: "Красный Октябрь",
    kcalPer100: 289,
    portionGrams: 10,
  },
  {
    barcode: "4600600772209",
    name: "Вафли Артек",
    brand: "Яшкино",
    kcalPer100: 514,
    portionGrams: 30,
  },
  {
    barcode: "4607001543109",
    name: "Сосиски Молочные",
    brand: "Мираторг",
    kcalPer100: 260,
    portionGrams: 50,
  },
  {
    barcode: "4607065331109",
    name: "Яйца куриные С0 10 шт",
    brand: "Роскар",
    kcalPer100: 157,
    portionGrams: 60,
  },
  {
    barcode: "4607004893200",
    name: "Сыр Гауда 45%",
    brand: "Лактис",
    kcalPer100: 356,
    portionGrams: 30,
  },
  {
    barcode: "4600494664508",
    name: "Кефир 1%",
    brand: "Домик в деревне",
    kcalPer100: 37,
    portionGrams: 900,
  },
  {
    barcode: "4600605026401",
    name: "Чечевица красная",
    brand: "Увелка",
    kcalPer100: 314,
    portionGrams: 50,
  },
  {
    barcode: "4607001453309",
    name: "Батон нарезной",
    brand: "Хлебный дом",
    kcalPer100: 262,
    portionGrams: 30,
  },

  {
    barcode: "4607025394107",
    name: "Ряженка 2.5%",
    brand: "Простоквашино",
    kcalPer100: 54,
    portionGrams: 450,
  },
  {
    barcode: "4607001774307",
    name: "Чай зелёный",
    brand: "Greenfield",
    kcalPer100: 0,
    portionGrams: 2,
  },
];

const BY_CODE = new Map(RU_SKU_CACHE.map((row) => [row.barcode, row]));

export function lookupRuSkuCache(barcode: string): RuSkuHint | null {
  const normalized = barcode.replace(/\D/g, "");
  if (!normalized) return null;
  return BY_CODE.get(normalized) ?? null;
}

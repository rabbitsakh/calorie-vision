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
  /** Soft hint for empty-calorie alcohol drinks. */
  isAlcohol?: boolean;
  brand?: string;
};

/** Typical RU home/cafe portions — offline fallback when OFF misses. */
export const RU_NUTRITION_ENTRIES: RuNutritionEntry[] = [
  { keys: ["борщ", "борщ с мясом"], dishName: "Борщ с мясом", calories: 280, protein: 12, fat: 14, carbs: 22, portionGrams: 300 },
  { keys: ["щи", "щи из свежей капусты"], dishName: "Щи", calories: 220, protein: 9, fat: 10, carbs: 18, portionGrams: 300 },
  { keys: ["солянка", "солянка мясная"], dishName: "Солянка", calories: 310, protein: 14, fat: 22, carbs: 12, portionGrams: 300 },
  { keys: ["гречка", "гречневая каша", "гречка рассыпчатая"], dishName: "Гречневая каша", calories: 180, protein: 6, fat: 2, carbs: 36, portionGrams: 200 },
  {
    keys: ["рисовое молоко", "молоко рисовое"],
    dishName: "Рисовое молоко",
    calories: 130,
    protein: 1,
    fat: 2,
    carbs: 27,
    sugar: 10,
    portionGrams: 250,
  },
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
  { keys: ["манка", "манная каша"], dishName: "Манная каша", calories: 200, protein: 6, fat: 5, carbs: 32, portionGrams: 250 },
  { keys: ["перловка", "перловая каша"], dishName: "Перловая каша", calories: 180, protein: 5, fat: 2, carbs: 36, fiber: 4, portionGrams: 200 },
  { keys: ["рассольник"], dishName: "Рассольник", calories: 260, protein: 10, fat: 12, carbs: 24, portionGrams: 300 },
  { keys: ["куриный суп", "суп куриный", "бульон куриный"], dishName: "Куриный суп", calories: 180, protein: 14, fat: 6, carbs: 14, portionGrams: 300 },
  { keys: ["сосиски", "сосиска"], dishName: "Сосиски", calories: 260, protein: 12, fat: 22, carbs: 2, portionGrams: 100 },
  { keys: ["драники", "драник"], dishName: "Драники", calories: 320, protein: 6, fat: 14, carbs: 42, portionGrams: 180 },
  { keys: ["капуста тушеная", "тушеная капуста", "капуста тушёная"], dishName: "Капуста тушёная", calories: 140, protein: 3, fat: 8, carbs: 12, fiber: 4, portionGrams: 200 },
  { keys: ["картошка жареная", "жареный картофель", "картофель жареный"], dishName: "Картофель жареный", calories: 280, protein: 4, fat: 14, carbs: 34, portionGrams: 180 },
  { keys: ["холодец", "студень"], dishName: "Холодец", calories: 220, protein: 22, fat: 14, carbs: 2, portionGrams: 150 },
  { keys: ["хачапури"], dishName: "Хачапури", calories: 420, protein: 16, fat: 22, carbs: 38, portionGrams: 180 },

  // Expanded RU staples: каши
  { keys: ["пшенка", "пшённая каша", "пшенная каша"], dishName: "Пшённая каша", calories: 190, protein: 5, fat: 3, carbs: 36, fiber: 2, portionGrams: 200 },
  { keys: ["кукурузная каша", "мамалыга"], dishName: "Кукурузная каша", calories: 180, protein: 4, fat: 2, carbs: 36, portionGrams: 200 },
  { keys: ["ячневая каша", "ячка"], dishName: "Ячневая каша", calories: 170, protein: 5, fat: 2, carbs: 34, fiber: 3, portionGrams: 200 },
  { keys: ["гороховая каша", "горох варёный", "горох вареный"], dishName: "Гороховая каша", calories: 220, protein: 12, fat: 2, carbs: 36, fiber: 8, portionGrams: 200 },
  { keys: ["рисовая каша", "рисовая каша на молоке"], dishName: "Рисовая каша на молоке", calories: 240, protein: 6, fat: 6, carbs: 40, sugar: 8, portionGrams: 250 },
  { keys: ["геркулес", "овсянка на воде"], dishName: "Овсянка на воде", calories: 160, protein: 6, fat: 3, carbs: 28, fiber: 4, portionGrams: 200 },

  // Супы
  { keys: ["харчо", "суп харчо"], dishName: "Харчо", calories: 280, protein: 14, fat: 14, carbs: 22, portionGrams: 300 },
  { keys: ["уха", "уха рыбная"], dishName: "Уха", calories: 160, protein: 16, fat: 6, carbs: 8, portionGrams: 300 },
  { keys: ["гороховый суп", "суп гороховый"], dishName: "Гороховый суп", calories: 240, protein: 12, fat: 8, carbs: 28, fiber: 6, portionGrams: 300 },
  { keys: ["грибной суп", "суп грибной"], dishName: "Грибной суп", calories: 140, protein: 4, fat: 8, carbs: 12, portionGrams: 300 },
  { keys: ["окрошка", "окрошка на квасе"], dishName: "Окрошка", calories: 220, protein: 10, fat: 10, carbs: 18, portionGrams: 350 },
  { keys: ["свекольник", "холодный борщ"], dishName: "Свекольник", calories: 120, protein: 4, fat: 4, carbs: 16, fiber: 3, portionGrams: 300 },
  { keys: ["лапша куриная", "суп с лапшой", "суп лапша"], dishName: "Суп с лапшой", calories: 200, protein: 12, fat: 6, carbs: 22, portionGrams: 300 },
  { keys: ["томатный суп", "суп томатный"], dishName: "Томатный суп", calories: 140, protein: 3, fat: 6, carbs: 18, portionGrams: 300 },
  { keys: ["тыквенный суп", "суп-пюре тыквенный"], dishName: "Тыквенный суп-пюре", calories: 160, protein: 3, fat: 8, carbs: 18, portionGrams: 300 },

  // Салаты
  { keys: ["крабовый салат", "салат крабовый"], dishName: "Крабовый салат", calories: 280, protein: 8, fat: 18, carbs: 20, portionGrams: 180 },
  { keys: ["мимоза", "салат мимоза"], dishName: "Салат мимоза", calories: 320, protein: 12, fat: 24, carbs: 12, portionGrams: 180 },
  { keys: ["греческий салат", "салат греческий"], dishName: "Греческий салат", calories: 220, protein: 6, fat: 18, carbs: 8, fiber: 2, portionGrams: 200 },
  { keys: ["капуста с маслом", "салат из капусты"], dishName: "Салат из капусты", calories: 120, protein: 2, fat: 8, carbs: 10, fiber: 3, portionGrams: 150 },
  { keys: ["селедка под шубой", "сельдь под шубой", "шуба"], dishName: "Селёдка под шубой", calories: 360, protein: 10, fat: 26, carbs: 20, portionGrams: 200 },
  { keys: ["салат цезарь с курицей"], dishName: "Салат Цезарь с курицей", calories: 380, protein: 24, fat: 24, carbs: 14, portionGrams: 220 },

  // Выпечка
  { keys: ["пирожок", "пирожок с мясом", "пирожки"], dishName: "Пирожок с мясом", calories: 280, protein: 10, fat: 14, carbs: 28, portionGrams: 90 },
  { keys: ["ватрушка", "ватрушка с творогом"], dishName: "Ватрушка с творогом", calories: 260, protein: 8, fat: 10, carbs: 34, sugar: 12, portionGrams: 100 },
  { keys: ["слойка", "слойка с сыром"], dishName: "Слойка", calories: 320, protein: 6, fat: 18, carbs: 32, portionGrams: 90 },
  { keys: ["круассан"], dishName: "Круассан", calories: 280, protein: 5, fat: 14, carbs: 32, portionGrams: 65 },
  { keys: ["булочка", "булочка сдобная"], dishName: "Булочка сдобная", calories: 240, protein: 6, fat: 6, carbs: 40, sugar: 10, portionGrams: 70 },
  { keys: ["лаваш", "лаваш армянский"], dishName: "Лаваш", calories: 220, protein: 7, fat: 1, carbs: 46, portionGrams: 80 },
  { keys: ["пирог с капустой", "пирог капустный"], dishName: "Пирог с капустой", calories: 300, protein: 8, fat: 12, carbs: 38, portionGrams: 120 },
  { keys: ["пончик", "пончики"], dishName: "Пончик", calories: 280, protein: 4, fat: 14, carbs: 34, sugar: 12, portionGrams: 70 },
  { keys: ["пряник", "пряники"], dishName: "Пряник", calories: 160, protein: 2, fat: 4, carbs: 30, sugar: 16, portionGrams: 45 },

  // Молочка
  { keys: ["ряженка", "ряженка 4%"], dishName: "Ряженка 4%", calories: 140, protein: 7, fat: 8, carbs: 10, sugar: 10, portionGrams: 250 },
  { keys: ["простокваша"], dishName: "Простокваша", calories: 130, protein: 7, fat: 6, carbs: 10, sugar: 10, portionGrams: 250 },
  { keys: ["снежок", "кисломолочный напиток снежок"], dishName: "Снежок", calories: 160, protein: 6, fat: 4, carbs: 24, sugar: 22, portionGrams: 250 },
  { keys: ["творожный сырок", "сырок", "глазированный сырок"], dishName: "Глазированный сырок", calories: 220, protein: 8, fat: 12, carbs: 20, sugar: 18, portionGrams: 50 },
  { keys: ["сливки", "сливки 10%", "сливки 20%"], dishName: "Сливки 10%", calories: 120, protein: 3, fat: 10, carbs: 4, portionGrams: 100 },
  { keys: ["масло сливочное", "сливочное масло"], dishName: "Масло сливочное", calories: 150, protein: 0, fat: 16, carbs: 0, portionGrams: 20 },
  { keys: ["молочный коктейль", "милкшейк"], dishName: "Молочный коктейль", calories: 280, protein: 8, fat: 8, carbs: 42, sugar: 36, portionGrams: 300 },

  // Полуфабрикаты
  { keys: ["наггетсы", "наггетсы куриные"], dishName: "Наггетсы куриные", calories: 280, protein: 14, fat: 16, carbs: 18, portionGrams: 100 },
  { keys: ["блинчики замороженные", "блины замороженные"], dishName: "Блинчики замороженные", calories: 260, protein: 8, fat: 10, carbs: 34, portionGrams: 120 },
  { keys: ["котлеты замороженные", "полуфабрикат котлеты"], dishName: "Котлеты замороженные", calories: 300, protein: 16, fat: 20, carbs: 12, portionGrams: 120 },
  { keys: ["лапша быстрого приготовления", "быстрая лапша", "дошик"], dishName: "Лапша быстрого приготовления", calories: 420, protein: 8, fat: 18, carbs: 56, portionGrams: 90 },
  { keys: ["пюре быстрого приготовления", "картофельное пюре быстрого"], dishName: "Пюре быстрого приготовления", calories: 180, protein: 3, fat: 6, carbs: 28, portionGrams: 50 },
  { keys: ["сосиски в тесте", "сосиска в тесте"], dishName: "Сосиска в тесте", calories: 320, protein: 12, fat: 18, carbs: 28, portionGrams: 110 },
  { keys: ["чебуреки замороженные"], dishName: "Чебуреки замороженные", calories: 360, protein: 12, fat: 20, carbs: 32, portionGrams: 120 },
  { keys: ["пельмени замороженные", "пельмени магазин"], dishName: "Пельмени магазинные", calories: 480, protein: 20, fat: 22, carbs: 48, portionGrams: 250 },

  // Alcohol staples
  {
    keys: ["пиво", "пиво светлое", "пиво лагер", "beer"],
    dishName: "Пиво светлое",
    calories: 140,
    protein: 1,
    fat: 0,
    carbs: 12,
    sugar: 0,
    portionGrams: 330,
    isAlcohol: true,
  },
  {
    keys: ["пиво тёмное", "пиво темное", "стаут"],
    dishName: "Пиво тёмное",
    calories: 160,
    protein: 1,
    fat: 0,
    carbs: 14,
    portionGrams: 330,
    isAlcohol: true,
  },
  {
    keys: ["вино", "вино красное", "вино белое", "wine"],
    dishName: "Вино",
    calories: 125,
    protein: 0,
    fat: 0,
    carbs: 4,
    sugar: 2,
    portionGrams: 150,
    isAlcohol: true,
  },
  {
    keys: ["вино игристое", "игристое", "шампанское", "просекко"],
    dishName: "Вино игристое",
    calories: 120,
    protein: 0,
    fat: 0,
    carbs: 4,
    sugar: 3,
    portionGrams: 150,
    isAlcohol: true,
  },
  {
    keys: ["водка", "водка 40%", "vodka"],
    dishName: "Водка",
    calories: 110,
    protein: 0,
    fat: 0,
    carbs: 0,
    portionGrams: 50,
    isAlcohol: true,
  },
  {
    keys: ["коньяк", "бренди"],
    dishName: "Коньяк",
    calories: 120,
    protein: 0,
    fat: 0,
    carbs: 0,
    portionGrams: 50,
    isAlcohol: true,
  },

  // RU brand packs (food only)
  {
    keys: ["простоквашино кефир", "кефир простоквашино"],
    dishName: "Кефир Простоквашино 2,5%",
    calories: 125,
    protein: 7,
    fat: 6,
    carbs: 10,
    sugar: 10,
    portionGrams: 250,
    brand: "Простоквашино",
  },
  {
    keys: ["простоквашино молоко", "молоко простоквашино"],
    dishName: "Молоко Простоквашино 2,5%",
    calories: 130,
    protein: 8,
    fat: 6,
    carbs: 12,
    sugar: 12,
    portionGrams: 250,
    brand: "Простоквашино",
  },
  {
    keys: ["простоквашино творог", "творог простоквашино"],
    dishName: "Творог Простоквашино 5%",
    calories: 170,
    protein: 26,
    fat: 8,
    carbs: 4,
    portionGrams: 160,
    brand: "Простоквашино",
  },
  {
    keys: ["активиа", "activia", "йогурт активиа"],
    dishName: "Йогурт Активиа",
    calories: 100,
    protein: 5,
    fat: 3,
    carbs: 12,
    sugar: 11,
    portionGrams: 150,
    brand: "Активиа",
  },
  {
    keys: ["актимель", "actimel"],
    dishName: "Actimel",
    calories: 70,
    protein: 3,
    fat: 2,
    carbs: 10,
    sugar: 9,
    portionGrams: 100,
    brand: "Actimel",
  },
  {
    keys: ["доширак", "доширак куриный", "доширак говяжий"],
    dishName: "Доширак",
    calories: 450,
    protein: 9,
    fat: 20,
    carbs: 58,
    portionGrams: 90,
    brand: "Доширак",
  },
  {
    keys: ["роллтон", "rollton", "лапша роллтон"],
    dishName: "Роллтон",
    calories: 420,
    protein: 8,
    fat: 18,
    carbs: 56,
    portionGrams: 85,
    brand: "Роллтон",
  },
  {
    keys: ["чудо йогурт", "йогурт чудо", "чудо коктейль"],
    dishName: "Йогурт Чудо",
    calories: 140,
    protein: 5,
    fat: 4,
    carbs: 20,
    sugar: 18,
    portionGrams: 125,
    brand: "Чудо",
  },
  {
    keys: ["вкуснотеево", "молоко вкуснотеево", "кефир вкуснотеево"],
    dishName: "Молоко Вкуснотеево 2,5%",
    calories: 130,
    protein: 8,
    fat: 6,
    carbs: 12,
    sugar: 12,
    portionGrams: 250,
    brand: "Вкуснотеево",
  },
  {
    keys: ["домик в деревне", "молоко домик в деревне"],
    dishName: "Молоко Домик в деревне",
    calories: 130,
    protein: 8,
    fat: 6,
    carbs: 12,
    sugar: 12,
    portionGrams: 250,
    brand: "Домик в деревне",
  },
  {
    keys: ["данон", "danone", "йогурт данон"],
    dishName: "Йогурт Danone",
    calories: 110,
    protein: 4,
    fat: 3,
    carbs: 15,
    sugar: 14,
    portionGrams: 125,
    brand: "Danone",
  },
  {
    keys: ["фругурт", "йогурт фругурт"],
    dishName: "Йогурт Фругурт",
    calories: 130,
    protein: 4,
    fat: 2,
    carbs: 24,
    sugar: 22,
    portionGrams: 125,
    brand: "Фругурт",
  },
  {
    keys: ["растишка", "йогурт растишка"],
    dishName: "Йогурт Растишка",
    calories: 100,
    protein: 4,
    fat: 2,
    carbs: 16,
    sugar: 14,
    portionGrams: 110,
    brand: "Растишка",
  },
  {
    keys: ["чудо творожок", "творожок чудо"],
    dishName: "Творожок Чудо",
    calories: 150,
    protein: 8,
    fat: 6,
    carbs: 16,
    sugar: 14,
    portionGrams: 100,
    brand: "Чудо",
  },
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
    brand: entry.brand,
  };
}

/** True when the dish name matches an alcohol staple (пиво, вино, водка…). */
export function dishLooksLikeAlcohol(dishName: string): boolean {
  const query = dishName.trim();
  if (query.length < 3) {
    return false;
  }

  for (const entry of RU_NUTRITION_ENTRIES) {
    if (!entry.isAlcohol) continue;
    for (const key of entry.keys) {
      if (matchScore(query, key) >= 70) {
        return true;
      }
    }
  }

  const n = normalizeRuLookupKey(query);
  return (
    n.includes("пиво") ||
    n.includes("водка") ||
    n.includes("коньяк") ||
    n.includes("шампанск") ||
    n.includes("игристое") ||
    /\b(beer|wine|vodka|prosecco)\b/.test(n)
  );
}

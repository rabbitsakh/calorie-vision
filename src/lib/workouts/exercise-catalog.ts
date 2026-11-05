/**
 * Общий справочник силовых и кардио-упражнений.
 * Источник для сида, автоподсказки и привязки пользовательских названий.
 * Тип учёта: вес и повторы, только повторы, время, дистанция.
 */

import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { MUSCLE_GROUP_KEYS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

export const TRACKING_TYPES = ["weight_reps", "reps", "time", "distance"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const EQUIPMENT_KEYS = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "cardio",
  "other",
] as const;
export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

export const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
  barbell: "Штанга",
  dumbbell: "Гантели",
  machine: "Тренажёр",
  cable: "Блок",
  bodyweight: "Свой вес",
  kettlebell: "Гиря",
  band: "Резина",
  cardio: "Кардио",
  other: "Другое",
};

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: "Вес и повторы",
  reps: "Повторы",
  time: "Время",
  distance: "Дистанция",
};

export type CatalogExercise = {
  id: string;
  name: string;
  nameNorm: string;
  tracking: TrackingType;
  kind: ExerciseKind;
  primary: MuscleGroupKey[];
  secondary: MuscleGroupKey[];
  equipment: EquipmentKey;
  synonyms: string[];
  synonymNorms: string[];
  defaultRestSec: number;
  sortOrder: number;
};

type Row = [
  id: string,
  name: string,
  tracking: TrackingType,
  primary: string,
  secondary: string,
  equipment: EquipmentKey,
  rest: number,
  synonyms: string,
  kind?: ExerciseKind,
];

function muscles(raw: string): MuscleGroupKey[] {
  if (!raw.trim()) return [];
  const out: MuscleGroupKey[] = [];
  for (const part of raw.split(",")) {
    const key = part.trim();
    if ((MUSCLE_GROUP_KEYS as readonly string[]).includes(key)) {
      out.push(key as MuscleGroupKey);
    }
  }
  return out;
}

function kindFor(tracking: TrackingType, override?: ExerciseKind): ExerciseKind {
  if (override) return override;
  if (tracking === "reps") return "bodyweight";
  if (tracking === "time") return "duration";
  if (tracking === "distance") return "cardio";
  return "strength";
}

function build(rows: readonly Row[]): CatalogExercise[] {
  return rows.map((row, index) => {
    const synonyms = row[7]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const primary = muscles(row[3]);
    return {
      id: row[0],
      name: row[1],
      nameNorm: normalizeExerciseName(row[1]),
      tracking: row[2],
      kind: kindFor(row[2], row[8]),
      primary,
      secondary: muscles(row[4]),
      equipment: row[5],
      synonyms,
      synonymNorms: synonyms.map((s) => normalizeExerciseName(s)).filter(Boolean),
      defaultRestSec: row[6],
      sortOrder: index,
    };
  });
}

const ROWS: readonly Row[] = [
  ["bench-press", "Жим штанги лёжа", "weight_reps", "chest", "triceps,shoulders", "barbell", 180, "жим лежа|bench press|жим штанги лежа|горизонтальный жим"],
  ["bench-close", "Жим штанги лёжа узким хватом", "weight_reps", "triceps", "chest", "barbell", 150, "жим узким хватом|close grip bench"],
  ["bench-incline", "Жим штанги на наклонной", "weight_reps", "chest", "shoulders,triceps", "barbell", 180, "жим на наклонной|incline bench press|жим в наклоне"],
  ["bench-decline", "Жим штанги головой вниз", "weight_reps", "chest", "triceps", "barbell", 150, "жим вниз головой|decline bench"],
  ["db-bench", "Жим гантелей лёжа", "weight_reps", "chest", "triceps,shoulders", "dumbbell", 150, "жим гантелей|dumbbell bench press"],
  ["db-incline", "Жим гантелей на наклонной", "weight_reps", "chest", "shoulders", "dumbbell", 150, "жим гантелей в наклоне|incline dumbbell press"],
  ["db-decline", "Жим гантелей головой вниз", "weight_reps", "chest", "triceps", "dumbbell", 120, "жим гантелей вниз"],
  ["machine-press", "Жим в тренажёре лёжа", "weight_reps", "chest", "triceps", "machine", 120, "жим в тренажере|chest press|жим от груди в тренажере"],
  ["machine-incline", "Жим в тренажёре на наклонной", "weight_reps", "chest", "shoulders", "machine", 120, "наклонный жим в тренажере"],
  ["hammer-press", "Жим в Хаммере", "weight_reps", "chest", "triceps", "machine", 120, "хаммер на грудь|hammer press|жим хаммер"],
  ["pec-deck", "Сведение рук в тренажёре", "weight_reps", "chest", "", "machine", 90, "бабочка|pec deck|сведения в тренажере|бабочка на грудь|сведение на грудь|сведение на грудь в тренажере"],
  ["cable-fly", "Сведение рук в кроссовере", "weight_reps", "chest", "", "cable", 90, "кроссовер|cable fly|сведения в кроссовере"],
  ["cable-fly-low", "Сведение в кроссовере снизу", "weight_reps", "chest", "shoulders", "cable", 90, "кроссовер снизу|low cable fly"],
  ["cable-fly-high", "Сведение в кроссовере сверху", "weight_reps", "chest", "", "cable", 90, "кроссовер сверху|high cable fly"],
  ["db-fly", "Разводка гантелей лёжа", "weight_reps", "chest", "", "dumbbell", 90, "разводка|dumbbell fly|разведения гантелей"],
  ["db-fly-incline", "Разводка гантелей на наклонной", "weight_reps", "chest", "", "dumbbell", 90, "разводка в наклоне"],
  ["dips", "Отжимания на брусьях", "reps", "chest", "triceps", "bodyweight", 120, "брусья|dips|отжимания на брусьях на грудь"],
  ["dips-weighted", "Отжимания на брусьях с весом", "weight_reps", "chest", "triceps", "bodyweight", 150, "брусья с весом|weighted dips", "weighted_bw"],
  ["dips-assisted", "Отжимания на брусьях с помощью", "weight_reps", "chest", "triceps", "machine", 90, "гравитрон брусья|assisted dips", "assisted"],
  ["pushup", "Отжимания от пола", "reps", "chest", "triceps,shoulders", "bodyweight", 60, "отжимания|push up|push-up|отжимания классические"],
  ["pushup-knee", "Отжимания с колен", "reps", "chest", "triceps", "bodyweight", 60, "отжимания с коленей"],
  ["pushup-diamond", "Алмазные отжимания", "reps", "triceps", "chest", "bodyweight", 60, "алмазные|diamond push up"],
  ["bench-dip", "Отжимания от скамьи", "reps", "triceps", "chest", "bodyweight", 60, "обратные отжимания|bench dip|обратное отжимание от скамьи на трицепс|обратные отжимания от скамьи"],
  ["db-pullover", "Пуловер с гантелью", "weight_reps", "chest", "back", "dumbbell", 90, "пуловер|pullover"],
  ["bb-pullover", "Пуловер со штангой", "weight_reps", "chest", "back", "barbell", 90, "пуловер штанга"],
  ["svend-press", "Жим Свенда", "weight_reps", "chest", "", "other", 75, "svend press"],
  ["smith-bench", "Жим лёжа в Смите", "weight_reps", "chest", "triceps", "machine", 150, "жим в смите|smith bench press"],
  ["smith-incline", "Жим на наклонной в Смите", "weight_reps", "chest", "shoulders", "machine", 150, "наклонный смит"],

  ["deadlift", "Становая тяга", "weight_reps", "back", "legs", "barbell", 180, "становая|deadlift|классическая становая"],
  ["deadlift-sumo", "Становая тяга сумо", "weight_reps", "legs", "back", "barbell", 180, "сумо|sumo deadlift|тяга сумо"],
  ["trap-bar", "Становая тяга с трэп-грифом", "weight_reps", "legs", "back", "barbell", 180, "трэп гриф|trap bar deadlift|гексагриф"],
  ["bb-row", "Тяга штанги в наклоне", "weight_reps", "back", "biceps", "barbell", 150, "тяга штанги|barbell row|тяга в наклоне|тяга штанги на спину в наклоне"],
  ["bb-row-under", "Тяга штанги обратным хватом", "weight_reps", "back", "biceps", "barbell", 150, "тяга обратным|yates row|тяга йейтса"],
  ["pendlay", "Тяга Пендли", "weight_reps", "back", "biceps", "barbell", 150, "pendlay row|тяга с пола"],
  ["t-bar", "Тяга Т-грифа", "weight_reps", "back", "biceps", "barbell", 150, "т гриф|t-bar row|тяга т-штанги"],
  ["db-row", "Тяга гантели в наклоне", "weight_reps", "back", "biceps", "dumbbell", 120, "тяга гантели|one arm row|тяга одной рукой|тяга гантели на спину"],
  ["db-row-both", "Тяга гантелей в наклоне", "weight_reps", "back", "biceps", "dumbbell", 120, "тяга двух гантелей"],
  ["seated-row", "Тяга блока к поясу", "weight_reps", "back", "biceps", "cable", 120, "горизонтальная тяга|seated row|тяга горизонтального блока|тяга нижнего блока|гребковая тяга|гребная тяга|лоу роу|low row|тяга на спину|тяга на спину в тренажере лоу роу"],
  ["lat-pulldown", "Тяга верхнего блока", "weight_reps", "back", "biceps", "cable", 120, "пулдаун|pulldown|lat pulldown|тяга блока на спину|пулдаун в тренажере|тяга верхнего блока к груди|тяга блока широким хватом"],
  ["pulldown-close", "Тяга верхнего блока узким хватом", "weight_reps", "back", "biceps", "cable", 120, "пулдаун узким|close grip pulldown"],
  ["pulldown-under", "Тяга верхнего блока обратным хватом", "weight_reps", "back", "biceps", "cable", 120, "пулдаун обратным"],
  ["pulldown-wide", "Тяга верхнего блока широким хватом", "weight_reps", "back", "", "cable", 120, "широкий пулдаун"],
  ["straight-arm", "Тяга блока прямыми руками", "weight_reps", "back", "", "cable", 90, "пуловер в блоке|straight arm pulldown"],
  ["pullup", "Подтягивания", "reps", "back", "biceps", "bodyweight", 120, "подтягивания прямым|pull up|pull-up|турник"],
  ["chinup", "Подтягивания обратным хватом", "reps", "biceps", "back", "bodyweight", 120, "подтягивания узким|chin up|обратные подтягивания"],
  ["pullup-wide", "Подтягивания широким хватом", "reps", "back", "biceps", "bodyweight", 120, "широкие подтягивания"],
  ["pullup-neutral", "Подтягивания нейтральным хватом", "reps", "back", "biceps", "bodyweight", 120, "нейтральные подтягивания"],
  ["pullup-weighted", "Подтягивания с весом", "weight_reps", "back", "biceps", "bodyweight", 150, "подтягивания с отягощением|weighted pull up", "weighted_bw"],
  ["pullup-assisted", "Подтягивания с помощью", "weight_reps", "back", "biceps", "machine", 90, "гравитрон|assisted pull up|подтягивания в гравитроне", "assisted"],
  ["hammer-row", "Тяга в Хаммере", "weight_reps", "back", "biceps", "machine", 120, "хаммер на спину|hammer row"],
  ["back-ext", "Гиперэкстензия", "reps", "back", "legs", "bodyweight", 60, "гиперэкстензия на римском|back extension"],
  ["reverse-hyper", "Обратная гиперэкстензия", "reps", "back", "legs", "machine", 60, "обратная гипер|reverse hyper"],
  ["bb-shrug", "Шраги со штангой", "weight_reps", "back", "", "barbell", 90, "шраги|barbell shrug|трапеции со штангой"],
  ["db-shrug", "Шраги с гантелями", "weight_reps", "back", "", "dumbbell", 90, "шраги гантели|dumbbell shrug"],
  ["smith-row", "Тяга в наклоне в Смите", "weight_reps", "back", "biceps", "machine", 120, "тяга в смите"],
  ["kb-row", "Тяга гири в наклоне", "weight_reps", "back", "biceps", "kettlebell", 90, "тяга гири"],

  ["ohp", "Жим штанги стоя", "weight_reps", "shoulders", "triceps", "barbell", 150, "шолдер пресс|shoulder press|армейский жим|жим стоя|overhead press|military press|жим штанги над головой"],
  ["ohp-seated", "Жим штанги сидя", "weight_reps", "shoulders", "triceps", "barbell", 150, "жим сидя|seated press|жим штанги с груди сидя"],
  ["db-ohp", "Жим гантелей сидя", "weight_reps", "shoulders", "triceps", "dumbbell", 120, "жим гантелей на плечи|dumbbell shoulder press|жим гантелей вверх|подъем гантелей на плечи|подъемы гантелей на плечи"],
  ["db-ohp-stand", "Жим гантелей стоя", "weight_reps", "shoulders", "triceps", "dumbbell", 120, "жим гантелей стоя"],
  ["machine-ohp", "Жим в тренажёре на плечи", "weight_reps", "shoulders", "triceps", "machine", 120, "жим плеч в тренажере|shoulder press machine|подъем на плечи в тренажере|подъем на плечи в тренажере шолдер пресс|тренажер на плечи shoulder press|тренажер на плечи|шолдер пресс в тренажере"],
  ["smith-ohp", "Жим в Смите на плечи", "weight_reps", "shoulders", "triceps", "machine", 120, "подъем на плечи в смите|подъем на плечи в тренажере смита|жим в смите на плечи|smith shoulder press|шолдер пресс в смите"],
  ["arnold", "Жим Арнольда", "weight_reps", "shoulders", "triceps", "dumbbell", 120, "arnold press|арнольд жим"],
  ["lateral", "Махи гантелей в стороны", "weight_reps", "shoulders", "", "dumbbell", 75, "махи в стороны|lateral raise|отведения гантелей|разведение гантелей на плечи|разведения гантелей на плечи"],
  ["lateral-seated", "Махи гантелей сидя", "weight_reps", "shoulders", "", "dumbbell", 75, "махи сидя"],
  ["rear-delt", "Махи в наклоне", "weight_reps", "shoulders", "back", "dumbbell", 75, "махи назад|rear delt fly|задняя дельта"],
  ["cable-lateral", "Махи в блоке в стороны", "weight_reps", "shoulders", "", "cable", 75, "отведения в блоке|cable lateral raise"],
  ["upright-row", "Тяга штанги к подбородку", "weight_reps", "shoulders", "back", "barbell", 90, "протяжка|upright row|тяга к подбородку"],
  ["ez-upright", "Протяжка с EZ-грифом", "weight_reps", "shoulders", "", "barbell", 90, "протяжка с ez"],
  ["front-raise", "Фронтальные подъёмы гантелей", "weight_reps", "shoulders", "", "dumbbell", 75, "подъемы перед собой|front raise"],
  ["plate-raise", "Фронтальные подъёмы блина", "weight_reps", "shoulders", "", "other", 75, "подъем блина"],
  ["reverse-pec", "Разводка на заднюю дельту", "weight_reps", "shoulders", "back", "machine", 75, "задняя дельта в тренажере|reverse pec deck|обратная бабочка|бабочка на заднюю дельту|разведение на заднюю дельту бабочка|разводка на заднюю дельту бабочка"],
  ["face-pull", "Тяга к лицу", "weight_reps", "shoulders", "back", "cable", 75, "фейс пул|face pull|тяга каната к лицу"],
  ["btw-press", "Жим штанги из-за головы", "weight_reps", "shoulders", "triceps", "barbell", 120, "жим из за головы"],
  ["kb-press", "Жим гири стоя", "weight_reps", "shoulders", "triceps", "kettlebell", 90, "жим гири|kettlebell press"],

  ["bb-curl", "Подъём штанги на бицепс", "weight_reps", "biceps", "", "barbell", 90, "подъем на бицепс|barbell curl|сгибания со штангой|бицепс штанга|подъем штанги на бицепс стоя"],
  ["ez-curl", "Подъём EZ-штанги на бицепс", "weight_reps", "biceps", "", "barbell", 90, "ez штанга|ez bar curl|подъем ez"],
  ["db-curl", "Подъём гантелей на бицепс", "weight_reps", "biceps", "", "dumbbell", 75, "сгибания с гантелями|dumbbell curl|бицепс гантели"],
  ["hammer-curl", "Молотковые сгибания", "weight_reps", "biceps", "", "dumbbell", 75, "молотки|hammer curl|молот|молотки на бицепс|молотки на бийепс"],
  ["preacher", "Сгибания на скамье Скотта", "weight_reps", "biceps", "", "barbell", 90, "скамья скотта|preacher curl"],
  ["cable-curl", "Сгибания в блоке на бицепс", "weight_reps", "biceps", "", "cable", 75, "бицепс в блоке|cable curl|сгибание нижнего блока|тяга блока в приседе на бицепс"],
  ["machine-curl", "Сгибания в тренажёре на бицепс", "weight_reps", "biceps", "", "machine", 75, "сгибание в тренажере на бицепс|biceps curl machine|бицепс тренажер"],
  ["concentration", "Концентрированные сгибания", "weight_reps", "biceps", "", "dumbbell", 60, "концентрированный подъем|concentration curl"],
  ["reverse-curl", "Подъём штанги обратным хватом", "weight_reps", "biceps", "", "barbell", 75, "обратный хват на бицепс|reverse curl|подъем штанги на бицепс стоя обратным хватом узко|подъем штанги обратным хватом узко"],
  ["incline-curl", "Сгибания на наклонной скамье", "weight_reps", "biceps", "", "dumbbell", 75, "бицепс на наклонной|incline curl"],
  ["spider-curl", "Паучьи сгибания", "weight_reps", "biceps", "", "dumbbell", 60, "spider curl"],

  ["skull", "Французский жим лёжа", "weight_reps", "triceps", "", "barbell", 90, "французский жим|skullcrusher|разгибания лёжа"],
  ["french-seated", "Французский жим сидя", "weight_reps", "triceps", "", "dumbbell", 90, "французский сидя|overhead extension"],
  ["pushdown", "Разгибания на блоке", "weight_reps", "triceps", "", "cable", 75, "разгибания рук|pushdown|трицепс на блоке|разгибание верхнего блока|тяга в блоке на трицепс|сет на трицепс в блочном тренажере"],
  ["rope-pushdown", "Разгибания на блоке с канатом", "weight_reps", "triceps", "", "cable", 75, "канат на трицепс|rope pushdown"],
  ["oh-db-ext", "Разгибания из-за головы с гантелью", "weight_reps", "triceps", "", "dumbbell", 75, "трицепс из за головы|overhead dumbbell extension"],
  ["oh-rope", "Разгибания с канатом из-за головы", "weight_reps", "triceps", "", "cable", 75, "канат из за головы"],
  ["cable-oh-behind", "Разгибания на блоке из-за спины", "weight_reps", "triceps", "", "cable", 75, "тяга в блоке на трицепс из за спины|разгибания из за спины|трицепс из за спины|overhead cable extension"],
  ["kickback", "Кикбэк с гантелью", "weight_reps", "triceps", "", "dumbbell", 60, "кикбек|kickback"],
  ["tate-press", "Жим Тейта", "weight_reps", "triceps", "chest", "dumbbell", 75, "tate press"],

  ["squat", "Приседания со штангой", "weight_reps", "legs", "", "barbell", 180, "присед|приседания|squat|back squat|присед со штангой"],
  ["front-squat", "Фронтальные приседания", "weight_reps", "legs", "", "barbell", 180, "фронтальный присед|front squat|присед со штангой на груди"],
  ["smith-squat", "Приседания в Смите", "weight_reps", "legs", "", "machine", 150, "присед в смите|smith squat"],
  ["squat-machine", "Приседания в тренажёре", "weight_reps", "legs", "", "machine", 150, "скват в тренажере|скват в тренажере приседания|присед в тренажере|squat machine|приседания в тренажере"],
  ["goblet", "Гоблет-приседания", "weight_reps", "legs", "", "dumbbell", 90, "гоблет|goblet squat|кубковые приседания"],
  ["db-squat", "Приседания с гантелями", "weight_reps", "legs", "", "dumbbell", 120, "присед с гантелями"],
  ["leg-press", "Жим ногами", "weight_reps", "legs", "", "machine", 150, "жим платформы|leg press|платформа|ножной пресс|ножной пресс тренажер|ножной жим"],
  ["leg-press-single", "Жим одной ногой", "weight_reps", "legs", "", "machine", 120, "жим одной ногой в тренажере"],
  ["hack-squat", "Гакк-приседания", "weight_reps", "legs", "", "machine", 150, "гакк|hack squat"],
  ["lunge-bb", "Выпады со штангой", "weight_reps", "legs", "", "barbell", 120, "выпады|barbell lunge"],
  ["lunge-forward", "Выпады вперёд", "weight_reps", "legs", "", "bodyweight", 90, "выпады вперед|forward lunge|выпады вперед с весом", "weighted_bw"],
  ["lunge-db", "Выпады с гантелями", "weight_reps", "legs", "", "dumbbell", 90, "выпады гантели|dumbbell lunge"],
  ["bulgarian", "Болгарские выпады", "weight_reps", "legs", "", "dumbbell", 90, "болгарские|bulgarian split squat"],
  ["walking-lunge", "Выпады шагами", "weight_reps", "legs", "", "dumbbell", 90, "шагающие выпады|walking lunge"],
  ["smith-lunge", "Выпады в Смите", "weight_reps", "legs", "", "machine", 120, "выпады смит"],
  ["rdl", "Румынская тяга", "weight_reps", "legs", "back", "barbell", 150, "румынка|romanian deadlift|rdl|румынская тяга со штангой"],
  ["rdl-db", "Румынская тяга с гантелями", "weight_reps", "legs", "back", "dumbbell", 120, "румынка с гантелями"],
  ["rdl-single", "Румынская тяга на одной ноге", "weight_reps", "legs", "back", "dumbbell", 90, "румынка на одной"],
  ["leg-curl", "Сгибание ног лёжа", "weight_reps", "legs", "", "machine", 75, "сгибание ног|leg curl|сгибания ног в тренажере|бицепс бедра|сгибание в тренажере"],
  ["leg-curl-seat", "Сгибание ног сидя", "weight_reps", "legs", "", "machine", 75, "сгибание ног сидя"],
  ["leg-curl-stand", "Сгибание ног стоя", "weight_reps", "legs", "", "machine", 75, "сгибание ног стоя"],
  ["leg-ext", "Разгибание ног", "weight_reps", "legs", "", "machine", 75, "разгибания ног|leg extension|квадрицепс в тренажере|разгибание в тренажере|разгибания в тренажере"],
  ["hip-thrust", "Ягодичный мост со штангой", "weight_reps", "legs", "", "barbell", 120, "ягодичный мост|hip thrust|мостик со штангой"],
  ["hip-thrust-machine", "Ягодичный мост в тренажёре", "weight_reps", "legs", "", "machine", 90, "мостик в тренажере"],
  ["glute-bridge", "Подъём таза лёжа", "reps", "legs", "", "bodyweight", 60, "ягодичный мостик|glute bridge"],
  ["abductor", "Разведение ног в тренажёре", "weight_reps", "legs", "", "machine", 60, "отведение бедра|hip abduction|разведение"],
  ["adductor", "Сведение ног в тренажёре", "weight_reps", "legs", "", "machine", 60, "приведение бедра|hip adduction|сведение ног"],
  ["cable-kick", "Махи ногой назад в кроссовере", "weight_reps", "legs", "", "cable", 60, "махи назад ногой|cable kickback"],
  ["calf-stand", "Подъём на носки стоя", "weight_reps", "legs", "", "machine", 60, "икры стоя|standing calf raise|подъем на носки"],
  ["calf-seat", "Подъём на носки сидя", "weight_reps", "legs", "", "machine", 60, "икры сидя|seated calf raise"],
  ["calf-machine", "Подъём на носки в тренажёре", "weight_reps", "legs", "", "machine", 60, "икры в тренажере"],
  ["step-up", "Зашагивания на тумбу", "weight_reps", "legs", "", "dumbbell", 90, "зашагивания|step up"],
  ["plie", "Приседания плие", "weight_reps", "legs", "", "dumbbell", 90, "плие|plie squat|присед сумо с гантелью"],
  ["pistol", "Приседания на одной ноге", "reps", "legs", "", "bodyweight", 90, "пистолетик|pistol squat"],
  ["pause-squat", "Приседания с паузой", "weight_reps", "legs", "", "barbell", 180, "присед с паузой|pause squat"],
  ["kb-squat", "Приседания с гирей", "weight_reps", "legs", "", "kettlebell", 90, "присед с гирей"],
  ["band-abd", "Отведение ноги с резинкой", "reps", "legs", "", "band", 45, "резинка на ягодицы|band abduction"],

  ["crunch", "Скручивания", "reps", "abs", "", "bodyweight", 45, "скручивания на пресс|crunch"],
  ["cable-crunch", "Скручивания на блоке", "weight_reps", "abs", "", "cable", 60, "молитва|cable crunch"],
  ["hanging-leg", "Подъём ног в висе", "reps", "abs", "", "bodyweight", 60, "подъем ног|hanging leg raise"],
  ["hanging-knee", "Подъём коленей в висе", "reps", "abs", "", "bodyweight", 60, "колени в висе"],
  ["plank", "Планка", "time", "abs", "", "bodyweight", 45, "планка на предплечьях|plank|фронтальная планка"],
  ["side-plank", "Боковая планка", "time", "abs", "", "bodyweight", 45, "боковая|side plank"],
  ["russian", "Русские скручивания", "reps", "abs", "", "bodyweight", 45, "русские твисты|russian twist"],
  ["bicycle", "Велосипед", "reps", "abs", "", "bodyweight", 45, "велосипед на пресс|bicycle crunch"],
  ["ab-wheel", "Ролик для пресса", "reps", "abs", "", "other", 60, "колесо|ab wheel"],
  ["woodchop", "Дровосек в блоке", "weight_reps", "abs", "", "cable", 60, "дровосек|woodchop"],
  ["lying-leg", "Подъём ног лёжа", "reps", "abs", "", "bodyweight", 45, "подъем ног лежа"],
  ["reverse-crunch", "Обратные скручивания", "reps", "abs", "", "bodyweight", 45, "обратные скручивания"],
  ["shoulder-tap", "Планка с касанием плеч", "reps", "abs", "shoulders", "bodyweight", 45, "касания плеч"],
  ["climber", "Скалолаз", "time", "abs", "legs", "bodyweight", 30, "скалолаз|mountain climber"],
  ["side-bend", "Наклоны в стороны с гантелью", "weight_reps", "abs", "", "dumbbell", 45, "наклоны в стороны"],
  ["ball-crunch", "Скручивания на фитболе", "reps", "abs", "", "other", 45, "пресс на мяче"],

  ["run", "Бег", "distance", "cardio", "", "cardio", 0, "бег на улице|run|running"],
  ["treadmill", "Бег на дорожке", "distance", "cardio", "", "cardio", 0, "дорожка|treadmill|беговая дорожка|бег на беговой дорожке"],
  ["walk", "Ходьба", "distance", "cardio", "", "cardio", 0, "ходьба|walk"],
  ["walk-tread", "Ходьба на дорожке", "distance", "cardio", "", "cardio", 0, "ходьба дорожка"],
  ["walk-incline", "Ходьба в горку", "distance", "cardio", "legs", "cardio", 0, "ходьба в наклоне|incline walk"],
  ["bike-out", "Велосипед", "distance", "cardio", "legs", "cardio", 0, "велосипед на улице|bike|cycling"],
  ["bike", "Велотренажёр", "distance", "cardio", "legs", "cardio", 0, "велотренажер|exercise bike|велосипед тренажер"],
  ["spin", "Сайкл", "time", "cardio", "legs", "cardio", 0, "спиннинг|spin bike|сайклинг"],
  ["ellipse", "Эллипс", "time", "cardio", "legs", "cardio", 0, "эллипсоид|elliptical"],
  ["row-erg", "Гребля", "distance", "cardio", "back", "cardio", 0, "гребной тренажер|rowing|row erg"],
  ["row-water", "Гребля на воде", "distance", "cardio", "back", "cardio", 0, "академическая гребля"],
  ["rope", "Скакалка", "time", "cardio", "legs", "other", 30, "прыжки на скакалке|jump rope"],
  ["stepper", "Степпер", "time", "cardio", "legs", "cardio", 0, "степпер|stair climber"],
  ["swim", "Плавание", "distance", "cardio", "", "cardio", 0, "бассейн|swim|swimming"],
  ["burpee", "Берпи", "reps", "cardio", "legs,chest", "bodyweight", 30, "бёрпи|burpee"],
  ["ski-erg", "Лыжный тренажёр", "time", "cardio", "back", "cardio", 0, "лыжи|ski erg"],
  ["interval-run", "Интервальный бег", "time", "cardio", "", "cardio", 0, "интервалы|hiit run"],

  ["farmer", "Прогулка фермера", "weight_reps", "other", "back,legs", "dumbbell", 60, "фермерская прогулка|farmer walk"],
  ["kb-swing", "Махи гирей", "weight_reps", "legs", "back,shoulders", "kettlebell", 60, "свинг|kettlebell swing|махи гирей двумя руками"],
  ["kb-snatch", "Рывок гири", "weight_reps", "shoulders", "legs,back", "kettlebell", 90, "рывок|kettlebell snatch"],
  ["getup", "Турецкий подъём", "weight_reps", "other", "shoulders,abs", "kettlebell", 60, "турецкий подъем|turkish get up"],
  ["ring-pushup", "Отжимания на кольцах", "reps", "chest", "triceps", "bodyweight", 90, "кольца отжимания"],
  ["ring-pullup", "Подтягивания на кольцах", "reps", "back", "biceps", "bodyweight", 120, "кольца подтягивания"],
];

export const EXERCISE_CATALOG: readonly CatalogExercise[] = build(ROWS);

const BY_ID = new Map(EXERCISE_CATALOG.map((row) => [row.id, row]));

export function catalogById(id: string): CatalogExercise | null {
  return BY_ID.get(id) ?? null;
}

/** Поля справочника для upsert. id стабильный, его не переписываем. */
export type CatalogSeedData = {
  id: string;
  name: string;
  nameNorm: string;
  tracking: TrackingType;
  kind: ExerciseKind;
  primaryMuscles: MuscleGroupKey[];
  secondaryMuscles: MuscleGroupKey[];
  equipment: EquipmentKey;
  synonyms: string[];
  defaultRestSec: number;
  sortOrder: number;
};

export function toCatalogSeedData(row: CatalogExercise): CatalogSeedData {
  return {
    id: row.id,
    name: row.name,
    nameNorm: row.nameNorm,
    tracking: row.tracking,
    kind: row.kind,
    primaryMuscles: row.primary,
    secondaryMuscles: row.secondary,
    equipment: row.equipment,
    synonyms: row.synonyms,
    defaultRestSec: row.defaultRestSec,
    sortOrder: row.sortOrder,
  };
}

export type CatalogUpsertPlan = {
  inserts: CatalogSeedData[];
  updates: CatalogSeedData[];
  /** Id, которые уже есть в базе, но нет в коде. Скрипт их не удаляет. */
  kept: string[];
};

/** На заполненной базе: новые id — insert, известные id — update синонимов. Чужие id не трогаем. */
export function planCatalogUpsert(
  existingIds: Iterable<string>,
  rows: readonly CatalogSeedData[] = EXERCISE_CATALOG.map(toCatalogSeedData),
): CatalogUpsertPlan {
  const have = new Set(existingIds);
  const seen = new Set<string>();
  const inserts: CatalogSeedData[] = [];
  const updates: CatalogSeedData[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) {
      throw new Error(`Повтор id справочника: ${row.id}`);
    }
    seen.add(row.id);
    if (have.has(row.id)) updates.push(row);
    else inserts.push(row);
  }
  const kept = [...have].filter((id) => !seen.has(id));
  return { inserts, updates, kept };
}

export function equipmentLabel(key: string): string {
  if ((EQUIPMENT_KEYS as readonly string[]).includes(key)) {
    return EQUIPMENT_LABELS[key as EquipmentKey];
  }
  return key;
}

/** Один показ тура по залу. Без поля в базе. */
export const GYM_TOUR_STORAGE_KEY = "cv-gym-tour-v1";

export type GymTourStep = {
  id: "muscles" | "programs" | "coach" | "assistant";
  title: string;
  body: string;
  href: "/workouts" | "/ration";
  /** Куда смотреть: data-tour на экране. */
  target: "gym-today" | "gym-programs" | "gym-coach" | "assistant";
};

export const GYM_TOUR_STEPS: readonly GymTourStep[] = [
  {
    id: "muscles",
    title: "Карта мышц",
    body: "Зал → Сегодня. Карточка «Мышцы · объём» появляется, когда за неделю уже есть силовые.",
    href: "/workouts",
    target: "gym-today",
  },
  {
    id: "programs",
    title: "Программы",
    body: "Зал → Ещё → Шаблоны. «Готовые программы»: Фулбади, Сплит и 5×5. В дневник — только после «Сохранить».",
    href: "/workouts",
    target: "gym-programs",
  },
  {
    id: "coach",
    title: "ИИ-тренер",
    body: "Там же блок «Собрать под себя». «Предложить тренировку» — черновик, не запись и не медицинский совет.",
    href: "/workouts",
    target: "gym-coach",
  },
  {
    id: "assistant",
    title: "ИИ-ассистент",
    body: "На «Сегодня» искра справа внизу. Тот же чат открывается из меню «Я».",
    href: "/ration",
    target: "assistant",
  },
];

export function shouldShowGymTour(seen: boolean, authenticated: boolean): boolean {
  return authenticated && !seen;
}

export function readGymTourSeen(storage: Pick<Storage, "getItem"> | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(GYM_TOUR_STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}

export function markGymTourSeen(storage: Pick<Storage, "setItem"> | null): void {
  if (!storage) return;
  try {
    storage.setItem(GYM_TOUR_STORAGE_KEY, "done");
  } catch {
    // Приватный режим: тур просто закроется до следующей загрузки.
  }
}

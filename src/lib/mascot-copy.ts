/**
 * Centralized Russian copy for mascot companion surfaces (empty diary, push prompt).
 */

export const MASCOT_COPY = {
  emptyDiary: {
    /** Accessible / title attribute on the empty-state mascot. */
    title: "Пустой дневник",
    headline: "Дневник пуст — добавьте первый приём пищи",
    body: "Сфотографируйте тарелку или введите название — прогресс появится сразу.",
  },
  pushPrompt: {
    title: "Напоминания от талисмана",
    body: "Завтрак, обед, вода, сводка калорий, серия и вечерний чек-ин — без давления.",
    enable: "Включить",
    enabling: "Подключаем…",
    install: "Установить приложение",
    later: "Не сейчас",
  },
  pushIosHint: {
    title: "Напоминания на iPhone",
    fallbackBody:
      "Откройте приложение с иконки на экране «Домой» — из Safari push не приходит.",
    statusHint: "Статус можно проверить в разделе «Профиль».",
    install: "Как установить",
    dismiss: "Понятно",
  },
} as const;

export type MascotCopy = typeof MASCOT_COPY;

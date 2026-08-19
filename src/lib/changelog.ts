export type ChangelogItemKind = "feature" | "fix" | "improvement";

export type ChangelogItem = {
  kind: ChangelogItemKind;
  text: string;
};

export type ChangelogRelease = {
  version: string;
  date: string;
  summary?: string;
  items: ChangelogItem[];
};

export const CHANGELOG_KIND_LABELS: Record<ChangelogItemKind, string> = {
  feature: "Новое",
  fix: "Исправление",
  improvement: "Улучшение",
};

/** Краткий журнал изменений Calorie Vision — новые версии сверху. */
export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "0.5.9",
    date: "2026-08-19",
    summary: "Распознавание тарелки и дневник",
    items: [
      { kind: "feature", text: "Несколько блюд на одном фото — каждое сохраняется отдельно и группируется в дневнике" },
      { kind: "feature", text: "Приложение запоминает ваши исправления названий и калорий при распознавании" },
      { kind: "improvement", text: "После сохранения поля ввода еды очищаются" },
      { kind: "fix", text: "Белки и жиры считаются от веса с учётом BMI 30, а не от полного веса" },
      { kind: "feature", text: "Админ-панель: пользователи и статистика приложения" },
      { kind: "fix", text: "Профиль сохраняется, если email от Google/VK нельзя менять" },
    ],
  },
  {
    version: "0.5.8",
    date: "2026-08-18",
    summary: "Профиль и вес",
    items: [
      { kind: "feature", text: "Пол в профиле — норма калорий и БЖУ с учётом пола" },
      { kind: "feature", text: "Несколько измерений веса в день, удаление записей, часовой пояс" },
      { kind: "improvement", text: "На профиле — текущий вес и изменение с первого измерения" },
      { kind: "fix", text: "Корректный порядок записей веса и расчёт динамики" },
      { kind: "fix", text: "После фото снова подставляются калории и БЖУ из базы" },
    ],
  },
  {
    version: "0.5.5",
    date: "2026-08-17",
    summary: "Фото и упаковки",
    items: [
      { kind: "feature", text: "Фото блюд при поиске по названию и штрихкоду" },
      { kind: "feature", text: "Распознавание упаковок: штрихкод, этикетка или название" },
      { kind: "improvement", text: "Сжатие фото еды и подстановка картинок в дневник" },
      { kind: "fix", text: "Порция батончиков и снеков берётся из serving size Open Food Facts" },
      { kind: "improvement", text: "Декодирование HTML-сущностей в названиях продуктов" },
    ],
  },
  {
    version: "0.5.2",
    date: "2026-08-16",
    summary: "Интерфейс и вход",
    items: [
      { kind: "feature", text: "Мобильная навигация: статистика, рацион, вес" },
      { kind: "improvement", text: "Графики статистики с подписями и масштабом по данным" },
      { kind: "feature", text: "Вход через VK ID рядом с Google, email и SMS" },
      { kind: "fix", text: "VK OAuth: сохранение device_id и корректная запись аккаунта" },
      { kind: "fix", text: "Устранены дубликаты пустых пользователей при неудачном VK-входе" },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-08-15",
    summary: "Цели и рацион",
    items: [
      { kind: "feature", text: "Цель по весу: похудение, набор, поддержание с темпом (простой / здоровый / быстрый)" },
      { kind: "feature", text: "Календарь дней с отметками и рекомендуемый рацион в дневнике" },
      { kind: "feature", text: "Пересчёт калорий и БЖУ при изменении порции" },
      { kind: "feature", text: "Поиск калорийности по названию блюда из карточки подтверждения" },
      { kind: "improvement", text: "Версия приложения в подвале и при деплое" },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-08-01",
    summary: "Старт",
    items: [
      { kind: "feature", text: "Распознавание еды по фото через GigaChat" },
      { kind: "feature", text: "Дневник питания с калориями и БЖУ" },
      { kind: "feature", text: "Вход: Google, email, SMS по телефону" },
      { kind: "feature", text: "Деплой на calorievision.ru" },
    ],
  },
];

export function formatChangelogDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

import type { ChangelogItemKind, ChangelogRelease } from "./changelog-types";

export type ChangelogMergeInput = {
  index: number;
  dateKey: string;
  title: string;
};

export function classifyChangelogKind(title: string): ChangelogItemKind {
  const lower = title.toLowerCase();
  if (/^(fix|исправ)/.test(lower) || lower.includes("fix:") || lower.includes("fix ") || lower.includes("bug")) {
    return "fix";
  }
  if (/^(feat|add|нов|feature|добав)/.test(lower) || lower.includes("feat:") || lower.includes("feat ")) {
    return "feature";
  }
  return "improvement";
}

const TITLE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^Recognition eval telemetry wave.*$/i, "Распознавание: eval harness и telemetry dashboard в админке"],
  [/^Recognition 50-point wave 7.*$/i, "Распознавание: OFF packGrams, prompt A/B telemetry, plate corrections"],
  [/^Recognition 50-point wave 6.*$/i, "Распознавание: repair штрихкода, RU-справочник, фикстуры"],
  [/^Recognition 50-point wave 5.*$/i, "Распознавание: SSE-превью, slim-промпт, A/B варианты"],
  [/^Recognition 50-point wave 4.*$/i, "Распознавание: Redis rate limit, batch fiber/sugar, eval cron"],
  [/^Recognition 50-point wave 3.*$/i, "Распознавание: plate-first, скорость GigaChat и UX подтверждения"],
  [/^Recognition 50-point plan batch.*$/i, "Распознавание: качество и скорость — промпты, OFF, plate budget, UX"],
  [/^Landing mascot parallax.*$/i, "Лендинг: маскот, parallax, тексты и блок «бесплатно»"],
  [/^Recognition polish batch.*$/i, "Распознавание: batch-сохранение, rate limit, телеметрия и UX"],
  [/^Improve food recognition quality.*$/i, "Улучшено распознавание: тарелки, клетчатка, упаковки на фото"],
  [/^Refresh landing.*$/i, "Обновлены дизайн и тексты главной страницы"],
  [/^Fix Yandex Metrika.*$/i, "Яндекс Метрика считает визиты с первой загрузки страницы"],
  [/^Add Yandex Metrika.*$/i, "На сайт подключена Яндекс Метрика"],
  [/^Design UX batch.*$/i, "Дизайн: кольцо дня, неделя дат, липкое сохранение и чипы"],
  [/^Fix app version.*commit count$/i, "Версия берётся из package.json, а не из числа коммитов"],
  [/^Fix deploy.*read-package-version.*$/i, "Исправлен деплой: чтение версии без лишних зависимостей"],
  [/^Auto version from merged PRs.*$/i, "Автоматическая версия по числу merged PR (X.Y.Z)"],
  [/^Auto-sync admin changelog.*$/i, "Журнал изменений генерируется из merged PR"],
  [/^Fix server git pull after deploy.*$/i, "Деплой: git pull больше не конфликтует с локальными файлами"],
  [/^Fix drink calories when lookup returns per-100.*$/i, "Калории напитков пересчитываются на полную порцию"],
  [/^Improve food recognition.*$/i, "Улучшено распознавание: OFF, память, параллельное сохранение"],
  [/^Fix iOS home screen.*|^Add PWA manifest.*$/i, "Приложение на рабочем столе iPhone: иконка и полноэкранный режим"],
  [/^Group multi-dish photo saves.*$/i, "Блюда с одного фото объединяются в дневнике"],
  [/^feat: recogni[sz]e several dishes.*$/i, "Распознавание нескольких блюд на одном фото"],
  [/^feat: learn food recognition from user corrections$/i, "Приложение запоминает исправления пользователя"],
  [/^fix: clear food name.*$/i, "Поля ввода очищаются после сохранения"],
  [/^fix: stop creating empty duplicate users.*VK.*$/i, "Устранены пустые дубликаты пользователей при VK-входе"],
  [/^fix: cap protein and fat at BMI.*$/i, "БЖУ считаются от веса с учётом BMI 30"],
  [/^fix: keep admin user name.*mobile$/i, "Список пользователей: имя и email на отдельных строках"],
  [/^feat: admin users and app stats.*$/i, "Админ-панель: пользователи и статистика"],
  [/^fix: allow profile save when.*email.*locked$/i, "Профиль сохраняется, даже если email заблокирован"],
  [/^fix: ADD COLUMN IF NOT EXISTS.*$/i, "Миграция MySQL: совместимость с MySQL 8"],
  [/^Fix deploy version.*MySQL.*$/i, "Деплой: SQL-миграция и авторизация MySQL"],
  [/^Profile phone and sex.*$/i, "Пол в профиле, нормы калорий по полу"],
  [/^Fix SQL migration.*auth.*$/i, "Исправлена авторизация SQL-миграции"],
  [/^Fix zero nutrition after photo.*$/i, "Калории снова появляются после фото"],
  [/^Fix recognition-nutrition imports.*$/i, "Исправлен импорт модулей для сборки"],
  [/^Fix deploy SQL migration.*parsing$/i, "Деплой: парсинг DATABASE_URL для миграции"],
  [/^Unify app version sync.*$/i, "Единая синхронизация версии при сборке"],
  [/^Lower derived app version.*$/i, "Версия приложения приведена к 0.5.x"],
  [/^Show weight change since first.*$/i, "Изменение веса с первого измерения на профиле"],
  [/^Show current weight on profile.*$/i, "Текущий вес отображается на профиле"],
  [/^Profile: add back button.*$/i, "Кнопка «Назад» на профиле"],
  [/^Sort weight entries by calendar.*$/i, "Записи веса сортируются по дате"],
  [/^Fix weight entry ordering.*$/i, "Исправлен порядок и расчёт изменений веса"],
  [/^Add SQL migration.*weight.*timezone.*$/i, "Миграция: вес и часовой пояс"],
  [/^Multiple weight entries per day.*$/i, "Несколько измерений веса в день, удаление, часовой пояс"],
  [/^Decode HTML entities in food names$/i, "Декодирование спецсимволов в названиях продуктов"],
  [/^Compress user meal photos.*$/i, "Сжатие фото блюд для быстрой загрузки"],
  [/^Tighten food image compression.*$/i, "Улучшено сжатие изображений еды"],
  [/^Backfill missing meal photos.*$/i, "Автозагрузка картинок для блюд без фото"],
  [/^Add food photos for text and barcode.*$/i, "Фото блюд при поиске по названию и штрихкоду"],
  [/^Fix invisible stats chart bars.*$/i, "Исправлены невидимые столбцы на графике статистики"],
  [/^Fix stats bar height.*$/i, "Высота столбцов статистики в пикселях"],
  [/^Add Y-axis ticks and value labels.*$/i, "Подписи осей и значений на графиках"],
  [/^Scale stats charts to data range.*$/i, "Графики масштабируются по данным"],
  [/^Add mobile app shell.*navigation.*$/i, "Мобильная навигация: статистика, рацион, вес"],
  [/^Fix VK sign-in failing.*Prisma.*$/i, "Исправлен VK-вход при сохранении аккаунта"],
  [/^Fix VK ID sign-in.*device_id.*$/i, "VK ID: сохранение device_id через NextAuth"],
  [/^Fix portion weight for snack bars.*$/i, "Порция батончиков из serving size Open Food Facts"],
  [/^Look up packaged foods by barcode.*$/i, "Поиск упакованных продуктов по штрихкоду и названию"],
  [/^Render the CV viewfinder mark.*$/i, "Логотип CV как встроенный SVG"],
  [/^Switch brand mark to.*viewfinder.*$/i, "Новый логотип Calorie Vision"],
  [/^Run version sync with plain Node.*$/i, "Синхронизация версии через Node.js"],
  [/^Show the computed app version during deploy.*$/i, "Версия приложения при деплое"],
  [/^Add VK ID sign-in alongside.*$/i, "Вход через VK ID рядом с Google, email и SMS"],
  [/^Add shutter-leaf logo.*$/i, "Логотип в шапке, на логине и иконках"],
  [/^Fix GoalPace lookup.*$/i, "Исправлен выбор темпа цели"],
  [/^Add simple, healthy, and fast paces.*$/i, "Темпы: простой, здоровый, быстрый для целей"],
  [/^Show only the app version in the footer.*$/i, "Версия без хеша в подвале"],
  [/^Number app versions.*$/i, "Нумерация версий 0.4.0, 0.4.1 … 0.5.0"],
  [/^Split the app into pages.*$/i, "Приложение разделено на страницы, даты в формате YYYY-MM-DD"],
  [/^Add daily weight.*goals.*calendar.*$/i, "Вес, цели, календарь и рекомендации по калориям"],
  [/^Show app version and git build hash.*$/i, "Версия и хеш сборки в подвале"],
  [/^Recalculate calories and macros when portion changes$/i, "Пересчёт калорий и БЖУ при изменении порции"],
  [/^Fix Google and SMS authentication.*$/i, "Исправлена авторизация Google и SMS"],
  [/^Add dish name lookup.*refresh.*$/i, "Поиск калорийности по названию блюда"],
  [/^Fix image display.*GigaChat.*$/i, "Исправлено отображение фото и оценки GigaChat"],
  [/^Replace Apple auth with phone OTP.*$/i, "Вход по SMS и email вместо Apple"],
  [/^Prepare production deploy.*$/i, "Подготовка к деплою на calorievision.ru"],
  [/^Pin Prisma.*VPS deploy.*$/i, "Prisma 6.19.3, инструкции для VPS"],
  [/^Add script to create GitHub.*$/i, "Скрипт создания GitHub-репозитория"],
  [/^Initial commit.*Calorie Vision.*$/i, "Первый коммит: Calorie Vision"],
  [/^Add admin changelog page.*$/i, "Журнал изменений в админ-панели"],
  [/^Show the CV viewfinder logo in the header$/i, "Логотип CV в шапке приложения"],
  [/^Fix pack portion weight from Open Food Facts.*$/i, "Порция из Open Food Facts: serving size для батончиков и снеков"],
  [/^Fix VK ID login by preserving device_id.*$/i, "VK-вход: сохранение device_id через NextAuth"],
  [/^Fix VK login failing when Prisma saves.*$/i, "Исправлен VK-вход при сохранении аккаунта в Prisma"],
  [/^Mobile app shell.*stats.*ration.*weight.*$/i, "Мобильная навигация: статистика, рацион, вес, профиль"],
  [/^Add Y-axis.*bar value labels.*$/i, "Подписи осей и значений на графиках статистики"],
  [/^Show food photos for text and barcode.*$/i, "Фото блюд при поиске по тексту и штрихкоду"],
  [/^Backfill meal photos and compress.*$/i, "Автозагрузка и сжатие фото для блюд без картинок"],
  [/^Compress food images further.*$/i, "Дополнительное сжатие картинок еды"],
  [/^Fix prisma db push failing.*duplicate FK.*$/i, "Миграция: совместимость с существующей MySQL-схемой"],
  [/^Fix weight measurements ordering.*$/i, "Исправлен порядок и расчёт изменений веса"],
  [/^Fix weight list order.*calendar date$/i, "Записи веса сортируются по календарной дате"],
  [/^Profile: back button.*no weight input.*$/i, "Профиль: кнопка «Назад», без формы ввода веса"],
  [/^Profile: show weight change since first.*$/i, "Профиль: изменение веса с первого измерения"],
  [/^Fix inconsistent app version during deploy$/i, "Единая версия приложения при деплое"],
  [/^Fix zero nutrition values after photo.*$/i, "Исправлены нулевые калории после фото"],
  [/^Fix deploy SQL migration MySQL auth.*$/i, "Деплой: авторизация SQL-миграции в MySQL"],
  [/^Profile: phone.*sex.*gender-based calorie.*$/i, "Профиль: телефон, пол, нормы калорий по полу"],
  [/^fix: MySQL-compatible ADD COLUMN.*$/i, "Миграция MySQL: совместимость с MySQL 8 (без IF NOT EXISTS)"],
  [/^fix: сохранение профиля при входе через Google или VK$/i, "Сохранение профиля при входе через Google или VK"],
  [/^feat: админ-разделы Пользователи и Статистика$/i, "Админ-разделы: Пользователи и Статистика"],
  [/^fix: имя и email пользователей не сливаются.*$/i, "Имя и email в списке пользователей на отдельных строках"],
  [/^fix: не раздувать норму белка.*$/i, "Норма белка не раздувается при высоком весе"],
  [/^fix: пустые дубли пользователей.*VK$/i, "Устранены пустые дубликаты пользователей после VK-входа"],
  [/^fix: очищать поле ввода еды.*$/i, "Поля ввода еды очищаются после сохранения"],
  [/^feat: память исправлений распознавания.*$/i, "Приложение запоминает исправления при распознавании"],
  [/^feat: распознавать несколько блюд на одной тарелке$/i, "Распознавание нескольких блюд на одной тарелке"],
  [/^Require Node 24 LTS.*$/i, "Сервер и установка — Node.js 24 LTS"],
  [/^Allow Prisma and sharp npm install scripts.*$/i, "Разрешены install-скрипты Prisma и sharp"],
  [/^Default snack bars to 60 g portions.*$/i, "Батончики без веса в базе — порция 60 г"],
];

export function translateTitle(title: string): string {
  for (const [pattern, translation] of TITLE_TRANSLATIONS) {
    if (pattern.test(title)) {
      return translation;
    }
  }
  return title;
}

export function buildChangelogReleases(
  merges: ChangelogMergeInput[],
  versionForIndex: (index: number) => string,
): ChangelogRelease[] {
  const chronological: ChangelogRelease[] = [];

  for (const merge of merges) {
    const version = versionForIndex(merge.index);
    const text = translateTitle(merge.title);
    const item = { kind: classifyChangelogKind(merge.title), text };
    const last = chronological[chronological.length - 1];

    if (last?.version === version) {
      last.items.push(item);
      last.date = merge.dateKey;
      continue;
    }

    chronological.push({
      version,
      date: merge.dateKey,
      summary: text,
      items: [item],
    });
  }

  return chronological.reverse();
}

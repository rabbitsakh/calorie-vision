"use client";

import { BrandMark } from "@/components/BrandMark";
import { MuscleRecoveryCard } from "@/components/workouts/MuscleRecoveryCard";
import { APP_NAV } from "@/lib/navigation";
import { NavIcon } from "@/components/NavIcons";
import type { MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { MuscleRecoveryRow, MuscleRecoveryStatus } from "@/lib/workouts/muscle-volume";

export const LISTING_SHOTS = ["01", "02", "03", "04", "05", "06"] as const;
export type ListingShotId = (typeof LISTING_SHOTS)[number];

const CAPTIONS: Record<ListingShotId, string> = {
  "01": "Фото → калории и БЖУ",
  "02": "Дневник за день",
  "03": "Зал: карта мышц",
  "04": "ИИ-тренер под вас",
  "05": "Ассистент по делу",
  "06": "Готовые программы",
};

function row(
  key: MuscleGroupKey,
  label: string,
  status: MuscleRecoveryStatus,
  tonnage: number,
  hours: number,
): MuscleRecoveryRow {
  return {
    key,
    label,
    directTonnage: tonnage,
    indirectTonnage: 0,
    directDurationSec: 0,
    indirectDurationSec: 0,
    tonnage,
    durationSec: 0,
    directSets: 4,
    status,
    lastDirectDate: "2026-11-06",
    lastDirectTonnage: tonnage,
    lastDirectDurationSec: 0,
    hoursSinceStrong: hours,
  };
}

function Chrome({
  caption,
  active,
  children,
}: {
  caption: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div data-listing-shot className="listing-shot">
      <p className="listing-shot__caption">{caption}</p>
      <header className="listing-shot__bar">
        <BrandMark size={44} />
        <span>Calorie Vision</span>
      </header>
      <div className="listing-shot__body">{children}</div>
      <nav className="listing-shot__tabs" aria-hidden>
        {APP_NAV.map((item) => (
          <span key={item.href} className={item.href === active ? "is-on" : ""}>
            <NavIcon name={item.icon} className="h-5 w-5" />
            {item.shortLabel}
          </span>
        ))}
      </nav>
    </div>
  );
}

function ShotFood() {
  return (
    <Chrome caption={CAPTIONS["01"]} active="/ration">
      <p className="listing-shot__kicker">Результат по фото</p>
      <article className="listing-shot__card">
        <p className="listing-shot__dish">Гречка с курицей</p>
        <p className="listing-shot__kcal">480 ккал · 320 г</p>
        <p className="listing-shot__macros">Б 34 · Ж 12 · У 58</p>
        <p className="listing-shot__hint">Оценка по фото, не лабораторный анализ. Перед записью можно поправить граммы.</p>
      </article>
      <article className="listing-shot__card">
        <p className="listing-shot__dish">Салат овощной</p>
        <p className="listing-shot__kcal">120 ккал · 180 г</p>
        <p className="listing-shot__macros">Б 3 · Ж 6 · У 14</p>
      </article>
    </Chrome>
  );
}

function ShotDiary() {
  const meals = [
    ["Завтрак", "Овсянка с ягодами", "320"],
    ["Обед", "Гречка с курицей", "480"],
    ["Ужин", "Творог 5%", "180"],
  ];
  return (
    <Chrome caption={CAPTIONS["02"]} active="/ration">
      <p className="listing-shot__kicker">Сегодня · демо</p>
      <p className="listing-shot__big">
        980 <span>из 1 800 ккал</span>
      </p>
      <p className="listing-shot__macros">Б 72 · Ж 28 · У 110</p>
      <ul className="listing-shot__list">
        {meals.map(([slot, name, kcal]) => (
          <li key={slot}>
            <span>
              <b>{slot}</b>
              {name}
            </span>
            <span>{kcal}</span>
          </li>
        ))}
      </ul>
    </Chrome>
  );
}

function ShotMuscles() {
  return (
    <Chrome caption={CAPTIONS["03"]} active="/workouts">
      <MuscleRecoveryCard
        map={{
          weekStart: "2026-11-02",
          weekEnd: "2026-11-08",
          rows: [
            row("chest", "Грудь", "loaded", 4200, 20),
            row("back", "Спина", "recovering", 3100, 50),
            row("legs", "Ноги", "fresh", 0, 96),
          ],
        }}
      />
      <p className="listing-shot__hint">Ориентир по объёму недели. Не совет врача.</p>
    </Chrome>
  );
}

function ShotCoach() {
  return (
    <Chrome caption={CAPTIONS["04"]} active="/workouts">
      <p className="listing-shot__kicker">Собрать под себя</p>
      <div className="listing-shot__chips">
        <span className="is-on">Сила</span>
        <span>Объём</span>
        <span>Тонус</span>
      </div>
      <div className="listing-shot__chips">
        <span>Только начинаю</span>
        <span className="is-on">Уже хожу</span>
        <span>Регулярно</span>
      </div>
      <p className="listing-shot__hint">Что не брать. Это не оценка здоровья.</p>
      <button type="button" className="listing-shot__go">
        Предложить тренировку
      </button>
      <article className="listing-shot__card">
        <p className="listing-shot__kicker">Ответ ИИ</p>
        <p className="listing-shot__dish">Жим и тяга · 45 мин</p>
        <p className="listing-shot__hint">Черновик. В дневник попадёт только после «Сохранить».</p>
      </article>
    </Chrome>
  );
}

function ShotAssistant() {
  return (
    <Chrome caption={CAPTIONS["05"]} active="/ration">
      <div className="listing-shot__bubble">Добавь обед: гречка с курицей, 320 г</div>
      <div className="listing-shot__bubble listing-shot__bubble--me">
        Записать 480 ккал, Б 34 · Ж 12 · У 58?
      </div>
      <article className="listing-shot__card">
        <p className="listing-shot__dish">Гречка с курицей</p>
        <p className="listing-shot__kcal">480 ккал</p>
        <button type="button" className="listing-shot__go">
          Подтвердить
        </button>
      </article>
      <p className="listing-shot__hint">В дневник — только после вашего «да».</p>
    </Chrome>
  );
}

function ShotPrograms() {
  const programs = [
    ["Фулбади", "Всё тело · 2 дня"],
    ["Сплит", "Жим, тяга, ноги · 3 дня"],
    ["5×5", "База на силу · 2 дня"],
  ];
  return (
    <Chrome caption={CAPTIONS["06"]} active="/workouts">
      <p className="listing-shot__kicker">Готовые программы</p>
      <ul className="listing-shot__list">
        {programs.map(([name, note]) => (
          <li key={name}>
            <span>
              <b>{name}</b>
              {note}
            </span>
          </li>
        ))}
      </ul>
      <p className="listing-shot__hint">Схема без весов. В дневник — после «Сохранить» или «Начать».</p>
    </Chrome>
  );
}

const FRAMES: Record<ListingShotId, () => React.ReactNode> = {
  "01": ShotFood,
  "02": ShotDiary,
  "03": ShotMuscles,
  "04": ShotCoach,
  "05": ShotAssistant,
  "06": ShotPrograms,
};

export function ListingShots({ shot }: { shot: string }) {
  const id = (LISTING_SHOTS as readonly string[]).includes(shot) ? (shot as ListingShotId) : "01";
  const Frame = FRAMES[id];
  return <Frame />;
}

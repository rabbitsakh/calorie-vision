"use client";

import { useMemo, useState } from "react";
import { mascotArtUrl } from "@/lib/mascot-art";
import { withBasePath } from "@/lib/paths";
import {
  CARBS,
  CARBS_TARGET,
  EATEN_KCAL,
  FAT,
  FAT_TARGET,
  FIXTURE_HOUR,
  PROTEIN,
  PROTEIN_TARGET,
  SCREEN_IDEAS,
  TARGET_KCAL,
  WATER_GLASS_ML,
  WATER_ML,
  WATER_TARGET_ML,
  formatKcal,
  formatWaterLiters,
  ideasForMoment,
  type MockIdea,
} from "./fixture";

const MACRO_COLOR = {
  protein: "var(--accent-protein)",
  fat: "var(--accent-fat)",
  carbs: "var(--accent-carbs)",
} as const;

type MacroRow = {
  key: keyof typeof MACRO_COLOR;
  label: string;
  value: number;
  target: number;
};

/**
 * Макет новой карточки «Сейчас». Только тестовые данные на странице превью.
 * Кнопки меняют локальное состояние и ничего не пишут в дневник.
 */
export function TodayHeroMock() {
  const [added, setAdded] = useState<string[]>([]);
  const [waterMl, setWaterMl] = useState(WATER_ML);
  const [note, setNote] = useState<string | null>(null);

  const addedIdeas = SCREEN_IDEAS.filter((idea) => added.includes(idea.name));
  const eaten = EATEN_KCAL + addedIdeas.reduce((sum, idea) => sum + idea.calories, 0);
  const remaining = TARGET_KCAL - eaten;
  const visible = useMemo(
    () => ideasForMoment(SCREEN_IDEAS, remaining, FIXTURE_HOUR).filter((idea) => !added.includes(idea.name)),
    [added, remaining],
  );
  const scale = TARGET_KCAL > 0 ? Math.max(0, Math.min(100, Math.round((eaten / TARGET_KCAL) * 100))) : 0;
  const proteinLeft = PROTEIN_TARGET - PROTEIN;

  const macros: MacroRow[] = [
    { key: "protein", label: "Белки", value: PROTEIN, target: PROTEIN_TARGET },
    { key: "fat", label: "Жиры", value: FAT, target: FAT_TARGET },
    { key: "carbs", label: "Углеводы", value: CARBS, target: CARBS_TARGET },
  ];

  function addIdea(idea: MockIdea) {
    setAdded((list) => (list.includes(idea.name) ? list : [...list, idea.name]));
    setNote(`В макете записано «${idea.name}». Дневник не менялся.`);
  }

  function addGlass() {
    setWaterMl((ml) => ml + WATER_GLASS_ML);
    setNote("В макете добавлен стакан 250 мл. Дневник не менялся.");
  }

  function openGym() {
    setNote("В приложении эта кнопка открыла бы зал. Дневник не менялся.");
  }

  const waterFull = waterMl >= WATER_TARGET_ML;

  return (
    <section className="today-mock" aria-label="Сейчас · утро" data-testid="today-hero-mock">
      <div className="today-mock__head">
        <div className="today-mock__copy">
          <p className="today-mock__eyebrow">Сейчас · утро</p>
          <p className="today-mock__title">
            <span>Съедено {formatKcal(eaten)} из {formatKcal(TARGET_KCAL)} ккал</span>
            <span>осталось {formatKcal(remaining)}</span>
          </p>
          <div
            className="today-mock__scale"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={TARGET_KCAL}
            aria-valuenow={Math.max(0, eaten)}
            aria-label={`Съедено ${formatKcal(eaten)} из ${formatKcal(TARGET_KCAL)} ккал, осталось ${formatKcal(remaining)}`}
          >
            <i style={{ width: `${scale}%` }} />
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static mascot still from /public */}
        <img
          className="today-mock__mascot"
          src={withBasePath(mascotArtUrl("tip"))}
          alt=""
          aria-hidden
        />
      </div>

      <div className="today-mock__macros">
        {macros.map((row) => {
          const pct = row.target > 0 ? Math.max(0, Math.min(100, Math.round((row.value / row.target) * 100))) : 0;
          return (
            <div key={row.key} className="today-mock__macro">
              <span className="today-mock__macro-label">{row.label}</span>
              <span className="today-mock__macro-track" aria-hidden>
                <i style={{ width: `${pct}%`, background: MACRO_COLOR[row.key] }} />
              </span>
              <span className="today-mock__macro-value">
                {formatKcal(row.value)} из {formatKcal(row.target)} г
              </span>
            </div>
          );
        })}
      </div>
      {proteinLeft > 5 ? <p className="today-mock__note">После зала ещё {formatKcal(proteinLeft)} г белка</p> : null}

      <div className="today-mock__ideas">
        <p className="today-mock__ideas-label">Идеи на завтрак</p>
        <p className="today-mock__ideas-hint">В пределах {formatKcal(Math.max(0, remaining))} ккал</p>
        {visible.length > 0 ? (
          <div className="today-mock__ideas-list">
            {visible.map((idea) => (
              <button key={idea.name} type="button" className="today-mock__idea" onClick={() => addIdea(idea)}>
                <b>{idea.name}</b>
                <span>{formatKcal(idea.calories)} ккал</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="today-mock__ideas-empty">На завтрак в остаток ничего не подошло</p>
        )}
      </div>

      <div className="today-mock__chips">
        <button type="button" className="today-mock__chip" onClick={addGlass} disabled={waterFull}>
          <span className="today-mock__chip-copy">
            <b>Вода</b>
            <span>
              {formatWaterLiters(waterMl)} из {formatWaterLiters(WATER_TARGET_ML)} л
            </span>
          </span>
          <span className="today-mock__chip-action">{waterFull ? "Норма" : "Стакан"}</span>
        </button>
        <button type="button" className="today-mock__chip" onClick={openGym}>
          <span className="today-mock__chip-copy">
            <b>Зал</b>
            <span>сегодня сделан</span>
          </span>
          <span className="today-mock__chip-action today-mock__chip-action--quiet">Открыть</span>
        </button>
      </div>
      {note ? (
        <p className="today-mock__status" role="status">
          {note}
        </p>
      ) : null}
    </section>
  );
}

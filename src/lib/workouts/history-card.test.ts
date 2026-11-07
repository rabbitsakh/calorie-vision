import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { historySessionLoad } from "./history-card.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("силовая карточка показывает кг·повт отдельно от числа", () => {
  assert.deepEqual(
    historySessionLoad({
      cardioOnly: false,
      cardioDistanceKm: 0,
      cardioDurationSec: 0,
      totalLoad: 11682,
    }),
    { value: "11\u00a0682", unit: "кг·повт" },
  );
});

test("кардио с дистанцией показывает километры, без неё — минуты", () => {
  assert.deepEqual(
    historySessionLoad({
      cardioOnly: true,
      cardioDistanceKm: 5,
      cardioDurationSec: 3600,
      totalLoad: 0,
    }),
    { value: "5", unit: "км" },
  );
  assert.deepEqual(
    historySessionLoad({
      cardioOnly: true,
      cardioDistanceKm: 0,
      cardioDurationSec: 3600,
      totalLoad: 0,
    }),
    { value: "60", unit: "мин" },
  );
});

test("отметка дня в календаре не растягивается правилом rounded-full", () => {
  const hub = readFileSync(join(root, "components/workouts/WorkoutHistoryHub.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  const day = hub.slice(hub.indexOf("gym-cal-day"), hub.indexOf("Фильтр списка"));
  assert.match(day, /gym-cal-day__mark/);
  assert.doesNotMatch(day, /rounded-full/);
  assert.match(css, /\.gym-cal-day__mark\.is-on[\s\S]*max-height:\s*4px/);
  assert.match(css, /\.gym-cal-day__num/);
});

test("карточка истории на телефоне — колонка, действия отдельной строкой", () => {
  const hub = readFileSync(join(root, "components/workouts/WorkoutHistoryHub.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(hub, /gym-session-card__actions/);
  assert.match(hub, /gym-session-card__title/);
  assert.doesNotMatch(hub, /truncate text-sm text-\[var\(--muted-strong\)\]/);
  assert.match(css, /\.gym-session-card \{[\s\S]*flex-direction:\s*column/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.gym-session-card \{[\s\S]*flex-direction:\s*row/);
});

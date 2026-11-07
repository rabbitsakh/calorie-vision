import { formatDistanceKm, formatDurationMinutes } from "./cardio.ts";
import { formatWorkoutLoad } from "./format.ts";

export type HistoryLoadInput = {
  cardioOnly: boolean;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  totalLoad: number;
};

/** Крупное число карточки истории и короткая подпись единицы. */
export function historySessionLoad(session: HistoryLoadInput): { value: string; unit: string } {
  if (session.cardioOnly) {
    if (session.cardioDistanceKm > 0) {
      return { value: formatDistanceKm(session.cardioDistanceKm), unit: "км" };
    }
    const minutes = formatDurationMinutes(session.cardioDurationSec);
    return { value: minutes.replace(/\s*мин$/u, ""), unit: "мин" };
  }
  return { value: formatWorkoutLoad(session.totalLoad), unit: "кг·повт" };
}

/** Soft-return tip must not compete with StreakNudge freeze / at-risk / soft recovery. */
export function shouldShowMotivationSoftReturn(input: {
  loggedToday: boolean;
  yesterdayEmpty: boolean;
  canFreezeYesterday: boolean;
  streakAtRisk: boolean;
  hour: number;
}): boolean {
  if (input.loggedToday) return false;
  const streakOwnsMorning =
    input.yesterdayEmpty || input.canFreezeYesterday || input.streakAtRisk;
  return !streakOwnsMorning && input.hour < 13;
}

export function shouldShowMotivationTip(input: {
  selectedIsToday: boolean;
  loggedToday: boolean;
  yesterdayEmpty: boolean;
  canFreezeYesterday: boolean;
  streakAtRisk: boolean;
  hour: number;
}): boolean {
  if (!input.selectedIsToday) return false;
  if (input.loggedToday && input.hour >= 13) return true;
  return shouldShowMotivationSoftReturn(input);
}

/**
 * Как CvRestTimerService ставит будильник конца отдыха.
 * exact — setExactAndAllowWhileIdle, только если система разрешает.
 * while-idle — setAndAllowWhileIdle, когда точных будильников нет (Android 12+).
 */
export type RestAlarmMode = "exact" | "while-idle";

export function chooseRestAlarmMode(input: {
  sdkInt: number;
  canScheduleExactAlarms: boolean;
}): RestAlarmMode {
  const sdk = Number.isFinite(input.sdkInt) ? Math.floor(input.sdkInt) : 0;
  if (sdk < 31) return "exact";
  return input.canScheduleExactAlarms ? "exact" : "while-idle";
}

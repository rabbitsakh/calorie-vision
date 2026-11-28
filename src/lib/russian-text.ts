/** Russian plural form for «N день / дня / дней». */
export function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

/** «1 листик», «2 листика», «5 листиков». */
export function pluralLeaves(count: number): string {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod100 >= 11 && mod100 <= 14) return "листиков";
  if (mod10 === 1) return "листик";
  if (mod10 >= 2 && mod10 <= 4) return "листика";
  return "листиков";
}

export function leavesCount(count: number): string {
  return `${count} ${pluralLeaves(count)}`;
}

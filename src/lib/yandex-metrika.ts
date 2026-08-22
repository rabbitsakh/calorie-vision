/** Yandex Metrika counter IDs are numeric (typically 8 digits). */
export function parseMetrikaId(value: string | undefined | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!/^\d{6,12}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function shouldTrackMetrikaPath(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}

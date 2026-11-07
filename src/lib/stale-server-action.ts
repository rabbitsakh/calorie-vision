/**
 * После деплоя у открытой вкладки остаётся старый id Server Action.
 * Сервер отвечает «Failed to find Server Action» / «Server Reference ID».
 * Это не поломка текущего кода: клиент один раз тихо перезагружает страницу.
 */

const STALE_ACTION_TEXT =
  /Failed to find Server Action|was not found on the server|Server Reference ID did not match|failed-to-find-server-action/i;

const STALE_ACTION_CODES = new Set(["E715", "E787", "E788", "E793"]);

export const STALE_ACTION_RELOAD_KEY = "cv-stale-action-reloaded";

/** Сколько держать запрет второго reload, чтобы не зациклиться. */
export const STALE_ACTION_RELOAD_GUARD_MS = 15_000;

export function isStaleServerActionError(error: unknown): boolean {
  if (typeof error === "string") return STALE_ACTION_TEXT.test(error);
  if (!error || typeof error !== "object") return false;
  const record = error as { name?: unknown; message?: unknown; __NEXT_ERROR_CODE?: unknown };
  if (record.name === "UnrecognizedActionError") return true;
  if (typeof record.__NEXT_ERROR_CODE === "string" && STALE_ACTION_CODES.has(record.__NEXT_ERROR_CODE)) {
    return true;
  }
  return typeof record.message === "string" && STALE_ACTION_TEXT.test(record.message);
}

export function isStaleServerActionLog(args: unknown[]): boolean {
  return args.some((arg) => isStaleServerActionError(arg));
}

export type StaleActionReload = "reload" | "show";

/** `alreadyReloaded` — флаг уже стоит, второй автоматический reload не нужен. */
export function decideStaleActionReload(error: unknown, alreadyReloaded: boolean): StaleActionReload | "ignore" {
  if (!isStaleServerActionError(error)) return "ignore";
  return alreadyReloaded ? "show" : "reload";
}

export function reloadOnceForStaleServerAction(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  let already = false;
  try {
    already = window.sessionStorage.getItem(STALE_ACTION_RELOAD_KEY) === "1";
  } catch {
    already = false;
  }
  if (decideStaleActionReload(error, already) !== "reload") return false;
  try {
    window.sessionStorage.setItem(STALE_ACTION_RELOAD_KEY, "1");
  } catch {
    // Приватный режим: один reload всё равно лучше, чем вечный экран ошибки.
  }
  window.location.reload();
  return true;
}

let logFilterInstalled = false;

/** Убирает ожидаемый warn/error Next.js про чужой id действия. Остальные логи не трогает. */
export function installStaleServerActionLogFilter(): void {
  if (logFilterInstalled) return;
  logFilterInstalled = true;
  const wrap = (method: "warn" | "error") => {
    const original = console[method].bind(console);
    console[method] = (...args: Parameters<typeof console.warn>) => {
      if (isStaleServerActionLog(args)) return;
      original(...args);
    };
  };
  wrap("warn");
  wrap("error");
}

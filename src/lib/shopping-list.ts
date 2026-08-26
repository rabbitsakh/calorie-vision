/** Client shopping list (MVP) — dish names saved in localStorage. */

export type ShoppingListItem = {
  id: string;
  name: string;
  checked: boolean;
  sourceDate?: string;
};

export const SHOPPING_LIST_KEY = "cv-shopping-list-v1";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

export type ShoppingListOpts = {
  userId?: string | null;
  storage?: StorageLike | null;
};

function getStorage(): StorageLike | null {
  try {
    const root = globalThis as {
      window?: { localStorage?: StorageLike };
      localStorage?: StorageLike;
    };
    return root.window?.localStorage ?? root.localStorage ?? null;
  } catch {
    return null;
  }
}

export function shoppingListStorageKey(userId?: string | null): string {
  const id = typeof userId === "string" ? userId.trim() : "";
  return id ? `${SHOPPING_LIST_KEY}:${id}` : SHOPPING_LIST_KEY;
}

export function normalizeShoppingName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isItem(value: unknown): value is ShoppingListItem {
  if (!value || typeof value !== "object") return false;
  const item = value as ShoppingListItem;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.checked === "boolean" &&
    (item.sourceDate === undefined || typeof item.sourceDate === "string")
  );
}

function resolveStorage(opts?: ShoppingListOpts): StorageLike | null {
  if (opts && "storage" in opts) return opts.storage ?? null;
  return getStorage();
}

function newItemId(now: Date = new Date()): string {
  return `shop-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadList(opts?: ShoppingListOpts): ShoppingListItem[] {
  const store = resolveStorage(opts);
  if (!store) return [];
  try {
    const raw = store.getItem(shoppingListStorageKey(opts?.userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isItem);
  } catch {
    return [];
  }
}

export function saveList(items: ShoppingListItem[], opts?: ShoppingListOpts): void {
  const store = resolveStorage(opts);
  if (!store) return;
  try {
    const key = shoppingListStorageKey(opts?.userId);
    if (items.length === 0) {
      store.removeItem?.(key);
      if (!store.removeItem) store.setItem(key, "[]");
    } else {
      store.setItem(key, JSON.stringify(items));
    }
  } catch {
    // quota / private mode
  }
}

/**
 * Append dish names, skipping blanks and names already on the list (normalized).
 * Optional sourceDate is stored on newly added items.
 */
export function addItemsFromDishNames(
  names: string[],
  sourceDate?: string,
  opts?: ShoppingListOpts,
): ShoppingListItem[] {
  const list = loadList(opts);
  const seen = new Set(list.map((item) => normalizeShoppingName(item.name)));
  const now = new Date();
  const date =
    typeof sourceDate === "string" && sourceDate.trim() ? sourceDate.trim() : undefined;

  for (const raw of names) {
    if (typeof raw !== "string") continue;
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = normalizeShoppingName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      id: newItemId(now),
      name,
      checked: false,
      ...(date ? { sourceDate: date } : {}),
    });
  }

  saveList(list, opts);
  return list;
}

export function toggleItem(id: string, opts?: ShoppingListOpts): ShoppingListItem[] {
  const list = loadList(opts).map((item) =>
    item.id === id ? { ...item, checked: !item.checked } : item,
  );
  saveList(list, opts);
  return list;
}

export function removeItem(id: string, opts?: ShoppingListOpts): ShoppingListItem[] {
  const list = loadList(opts).filter((item) => item.id !== id);
  saveList(list, opts);
  return list;
}

export function clearChecked(opts?: ShoppingListOpts): ShoppingListItem[] {
  const list = loadList(opts).filter((item) => !item.checked);
  saveList(list, opts);
  return list;
}

export function clearAll(opts?: ShoppingListOpts): ShoppingListItem[] {
  saveList([], opts);
  return [];
}

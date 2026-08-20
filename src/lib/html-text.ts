const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

function decodeOnce(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    const named = NAMED_ENTITIES[key];
    if (named) {
      return named;
    }

    try {
      if (key.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
      }
      if (key.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
      }
    } catch {
      return match;
    }

    return match;
  });
}

export function decodeHtmlEntities(value: string): string {
  if (!value || !value.includes("&")) {
    return value;
  }

  let current = value;
  for (let index = 0; index < 3; index += 1) {
    const next = decodeOnce(current);
    if (next === current) {
      break;
    }
    current = next;
  }

  return current;
}

export function mergeDecodedFoodStats(
  rows: Array<{ dishName: string; count: number; avgCalories: number }>,
  limit = 8,
): Array<{ dishName: string; count: number; avgCalories: number }> {
  const merged = new Map<string, { count: number; calorieSum: number }>();

  for (const row of rows) {
    const dishName = decodeHtmlEntities(row.dishName);
    const calorieSum = row.avgCalories * row.count;
    const prev = merged.get(dishName);
    if (!prev) {
      merged.set(dishName, { count: row.count, calorieSum });
    } else {
      prev.count += row.count;
      prev.calorieSum += calorieSum;
    }
  }

  return [...merged.entries()]
    .map(([dishName, { count, calorieSum }]) => ({
      dishName,
      count,
      avgCalories: count > 0 ? Math.round(calorieSum / count) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.dishName.localeCompare(b.dishName, "ru"))
    .slice(0, limit);
}

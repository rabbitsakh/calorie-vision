/** Run async work over items with a fixed concurrency limit. */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

/** Resolve with `fallback` if `work` does not finish before `ms`. Calls `onTimeout` when the budget expires. */
export async function withTimeoutFallback<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
  onTimeout?: () => void,
): Promise<T> {
  if (ms <= 0) {
    onTimeout?.();
    return fallback;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  try {
    return await Promise.race([
      work.then((value) => {
        settled = true;
        return value;
      }),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          if (!settled) {
            onTimeout?.();
          }
          resolve(fallback);
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

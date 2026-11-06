/**
 * SSE после обрыва клиента: рантайм уже закрыл контроллер.
 * Повторный enqueue/close даёт «Controller is already closed» и попадает в лог как сбой распознавания.
 */

export type SseByteSink = {
  enqueue: (chunk: Uint8Array) => void;
  close: () => void;
};

export type GuardedSse = {
  send: (event: string, data: unknown) => boolean;
  ping: () => boolean;
  close: () => void;
  isClosed: () => boolean;
};

const encoder = new TextEncoder();

export function isClosedControllerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already closed|invalid state/i.test(message);
}

function defaultEncode(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createGuardedSse(
  controller: SseByteSink,
  options?: {
    signal?: AbortSignal;
    encode?: (event: string, data: unknown) => Uint8Array;
  },
): GuardedSse {
  let stopped = false;
  let didClose = false;
  const encode = options?.encode ?? defaultEncode;

  const stop = () => {
    stopped = true;
  };

  options?.signal?.addEventListener("abort", stop, { once: true });

  const write = (chunk: Uint8Array): boolean => {
    if (stopped || options?.signal?.aborted) {
      stopped = true;
      return false;
    }
    try {
      controller.enqueue(chunk);
      return true;
    } catch (error) {
      if (isClosedControllerError(error)) {
        stopped = true;
        return false;
      }
      throw error;
    }
  };

  return {
    isClosed: () => stopped || Boolean(options?.signal?.aborted),
    send(event, data) {
      return write(encode(event, data));
    },
    ping() {
      return write(encoder.encode(": ping\n\n"));
    },
    close() {
      stopped = true;
      if (didClose) return;
      didClose = true;
      try {
        controller.close();
      } catch (error) {
        if (!isClosedControllerError(error)) throw error;
      }
    },
  };
}

/**
 * Как start() у recognize/stream: ошибка распознавания уходит клиенту,
 * а обрыв соединения не логируется вторым исключением из close().
 */
export async function settleGuardedSse(
  sse: GuardedSse,
  task: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (!sse.isClosed() && !isClosedControllerError(error)) {
      onError(error);
    }
  } finally {
    sse.close();
  }
}

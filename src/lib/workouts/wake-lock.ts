/**
 * Keep the screen awake during live gym logging (best-effort; not all browsers).
 */
export type WakeLockHandle = { release: () => Promise<void> };

export async function requestScreenWakeLock(): Promise<WakeLockHandle | null> {
  if (typeof navigator === "undefined") return null;
  const anyNav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
  };
  if (!anyNav.wakeLock?.request) return null;
  try {
    const lock = await anyNav.wakeLock.request("screen");
    return {
      release: async () => {
        try {
          await lock.release();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return null;
  }
}

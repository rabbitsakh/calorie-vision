/**
 * Tiny event bus for in-app mascot reactions (save food, etc.).
 */

export type MascotReactionKind = "save" | "pet" | "tip";

type Listener = (kind: MascotReactionKind) => void;

const listeners = new Set<Listener>();

export function emitMascotReaction(kind: MascotReactionKind): void {
  for (const listener of listeners) {
    try {
      listener(kind);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeMascotReaction(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

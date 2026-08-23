"use client";

import {
  Children,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SlotState = "unknown" | "empty" | "occupied";

/**
 * Wraps one queue child and reports whether it rendered real DOM content.
 * Empty returns (null) stay vacant so the next priority card can mount.
 */
function OccupancySlot({
  children,
  onOccupancy,
}: {
  children: ReactNode;
  onOccupancy: (occupied: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const report = () => {
      onOccupancy(el.childNodes.length > 0);
    };
    report();

    const observer = new MutationObserver(report);
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [onOccupancy, children]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

/**
 * Shows only the first non-null motivation card in DOM order.
 * Mounts children sequentially until one has content; earlier empty cards
 * stay mounted so they can reclaim priority (quietHide / async load).
 * Put urgent cards first (streak risk → yesterday summary → evening → tip).
 */
export function MotivationQueue({ children }: { children: ReactNode }) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const [states, setStates] = useState<SlotState[]>(() => items.map(() => "unknown"));

  // Keep state length aligned when the child list changes (e.g. date nav).
  if (states.length !== items.length) {
    setStates(items.map(() => "unknown"));
  }

  const setOccupancy = useCallback((index: number, occupied: boolean) => {
    setStates((prev) => {
      const nextState: SlotState = occupied ? "occupied" : "empty";
      if (prev[index] === nextState) return prev;
      const next = prev.slice();
      next[index] = nextState;
      return next;
    });
  }, []);

  // Mount from the start through the first occupied (or through unknowns while probing).
  let mountCount = 0;
  for (let i = 0; i < items.length; i++) {
    const beforeEmpty = states.slice(0, i).every((s) => s === "empty");
    if (!beforeEmpty && i > 0) break;
    mountCount = i + 1;
    if (states[i] === "occupied") break;
    if (states[i] === "unknown") break;
  }

  if (items.length === 0) return null;

  return (
    <div className="motivation-queue flex flex-col gap-4">
      {items.slice(0, mountCount).map((child, index) => (
        <OccupancySlot
          key={index}
          onOccupancy={(occupied) => setOccupancy(index, occupied)}
        >
          {child}
        </OccupancySlot>
      ))}
    </div>
  );
}

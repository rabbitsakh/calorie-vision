"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GYM_TOUR_STEPS,
  advanceGymTour,
  gymTourStepIndex,
  markGymTourSeen,
  readGymTourSeen,
  shouldShowGymTour,
} from "@/lib/gym-onboarding";

type Box = { top: number; left: number; width: number; height: number };

function visibleTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 8 && rect.height > 8) return node;
  }
  return null;
}

/**
 * Короткий тур: карта мышц, программы, ИИ-тренер, ассистент.
 * `force` — только для локального кадра, без записи флага.
 */
export function GymOnboarding({ force = false }: { force?: boolean }) {
  const { status } = useSession();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(() => gymTourStepIndex(searchParams.get("tour")));
  const indexRef = useRef(index);
  indexRef.current = index;
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    if (force) {
      setOpen(true);
      return;
    }
    if (status !== "authenticated") return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/try")) {
      return;
    }
    const seen =
      readGymTourSeen(window.localStorage) || readGymTourSeen(window.sessionStorage);
    if (!shouldShowGymTour(seen, true)) return;
    setOpen(true);
  }, [force, pathname, status]);

  const step =
    GYM_TOUR_STEPS[Math.min(Math.max(index, 0), GYM_TOUR_STEPS.length - 1)] ?? GYM_TOUR_STEPS[0];

  useEffect(() => {
    if (!open || force) return;
    const params = new URLSearchParams(searchParams.toString());
    const onPage = pathname === step.href || pathname.startsWith(`${step.href}/`);
    if (onPage && params.get("tour") === step.id) return;
    params.set("tour", step.id);
    router.replace(`${step.href}?${params.toString()}`);
  }, [force, open, pathname, router, searchParams, step.href, step.id]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let tries = 0;
    const measure = () => {
      const node = visibleTarget(step.target);
      if (!node) {
        if (tries++ < 24) {
          frame = requestAnimationFrame(measure);
          return;
        }
        setBox(null);
        return;
      }
      node.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = node.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    frame = requestAnimationFrame(measure);
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, step.target, pathname]);

  const close = useCallback(
    (done: boolean) => {
      if (!force && done) {
        markGymTourSeen(window.localStorage);
        markGymTourSeen(window.sessionStorage);
      }
      setOpen(false);
      const params = new URLSearchParams(searchParams.toString());
      if (params.has("tour")) {
        params.delete("tour");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
    },
    [force, pathname, router, searchParams],
  );

  if (!open) return null;

  const last = index >= GYM_TOUR_STEPS.length - 1;
  const cardOnTop = box != null && box.top > window.innerHeight * 0.5;

  return (
    <div className="gym-tour" role="dialog" aria-modal="true" aria-labelledby="gym-tour-title">
      <div
        className="gym-tour__backdrop"
        style={
          box
            ? {
                clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.left - 6}px ${box.top - 6}px, ${box.left + box.width + 6}px ${box.top - 6}px, ${box.left + box.width + 6}px ${box.top + box.height + 6}px, ${box.left - 6}px ${box.top + box.height + 6}px, ${box.left - 6}px ${box.top - 6}px)`,
              }
            : undefined
        }
      />
      {box ? (
        <div
          className="gym-tour__hole"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
        />
      ) : null}
      <div className={`gym-tour__card ${cardOnTop ? "gym-tour__card--top" : "gym-tour__card--bottom"}`}>
        <p className="gym-tour__kicker">
          {index + 1} из {GYM_TOUR_STEPS.length}
        </p>
        <h2 id="gym-tour-title" className="gym-tour__title">
          {step.title}
        </h2>
        <p className="gym-tour__body">{step.body}</p>
        <div className="gym-tour__row">
          <div className="gym-tour__dots" aria-hidden>
            {GYM_TOUR_STEPS.map((item, dot) => (
              <span key={item.id} className={`gym-tour__dot${dot === index ? " is-on" : ""}`} />
            ))}
          </div>
          <div className="gym-tour__actions">
            <button type="button" className="gym-tour__skip" onClick={() => close(true)}>
              Пропустить
            </button>
            <button
              type="button"
              className="btn btn-primary gym-tour__next"
              onClick={() => {
                const next = advanceGymTour(indexRef.current);
                if (next.done) {
                  close(true);
                  return;
                }
                indexRef.current = next.index;
                setIndex(next.index);
              }}
            >
              {last ? "Готово" : "Дальше"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

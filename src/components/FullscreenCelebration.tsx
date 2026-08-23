"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CelebrationBurst } from "@/components/CelebrationBurst";
import { useCelebrationGate } from "@/components/CelebrationOrchestrator";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { getCelebrationPortalHost } from "@/lib/celebration-portal";

export type CelebrationVariant =
  | "cheer"
  | "streak"
  | "goal"
  | "badge"
  | "challenge"
  | "milestone";

type FullscreenCelebrationProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  variant?: CelebrationVariant;
  pose?: MascotPose;
  /** Auto-close after ms; omit / 0 = manual dismiss only. */
  durationMs?: number;
  ctaLabel?: string;
  onClose: () => void;
};

const VARIANT_THEME: Record<
  CelebrationVariant,
  { pose: MascotPose; colors: string[]; glow: string; badgeClass: string }
> = {
  cheer: {
    pose: "cheer",
    colors: ["#5eead4", "#14b8a6", "#99f6e4", "#fbbf24", "#ffffff"],
    glow: "fs-celeb-glow-teal",
    badgeClass: "bg-teal-500/90",
  },
  streak: {
    pose: "streak",
    colors: ["#f59e0b", "#fbbf24", "#14b8a6", "#5eead4", "#ffffff"],
    glow: "fs-celeb-glow-amber",
    badgeClass: "bg-amber-500/95",
  },
  goal: {
    pose: "goal",
    colors: ["#34d399", "#5eead4", "#14b8a6", "#a7f3d0", "#ffffff"],
    glow: "fs-celeb-glow-emerald",
    badgeClass: "bg-emerald-500/95",
  },
  badge: {
    pose: "cheer",
    colors: ["#a78bfa", "#5eead4", "#fbbf24", "#c4b5fd", "#ffffff"],
    glow: "fs-celeb-glow-violet",
    badgeClass: "bg-violet-500/95",
  },
  challenge: {
    pose: "goal",
    colors: ["#34d399", "#fbbf24", "#5eead4", "#6ee7b7", "#ffffff"],
    glow: "fs-celeb-glow-emerald",
    badgeClass: "bg-emerald-500/95",
  },
  milestone: {
    pose: "streak",
    colors: ["#f59e0b", "#14b8a6", "#5eead4", "#fde68a", "#ffffff"],
    glow: "fs-celeb-glow-amber",
    badgeClass: "bg-amber-500/95",
  },
};

/**
 * Immersive fullscreen celebration stage (Duolingo-style).
 * Portaled to a host on <html> so body overflow-x never clips it on iOS.
 */
export function FullscreenCelebration({
  open,
  title,
  subtitle,
  badge,
  variant = "cheer",
  pose,
  durationMs = 3200,
  ctaLabel = "Продолжить",
  onClose,
}: FullscreenCelebrationProps) {
  const [mounted, setMounted] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const gate = useCelebrationGate();
  const celebrationId = useId();
  const theme = VARIANT_THEME[variant];
  const resolvedPose = pose ?? theme.pose;
  const colors = useMemo(() => theme.colors, [theme.colors]);
  const autoClose = durationMs > 0;
  const isActive = !gate || gate.activeId === celebrationId;
  const show = open && isActive;

  useEffect(() => {
    setPortalHost(getCelebrationPortalHost());
    setMounted(true);
  }, []);

  const requestCelebration = gate?.requestCelebration;
  const releaseCelebration = gate?.releaseCelebration;

  useEffect(() => {
    if (!requestCelebration || !releaseCelebration) return;
    if (open) {
      requestCelebration(celebrationId);
    } else {
      releaseCelebration(celebrationId);
    }
    return () => releaseCelebration(celebrationId);
  }, [open, celebrationId, requestCelebration, releaseCelebration]);

  useEffect(() => {
    if (!show || !autoClose) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [show, autoClose, durationMs, onClose]);

  useEffect(() => {
    if (!show) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [show, onClose]);

  if (!show || !mounted || !portalHost) return null;

  return createPortal(
    <div
      className={`fs-celeb-root fs-celeb-${variant} flex flex-col`}
      role={autoClose ? "status" : "dialog"}
      aria-modal={autoClose ? undefined : true}
      aria-live="polite"
      aria-labelledby="fs-celeb-title"
      onClick={autoClose ? onClose : undefined}
    >
      <div className="fs-celeb-bg absolute inset-0" aria-hidden />
      <div className="fs-celeb-vignette absolute inset-0" aria-hidden />
      <CelebrationBurst active={show} colors={colors} />

      <div
        className="fs-celeb-content relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`fs-celeb-mascot-wrap relative mb-6 ${theme.glow}`}>
          <div className="fs-celeb-halo" aria-hidden />
          <Mascot pose={resolvedPose} size="xl" className="fs-celeb-mascot" />
          {badge ? (
            <span
              className={`fs-celeb-badge absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-bold text-white shadow-lg ${theme.badgeClass}`}
            >
              {badge}
            </span>
          ) : null}
        </div>

        <h2
          id="fs-celeb-title"
          className="fs-celeb-title max-w-sm text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-4xl"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="fs-celeb-subtitle mt-3 max-w-xs text-base text-teal-50/90 sm:text-lg">
            {subtitle}
          </p>
        ) : null}

        {!autoClose ? (
          <button
            type="button"
            className="fs-celeb-cta btn mt-10 min-h-12 w-full max-w-xs rounded-2xl bg-white px-6 text-base font-bold text-teal-900 shadow-lg hover:bg-teal-50"
            onClick={onClose}
          >
            {ctaLabel}
          </button>
        ) : (
          <button
            type="button"
            className="fs-celeb-skip mt-10 text-sm font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline"
            onClick={onClose}
          >
            Закрыть
          </button>
        )}
      </div>
    </div>,
    portalHost,
  );
}

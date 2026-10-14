"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/BrandMark";
import { LiveMascot } from "@/components/LiveMascot";
import { resolveMascotSkin } from "@/lib/mascot-skin";
import {
  buildPersonalSplashTip,
  pickSplashTip,
  splashMascotPose,
  splashStatusLabel,
  SPLASH_MIN_VISIBLE_MS,
  type SplashStatusPhase,
  type SplashTipContext,
} from "@/lib/splash-tips";

type AppSplashProps = {
  /** Optional tip; personal/server tip preferred when context is set. */
  tip?: string;
  /** Soft label under brand (e.g. «Открываем рацион…»). */
  status?: string;
  /** Full-viewport overlay (session boot) vs inline card. */
  fullscreen?: boolean;
  /** Streak / day-part context for a personal tip line. */
  tipContext?: SplashTipContext;
  /** When true, status becomes «Готово» and mascot cheers. */
  ready?: boolean;
};

/**
 * Brand splash: lively mascot + personal tip + thin progress.
 * Used while session resolves and while /ration day bootstraps.
 *
 * Fullscreen mode is portaled to <html>: `.cv-app-frame` is position:fixed
 * and would otherwise clip fixed overlays so the tab bar showed through.
 *
 * Wave D5 — Unbounded wordmark hero, accent-token stage, tip/ready motion.
 */
export function AppSplash({
  tip,
  status,
  fullscreen = true,
  tipContext,
  ready = false,
}: AppSplashProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<SplashStatusPhase>("boot");
  const [localTip, setLocalTip] = useState(() =>
    tip ?? buildPersonalSplashTip(tipContext ?? {}, Date.now()),
  );
  const [tipKey, setTipKey] = useState(0);

  const streak = tipContext?.streak ?? null;
  const loggedToday = tipContext?.loggedToday ?? null;
  const serverTip = tipContext?.serverTip ?? null;
  const hour = tipContext?.hour ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (ready) {
      setPhase("ready");
      return;
    }
    setPhase("boot");
    const t = window.setTimeout(() => setPhase("loading"), 650);
    return () => window.clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (tip) {
      setLocalTip(tip);
      setTipKey((k) => k + 1);
      return;
    }
    const ctx = { streak, loggedToday, serverTip, hour };
    setLocalTip(buildPersonalSplashTip(ctx, Date.now()));
    setTipKey((k) => k + 1);
    if (serverTip || (streak ?? 0) >= 2) {
      return;
    }
    const id = window.setInterval(() => {
      setLocalTip(pickSplashTip(Date.now()));
      setTipKey((k) => k + 1);
    }, Math.max(2200, Math.floor(SPLASH_MIN_VISIBLE_MS * 0.9)));
    return () => window.clearInterval(id);
  }, [tip, streak, loggedToday, serverTip, hour]);

  const statusLabel = splashStatusLabel(phase, status);
  const pose = splashMascotPose(phase, streak);
  const skin = resolveMascotSkin();

  const inner = (
    <div className="app-splash-inner relative z-10 flex w-full max-w-sm flex-col items-center px-6 text-center">
      <div className="app-splash-brand flex flex-col items-center gap-3">
        <BrandMark size={72} />
        <span className="app-splash-wordmark">Calorie Vision</span>
      </div>

      <div className="app-splash-mascot relative mt-8" key={`${pose}-${skin}`}>
        <span className="app-splash-mascot-glow" aria-hidden />
        <LiveMascot
          pose={pose}
          skin={skin}
          size="xl"
          title="Талисман"
          entrance
          idleReel={false}
          interactive={false}
        />
      </div>

      <p
        key={tipKey}
        className="app-splash-tip mt-7 min-h-[3.25rem] text-base font-medium leading-snug text-white/95"
      >
        {localTip}
      </p>
      <p
        className={`app-splash-status mt-3 text-xs font-semibold uppercase ${
          phase === "ready" ? "app-splash-status--ready" : "text-[var(--on-ink)]/80"
        }`}
      >
        {statusLabel}
      </p>

      <div className="app-splash-bar mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-white/20" aria-hidden>
        <div
          className={`h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.45)] transition-all duration-500 ${
            phase === "ready" ? "app-splash-bar-done w-full" : "app-splash-bar-fill w-1/2"
          }`}
        />
      </div>
    </div>
  );

  if (!fullscreen) {
    return (
      <div className="app-splash app-splash-inline relative flex justify-center overflow-hidden rounded-2xl py-12">
        <div className="app-splash-atmosphere" aria-hidden />
        {inner}
      </div>
    );
  }

  const overlay = (
    <div
      className="app-splash app-splash-full fixed inset-0 z-[90] flex items-center justify-center overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="app-splash-atmosphere" aria-hidden />
      {inner}
    </div>
  );

  if (!mounted || typeof document === "undefined") {
    return overlay;
  }

  return createPortal(overlay, document.documentElement);
}

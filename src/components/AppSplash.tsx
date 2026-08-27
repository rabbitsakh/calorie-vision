"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Mascot } from "@/components/Mascot";
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
 * Brand splash: mascot + rotating/personal tip + thin progress.
 * Used while session resolves and while /ration day bootstraps.
 */
export function AppSplash({
  tip,
  status,
  fullscreen = true,
  tipContext,
  ready = false,
}: AppSplashProps) {
  const [phase, setPhase] = useState<SplashStatusPhase>("boot");
  const [localTip, setLocalTip] = useState(() =>
    tip ?? buildPersonalSplashTip(tipContext ?? {}, Date.now()),
  );

  const streak = tipContext?.streak ?? null;
  const loggedToday = tipContext?.loggedToday ?? null;
  const serverTip = tipContext?.serverTip ?? null;
  const hour = tipContext?.hour ?? null;

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
      return;
    }
    const ctx = { streak, loggedToday, serverTip, hour };
    setLocalTip(buildPersonalSplashTip(ctx, Date.now()));
    if (serverTip || (streak ?? 0) >= 2) {
      return;
    }
    const id = window.setInterval(() => {
      setLocalTip(pickSplashTip(Date.now()));
    }, Math.max(2200, Math.floor(SPLASH_MIN_VISIBLE_MS * 0.9)));
    return () => window.clearInterval(id);
  }, [tip, streak, loggedToday, serverTip, hour]);

  const statusLabel = splashStatusLabel(phase, status);
  const pose = splashMascotPose(phase, streak);
  const skin = resolveMascotSkin();

  const inner = (
    <div className="app-splash-inner flex w-full max-w-sm flex-col items-center px-6 text-center">
      <div className="app-splash-brand flex items-center gap-2.5">
        <BrandMark size={36} />
        <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-teal-50">
          Calorie Vision
        </span>
      </div>

      <div className="app-splash-mascot mt-8" key={`${pose}-${skin}`}>
        <Mascot pose={pose} skin={skin} size="lg" title="Талисман" entrance animate />
      </div>

      <p className="app-splash-tip mt-6 min-h-[3rem] text-base font-medium leading-snug text-white/95">
        {localTip}
      </p>
      <p
        className={`mt-3 text-xs font-semibold uppercase tracking-wide transition-colors duration-300 ${
          phase === "ready" ? "text-emerald-200" : "text-teal-100/80"
        }`}
      >
        {statusLabel}
      </p>

      <div className="app-splash-bar mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/20" aria-hidden>
        <div
          className={`h-full rounded-full bg-white transition-all duration-500 ${
            phase === "ready" ? "app-splash-bar-done w-full" : "app-splash-bar-fill w-1/2"
          }`}
        />
      </div>
    </div>
  );

  if (!fullscreen) {
    return (
      <div className="app-splash app-splash-inline flex justify-center rounded-2xl bg-gradient-to-b from-teal-800 to-teal-950 py-10">
        {inner}
      </div>
    );
  }

  return (
    <div
      className="app-splash app-splash-full fixed inset-0 z-[90] flex items-center justify-center bg-gradient-to-b from-teal-700 via-teal-800 to-teal-950"
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      {inner}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Mascot } from "@/components/Mascot";
import { pickSplashTip } from "@/lib/splash-tips";

type AppSplashProps = {
  /** Optional tip; rotates locally if omitted. */
  tip?: string;
  /** Soft label under brand (e.g. «Открываем рацион…»). */
  status?: string;
  /** Full-viewport overlay (session boot) vs inline card. */
  fullscreen?: boolean;
};

/**
 * Brand splash: mascot + rotating tip + thin progress.
 * Used while session resolves and while /ration day bootstraps.
 */
export function AppSplash({
  tip,
  status = "Загружаем…",
  fullscreen = true,
}: AppSplashProps) {
  const [localTip, setLocalTip] = useState(() => tip ?? pickSplashTip());

  useEffect(() => {
    if (tip) {
      setLocalTip(tip);
      return;
    }
    const id = window.setInterval(() => {
      setLocalTip(pickSplashTip(Date.now()));
    }, 3200);
    return () => window.clearInterval(id);
  }, [tip]);

  const inner = (
    <div className="app-splash-inner flex w-full max-w-sm flex-col items-center px-6 text-center">
      <div className="app-splash-brand flex items-center gap-2.5">
        <BrandMark size={36} />
        <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-teal-50">
          Calorie Vision
        </span>
      </div>

      <div className="app-splash-mascot mt-8">
        <Mascot pose="tip" size="lg" title="Талисман" entrance />
      </div>

      <p className="mt-6 min-h-[3rem] text-base font-medium leading-snug text-white/95">
        {localTip}
      </p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-teal-100/80">{status}</p>

      <div className="app-splash-bar mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/20" aria-hidden>
        <div className="app-splash-bar-fill h-full w-1/2 rounded-full bg-white" />
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
      aria-busy="true"
    >
      {inner}
    </div>
  );
}

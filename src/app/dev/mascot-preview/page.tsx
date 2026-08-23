"use client";

import { Mascot, type MascotPose } from "@/components/Mascot";

const POSES: MascotPose[] = ["idle", "cheer", "streak", "goal", "tip", "empty"];

/**
 * Local visual QA for the celebration mascot.
 * Open /dev/mascot-preview — not linked from nav.
 */
export default function MascotCelebrationPreviewPage() {
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="fs-celeb-root fs-celeb-milestone relative flex min-h-[100svh] flex-col">
        <div className="fs-celeb-bg absolute inset-0" aria-hidden />
        <div className="fs-celeb-vignette absolute inset-0" aria-hidden />
        <div className="fs-celeb-content relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10 pt-10 text-center">
          <div className="fs-celeb-mascot-wrap relative mb-6 fs-celeb-glow-amber">
            <div className="fs-celeb-halo" aria-hidden />
            <Mascot pose="cheer" size="xl" className="fs-celeb-mascot" title="Живой маскот" />
            <span className="fs-celeb-badge absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/95 px-3 py-1 text-sm font-bold text-white shadow-lg">
              30
            </span>
          </div>
          <h1 className="fs-celeb-title max-w-sm text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-4xl">
            30 дней подряд!
          </h1>
          <p className="fs-celeb-subtitle mt-3 max-w-xs text-base text-teal-50/90 sm:text-lg">
            Месяц дневника — невероятно! Вы в форме.
          </p>
          <button
            type="button"
            className="fs-celeb-cta btn mt-10 min-h-12 w-full max-w-xs rounded-2xl bg-white px-6 text-base font-bold text-teal-900 shadow-lg"
          >
            Продолжить
          </button>
        </div>
      </div>

      <section className="mx-auto grid max-w-3xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-3">
        {POSES.map((pose) => (
          <div
            key={pose}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 shadow-sm"
          >
            <Mascot pose={pose} size="lg" title={pose} />
            <span className="text-xs font-semibold uppercase tracking-wide text-teal-800">{pose}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

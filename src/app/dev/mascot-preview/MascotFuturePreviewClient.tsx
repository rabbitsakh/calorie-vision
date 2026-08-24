"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FullscreenCelebration, type CelebrationVariant } from "@/components/FullscreenCelebration";
import { LandingFreeHighlight } from "@/components/LandingFreeHighlight";
import { LandingFooterCta } from "@/components/LandingFooterCta";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { MascotCompanionCard } from "@/components/MascotCompanionCard";

const POSES: MascotPose[] = ["idle", "cheer", "streak", "goal", "tip", "empty"];

const CELEB_SCENES: Array<{
  id: CelebrationVariant;
  title: string;
  subtitle: string;
  badge?: string;
  pose: MascotPose;
}> = [
  {
    id: "streak",
    title: "30 дней подряд!",
    subtitle: "Месяц дневника — невероятно! Вы в форме.",
    badge: "30",
    pose: "streak",
  },
  {
    id: "goal",
    title: "Цель по калориям!",
    subtitle: "Сегодня вы в коридоре ±8% — отличный баланс.",
    pose: "goal",
  },
  {
    id: "cheer",
    title: "Первый приём пищи!",
    subtitle: "Дневник ожил — так держать.",
    pose: "cheer",
  },
  {
    id: "badge",
    title: "Новый значок!",
    subtitle: "«Неделя без пропусков» — заслуженно.",
    badge: "★",
    pose: "cheer",
  },
];

/** Dev QA: celebration + 2 landing placements + in-app companion. */
export default function MascotFuturePreviewPage() {
  const searchParams = useSearchParams();
  const [activeScene, setActiveScene] = useState<(typeof CELEB_SCENES)[number] | null>(null);

  useEffect(() => {
    const sceneId = searchParams.get("scene") as CelebrationVariant | null;
    if (!sceneId) return;
    const scene = CELEB_SCENES.find((item) => item.id === sceneId);
    if (scene) setActiveScene(scene);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Маскот · план 10 PR</p>
        <h1 className="mt-2 text-2xl font-extrabold text-stone-900">Celebration + 2 места на лендинге</h1>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="text-lg font-bold">Celebration</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CELEB_SCENES.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => setActiveScene(scene)}
              className="rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm hover:border-teal-300"
            >
              <Mascot pose={scene.pose} size="md" />
              <p className="mt-2 font-bold">{scene.title}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="border-t bg-white">
        <p className="px-4 pt-6 text-center text-sm text-stone-600">Лендинг — 2 места: «Бесплатно» (tip) + footer CTA (cheer)</p>
        <div className="landing">
          <LandingFreeHighlight />
          <LandingFooterCta />
        </div>
      </section>

      <section className="mx-auto max-w-lg px-4 py-8">
        <MascotCompanionCard pose="tip" title="Совет дня">
          Сфотографируйте тарелку целиком — так распознавание точнее.
        </MascotCompanionCard>
      </section>

      <section className="mx-auto grid max-w-3xl grid-cols-3 gap-4 px-4 pb-10">
        {POSES.map((pose) => (
          <div key={pose} className="flex flex-col items-center rounded-xl bg-white p-3 shadow-sm">
            <Mascot pose={pose} size="md" title={pose} />
            <span className="mt-1 text-[10px] font-semibold uppercase text-stone-500">{pose}</span>
          </div>
        ))}
      </section>

      <FullscreenCelebration
        open={activeScene !== null}
        variant={activeScene?.id ?? "cheer"}
        title={activeScene?.title ?? ""}
        subtitle={activeScene?.subtitle}
        badge={activeScene?.badge}
        pose={activeScene?.pose}
        durationMs={0}
        onClose={() => setActiveScene(null)}
      />
    </div>
  );
}

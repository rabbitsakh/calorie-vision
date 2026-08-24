"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FullscreenCelebration, type CelebrationVariant } from "@/components/FullscreenCelebration";
import { LandingFreeHighlight } from "@/components/LandingFreeHighlight";
import { LandingFooterCta } from "@/components/LandingFooterCta";
import { LiveMascot } from "@/components/LiveMascot";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { MascotCompanionCard } from "@/components/MascotCompanionCard";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { MascotSaveReaction } from "@/components/MascotSaveReaction";
import { playCelebrationChime } from "@/lib/celebration-chime";
import type { MascotGesture } from "@/lib/mascot-liveness";
import { MascotSkinProvider } from "@/lib/mascot-skin-context";
import {
  MASCOT_SKINS,
  MASCOT_SKIN_IDS,
  parseMascotSkinId,
  resolveMascotSkin,
  type MascotRendererMode,
  type MascotSkinId,
} from "@/lib/mascot-skin";

const POSES: MascotPose[] = ["idle", "cheer", "streak", "goal", "tip", "empty"];
const GESTURES: MascotGesture[] = ["look", "yawn", "stretch", "wave", "pet", "react"];
const RENDERERS: MascotRendererMode[] = ["auto", "svg", "rive"];

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
];

/** Dev QA: lively mascot — face, gestures, pet, chime, save reaction, seasonal skins. */
export default function MascotFuturePreviewPage() {
  const searchParams = useSearchParams();
  const [activeScene, setActiveScene] = useState<(typeof CELEB_SCENES)[number] | null>(null);
  const [gesture, setGesture] = useState<MascotGesture>("none");
  const [skin, setSkin] = useState<MascotSkinId>(() => resolveMascotSkin());
  const [renderer, setRenderer] = useState<MascotRendererMode>("auto");

  useEffect(() => {
    const sceneId = searchParams.get("scene") as CelebrationVariant | null;
    if (!sceneId) return;
    const scene = CELEB_SCENES.find((item) => item.id === sceneId);
    if (scene) setActiveScene(scene);
  }, [searchParams]);

  useEffect(() => {
    const fromUrl = parseMascotSkinId(searchParams.get("skin"));
    if (fromUrl) setSkin(fromUrl);
  }, [searchParams]);

  return (
    <MascotSkinProvider skinOverride={skin} rendererOverride={renderer}>
      <div className="min-h-screen bg-stone-100">
        <MascotSaveReaction />
        <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
            Маскот · Duo season looks
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-stone-900">Живые анимации</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            Сезоны и ивенты (НГ, Хэллоуин). Тап — pet без рывка. Rive не обязателен.
          </p>
        </header>

        <section className="mx-auto max-w-lg px-4 py-6">
          <p className="text-center text-sm font-semibold text-stone-700">Сезон и рендерер</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {MASCOT_SKIN_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  skin === id
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-stone-200 bg-white text-stone-700"
                }`}
                onClick={() => setSkin(id)}
              >
                {MASCOT_SKINS[id].label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {RENDERERS.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  renderer === mode
                    ? "border-amber-500 bg-amber-100 text-amber-950"
                    : "border-stone-200 bg-white text-stone-600"
                }`}
                onClick={() => setRenderer(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-lg px-4 py-4 text-center">
          <p className="text-sm font-semibold text-stone-700">Тапни — погладить · idle reel сам</p>
          <div className="mt-4 flex justify-center">
            <LiveMascot pose="idle" size="xl" interactive idleReel entrance />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {GESTURES.map((g) => (
              <button
                key={g}
                type="button"
                className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-bold text-teal-800"
                onClick={() => {
                  setGesture(g);
                  window.setTimeout(() => setGesture("none"), 1400);
                }}
              >
                {g}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
              onClick={() => playCelebrationChime("cheer")}
            >
              chime
            </button>
            <button
              type="button"
              className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900"
              onClick={() => emitMascotReaction("save")}
            >
              save reaction
            </button>
          </div>
          {gesture !== "none" ? (
            <div className="mt-4 flex justify-center">
              <Mascot pose="idle" gesture={gesture} skin={skin} size="lg" />
            </div>
          ) : null}
        </section>

        <section className="mx-auto max-w-4xl px-4 py-6">
          <h2 className="text-lg font-bold">Все сезоны</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {MASCOT_SKIN_IDS.map((id) => (
              <div key={id} className="flex flex-col items-center rounded-2xl bg-white p-3 shadow-sm">
                <Mascot pose="idle" skin={id} size="md" />
                <span className="mt-2 text-[10px] font-bold uppercase text-stone-500">
                  {MASCOT_SKINS[id].label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-6">
          <h2 className="text-lg font-bold">Celebration + sound</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {CELEB_SCENES.map((scene) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => setActiveScene(scene)}
                className="rounded-2xl border bg-white p-4 text-left shadow-sm"
              >
                <Mascot pose={scene.pose} skin={skin} size="md" entrance />
                <p className="mt-2 font-bold">{scene.title}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="border-t bg-white">
          <p className="px-4 pt-6 text-center text-sm text-stone-600">Лендинг · 2 места · pet</p>
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
              <Mascot pose={pose} skin={skin} size="md" title={pose} />
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
    </MascotSkinProvider>
  );
}

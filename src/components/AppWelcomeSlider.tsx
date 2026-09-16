"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Mascot } from "@/components/Mascot";
import { markAppWelcomeSeen } from "@/lib/capacitor-welcome";
import type { MascotPose } from "@/lib/mascot-types";
import { withBasePath } from "@/lib/paths";

type Slide = {
  id: string;
  title: string;
  body: string;
  pose: MascotPose;
};

const SLIDES: Slide[] = [
  {
    id: "photo",
    title: "Сфотографируйте еду",
    body: "Тарелка, этикетка или штрихкод — приложение оценит порцию и КБЖУ.",
    pose: "tip",
  },
  {
    id: "diary",
    title: "Дневник под рукой",
    body: "Рацион, вода, вес и серия дней — всё в одном месте, без таблиц ради таблиц.",
    pose: "idle",
  },
  {
    id: "offline",
    title: "Не теряется офлайн",
    body: "Фото встанет в очередь без сети и сохранится, когда связь вернётся.",
    pose: "goal",
  },
  {
    id: "free",
    title: "Полностью бесплатно",
    body: "Войдите и ведите дневник — без подписки и без «сайта снаружи».",
    pose: "cheer",
  },
];

type AppWelcomeSliderProps = {
  onFinished?: () => void;
};

export function AppWelcomeSlider({ onFinished }: AppWelcomeSliderProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const slide = SLIDES[index] ?? SLIDES[0];
  const isLast = index >= SLIDES.length - 1;

  const finish = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    await markAppWelcomeSeen();
    if (onFinished) {
      onFinished();
      return;
    }
    router.replace(withBasePath("/login"));
  }, [leaving, onFinished, router]);

  const next = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }, [finish, isLast]);

  useEffect(() => {
    document.documentElement.classList.add("capacitor-native");
  }, []);

  return (
    <main className="app-welcome" aria-label="Знакомство с Calorie Vision">
      <div className="app-welcome-atmosphere" aria-hidden />
      <header className="app-welcome-brand">
        <BrandMark size={48} />
        <p className="app-welcome-brand-name">Calorie Vision</p>
      </header>

      <div key={slide.id} className="app-welcome-stage">
        <div className="app-welcome-mascot">
          <Mascot pose={slide.pose} size="xl" />
        </div>
        <h1 className="app-welcome-title">{slide.title}</h1>
        <p className="app-welcome-body">{slide.body}</p>
      </div>

      <div className="app-welcome-dots" role="tablist" aria-label="Слайды">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Слайд ${i + 1}`}
            className={`app-welcome-dot${i === index ? " is-active" : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

      <div className="app-welcome-actions">
        <button
          type="button"
          className="btn btn-primary app-welcome-cta"
          disabled={leaving}
          onClick={next}
        >
          {isLast ? "Войти" : "Далее"}
        </button>
        {!isLast ? (
          <button
            type="button"
            className="app-welcome-skip"
            disabled={leaving}
            onClick={() => void finish()}
          >
            Пропустить
          </button>
        ) : null}
      </div>
    </main>
  );
}

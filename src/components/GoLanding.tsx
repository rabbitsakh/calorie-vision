"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { getRustoreBadgeUrl, RUSTORE_BADGE_SRC } from "@/lib/android-install";
import { withBasePath } from "@/lib/paths";
import {
  hrefWithAttribution,
  mergeFirstTouch,
  readStoredAttribution,
  writeStoredAttribution,
  type SignupAttribution,
} from "@/lib/signup-attribution";

const POINTS = [
  { title: "Фото → КБЖУ", text: "Тарелка или этикетка. Калории, белки, жиры и углеводы за секунды." },
  { title: "Дневник", text: "Результат можно сохранить после входа. Два фото в сутки — без регистрации." },
  { title: "ИИ-тренер и зал", text: "Программы, карта мышц и черновик тренировки. Это журнал, не медсовет." },
];

export function GoLanding({ initial }: { initial: SignupAttribution | null }) {
  const [attribution, setAttribution] = useState<SignupAttribution | null>(initial);

  useEffect(() => {
    const stored = readStoredAttribution(window.localStorage);
    const merged = mergeFirstTouch(stored, initial);
    if (merged) writeStoredAttribution(window.localStorage, merged);
    setAttribution(merged);
  }, [initial]);

  const tryHref = hrefWithAttribution("/try", attribution);
  const loginHref = hrefWithAttribution("/login", attribution);
  const rustore = getRustoreBadgeUrl();

  return (
    <main className="go-landing">
      <header className="go-landing__top">
        <Link href="/" className="go-landing__brand" aria-label="Calorie Vision">
          <BrandMark size={40} decorative={false} />
          <span>Calorie Vision</span>
        </Link>
        <Link href={loginHref} className="go-landing__login">
          Войти
        </Link>
      </header>

      <section className="go-landing__hero">
        <p className="go-landing__kicker">Бесплатно · без подписки</p>
        <h1 className="go-landing__title">Фото еды → калории и БЖУ за секунды</h1>
        <p className="go-landing__lead">
          Сфотографируйте тарелку. Рядом — ИИ-тренер и зал: программы и карта мышц.
        </p>
        <Link href={tryHref} className="btn btn-primary go-landing__cta">
          Попробовать бесплатно
        </Link>
        <p className="go-landing__note">2 фото в сутки без входа. Сохранение в дневник — после регистрации.</p>
        {rustore ? (
          <a
            href={rustore}
            className="go-landing__store"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Скачать из RuStore"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBasePath(RUSTORE_BADGE_SRC)} alt="Скачать из RuStore" width={188} height={68} />
          </a>
        ) : null}
      </section>

      <ul className="go-landing__points">
        {POINTS.map((point) => (
          <li key={point.title}>
            <p className="go-landing__point-title">{point.title}</p>
            <p className="go-landing__point-text">{point.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

"use client";

import Link from "next/link";
import { Mascot } from "@/components/Mascot";

/** Единственное место маскота на лендинге — он ведёт блок про бесплатный доступ. */
export function LandingFreeHighlight() {
  return (
    <section id="free" className="landing-section landing-free-section">
      <div className="landing-free-layout">
        <div className="landing-free-mascot-stage" aria-hidden>
          <div className="landing-free-mascot-glow" />
          <Mascot
            pose="tip"
            size="lg"
            className="landing-free-mascot landing-mascot-float"
            title="Талисман Calorie Vision"
          />
        </div>
        <div className="landing-free-copy">
          <p className="landing-kicker">Бесплатно на старте</p>
          <h2 className="landing-section-title">Пока всё — без оплаты</h2>
          <p className="landing-section-text landing-section-text-wide">
            Мы на этапе запуска и хотим, чтобы вы спокойно попробовали продукт. Сейчас весь дневник,
            распознавание и статистика доступны{" "}
            <strong className="landing-inline-strong">полностью бесплатно</strong> — без пробного
            периода, который внезапно заканчивается.
          </p>
          <ul className="landing-free-list">
            <li>Неограниченные записи в дневнике</li>
            <li>Распознавание: тарелка, этикетка, штрихкод, текст</li>
            <li>Вода, серия, статистика, вес и недельные отчёты</li>
            <li>Push-напоминания и мягкая мотивация</li>
            <li>Вход через Google, VK, Telegram или email</li>
          </ul>
          <Link href="/login" className="btn btn-primary landing-cta-primary landing-cta-sheen landing-free-cta">
            Создать аккаунт бесплатно
          </Link>
        </div>
      </div>
    </section>
  );
}

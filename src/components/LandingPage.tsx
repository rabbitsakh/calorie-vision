import Link from "next/link";
import { Manrope, Unbounded } from "next/font/google";
import { BrandMark } from "@/components/BrandMark";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-landing-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-landing-body",
  display: "swap",
});

function HeroVisual() {
  return (
    <div className="landing-hero-visual" aria-hidden>
      <div className="landing-hero-glow" />
      <svg className="landing-hero-art" viewBox="0 0 720 560" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="plateGrad" x1="120" y1="80" x2="600" y2="460" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ecfdf8" />
            <stop offset="0.45" stopColor="#5eead4" />
            <stop offset="1" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id="bowlGrad" x1="260" y1="160" x2="480" y2="380" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff7ed" />
            <stop offset="1" stopColor="#fdba74" />
          </linearGradient>
          <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <ellipse cx="360" cy="470" rx="300" ry="52" fill="#0f766e" opacity="0.2" />
        <ellipse cx="360" cy="458" rx="230" ry="30" fill="#134e4a" opacity="0.14" />

        <ellipse cx="360" cy="310" rx="220" ry="158" fill="url(#plateGrad)" />
        <ellipse cx="360" cy="310" rx="176" ry="124" fill="#f8fafc" opacity="0.5" />

        <ellipse cx="338" cy="288" rx="98" ry="74" fill="url(#bowlGrad)" opacity="0.92" />
        <ellipse cx="392" cy="322" rx="74" ry="54" fill="#4ade80" opacity="0.78" />
        <ellipse cx="308" cy="332" rx="52" ry="38" fill="#fb923c" opacity="0.88" />
        <ellipse cx="372" cy="258" rx="40" ry="30" fill="#f87171" opacity="0.72" />
        <ellipse cx="428" cy="278" rx="36" ry="26" fill="#a3e635" opacity="0.82" />

        <circle cx="240" cy="178" r="78" fill="#ffffff" opacity="0.32" filter="url(#softBlur)" />

        <g stroke="#4BE0BC" strokeWidth="5" strokeLinecap="square" fill="none" opacity="0.95">
          <path d="M200 140V96h44" />
          <path d="M520 140V96h-44" />
          <path d="M200 420v44h44" />
          <path d="M520 420v44h-44" />
        </g>
        <path
          d="M458 178a102 102 0 1 0 0 164"
          stroke="#027678"
          strokeWidth="18"
          strokeLinecap="butt"
          fill="none"
          opacity="0.92"
        />
      </svg>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="landing-install-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10M8.5 6.5 12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="landing-install-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className={`landing ${display.variable} ${body.variable}`}>
      <header className="landing-top">
        <Link href="/" className="landing-top-brand" aria-label="Calorie Vision — на главную">
          <BrandMark size={36} decorative={false} />
          <span>Calorie Vision</span>
        </Link>
        <nav className="landing-top-nav" aria-label="Разделы">
          <a href="#how" className="landing-top-link">
            Как работает
          </a>
          <a href="#install" className="landing-top-link">
            Установка
          </a>
          <Link href="/login" className="landing-top-cta">
            Войти
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy landing-fade-up">
          <p className="landing-brand">Calorie Vision</p>
          <h1 className="landing-headline">Еда по фото — калории без таблиц</h1>
          <p className="landing-lead">
            Сфотографируйте блюдо: распознаем порцию, КБЖУ и сохраним день в дневнике.
          </p>
          <div className="landing-cta">
            <Link href="/login" className="btn btn-primary landing-cta-primary">
              Начать бесплатно
            </Link>
            <a href="#install" className="landing-cta-secondary">
              Как установить на телефон
            </a>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section id="how" className="landing-section landing-fade-up-delay">
        <p className="landing-kicker">Как это работает</p>
        <h2 className="landing-section-title">Три шага до записи в дневник</h2>
        <ol className="landing-steps">
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden>
              01
            </span>
            <div>
              <h3 className="landing-step-title">Фото, название или штрихкод</h3>
              <p className="landing-section-text">
                Камера или галерея — распознаём блюдо на тарелке, этикетку или штрихкод упаковки.
              </p>
            </div>
          </li>
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden>
              02
            </span>
            <div>
              <h3 className="landing-step-title">Проверьте порцию</h3>
              <p className="landing-section-text">
                Подправьте граммы или название — калории и БЖУ пересчитаются сразу, до сохранения.
              </p>
            </div>
          </li>
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden>
              03
            </span>
            <div>
              <h3 className="landing-step-title">День собирается сам</h3>
              <p className="landing-section-text">
                Запись попадает в рацион: завтрак, обед, ужин или перекус — с прогрессом по норме.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="landing-section landing-section-alt">
        <p className="landing-kicker">Внутри приложения</p>
        <h2 className="landing-section-title">День, макросы и мягкая серия</h2>
        <p className="landing-section-text landing-section-text-wide">
          Норма калорий, белки, жиры, углеводы, клетчатка и сахар. Статистика по неделям, вес и цель —
          без давления: мягкие напоминания и отметки серии помогают не бросать привычку.
        </p>
        <ul className="landing-feature-list">
          <li>Распознавание по фото и поиск по названию</li>
          <li>Дневник с приёмами пищи и водой</li>
          <li>Цель по весу и календарь прогресса</li>
          <li>Напоминания push (на iPhone — из ярлыка на экране «Домой»)</li>
        </ul>
      </section>

      <section id="install" className="landing-section landing-install">
        <p className="landing-kicker">На телефон</p>
        <h2 className="landing-section-title">Установите как приложение</h2>
        <p className="landing-section-text landing-section-text-wide">
          Calorie Vision — веб-приложение (PWA). Откройте{" "}
          <strong className="landing-inline-strong">calorievision.ru</strong> в браузере телефона и
          добавьте на экран «Домой» — будет иконка и полноэкранный режим, как у обычного приложения.
        </p>

        <div className="landing-install-grid">
          <article className="landing-install-col">
            <h3 className="landing-install-heading">
              <ShareIcon />
              iPhone (Safari)
            </h3>
            <ol className="landing-install-steps">
              <li>Откройте сайт в Safari (не в Chrome).</li>
              <li>
                Нажмите «Поделиться» <ShareIcon /> внизу экрана.
              </li>
              <li>Выберите «На экран „Домой“» → «Добавить».</li>
              <li>Запускайте приложение с иконки — так работают уведомления (iOS 16.4+).</li>
            </ol>
          </article>

          <article className="landing-install-col">
            <h3 className="landing-install-heading">
              <MenuIcon />
              Android (Chrome)
            </h3>
            <ol className="landing-install-steps">
              <li>Откройте сайт в Chrome.</li>
              <li>
                Меню <MenuIcon /> → «Установить приложение» или «Добавить на главный экран».
              </li>
              <li>Подтвердите установку.</li>
              <li>Открывайте с иконки — удобнее дневник и напоминания.</li>
            </ol>
          </article>
        </div>
      </section>

      <section className="landing-footer-cta">
        <p className="landing-brand landing-brand-sm">Calorie Vision</p>
        <h2 className="landing-section-title">Готовы вести день проще?</h2>
        <p className="landing-section-text">Бесплатно. Вход через Google, VK, Telegram или email.</p>
        <div className="landing-cta landing-cta-row">
          <Link href="/login" className="btn btn-primary landing-cta-primary">
            Войти и начать
          </Link>
          <a href="#install" className="landing-cta-secondary">
            Сначала установить
          </a>
        </div>
      </section>
    </div>
  );
}

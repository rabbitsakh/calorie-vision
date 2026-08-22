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
            <stop offset="0.4" stopColor="#5eead4" />
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

/** Stylized phone diary — product context, not a screenshot collage. */
function AppPreview() {
  return (
    <div className="landing-phone" aria-hidden>
      <div className="landing-phone-bezel">
        <div className="landing-phone-notch" />
        <div className="landing-phone-screen">
          <p className="landing-phone-brand">Calorie Vision</p>
          <p className="landing-phone-date">Сегодня</p>
          <div className="landing-phone-ring">
            <span className="landing-phone-ring-value">79%</span>
            <span className="landing-phone-ring-label">1 420 / 1 800</span>
          </div>
          <div className="landing-phone-bars" aria-hidden>
            <div className="landing-phone-bar">
              <span>Белок</span>
              <span className="landing-phone-bar-track"><span style={{ width: "72%" }} /></span>
            </div>
            <div className="landing-phone-bar">
              <span>Вода</span>
              <span className="landing-phone-bar-track landing-phone-bar-water"><span style={{ width: "45%" }} /></span>
            </div>
          </div>
          <div className="landing-phone-meals">
            <div className="landing-phone-meal">
              <span>Овсянка с ягодами</span>
              <span>320</span>
            </div>
            <div className="landing-phone-meal">
              <span>Куриный салат</span>
              <span>480</span>
            </div>
            <div className="landing-phone-meal landing-phone-meal-soft">
              <span>Добавить по фото…</span>
              <span>+</span>
            </div>
          </div>
        </div>
      </div>
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
      <div className="landing-noise" aria-hidden />

      <header className="landing-top">
        <Link href="/" className="landing-top-brand" aria-label="Calorie Vision — на главную">
          <BrandMark size={36} decorative={false} />
          <span>Calorie Vision</span>
        </Link>
        <nav className="landing-top-nav" aria-label="Разделы">
          <a href="#how" className="landing-top-link">
            Как работает
          </a>
          <a href="#features" className="landing-top-link">
            Возможности
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
            Сфотографируйте блюдо: распознаем порцию, КБЖУ и сохраним день в дневнике — спокойно, без
            ручного поиска в справочниках.
          </p>
          <div className="landing-cta">
            <Link href="/login" className="btn btn-primary landing-cta-primary">
              Начать бесплатно
            </Link>
            <a href="#how" className="landing-cta-secondary">
              Смотреть, как устроено
            </a>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section id="how" className="landing-section landing-split landing-fade-up-delay">
        <div className="landing-split-copy">
          <p className="landing-kicker">Как это работает</p>
          <h2 className="landing-section-title">От кадра до записи за минуту</h2>
          <ol className="landing-steps">
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                01
              </span>
              <div>
                <h3 className="landing-step-title">Снимок, название или штрихкод</h3>
                <p className="landing-section-text">
                  Камера или галерея — блюдо на тарелке, этикетка с КБЖУ или штрихкод упаковки. Можно
                  просто ввести название.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                02
              </span>
              <div>
                <h3 className="landing-step-title">Проверьте порцию до сохранения</h3>
                <p className="landing-section-text">
                  Подправьте граммы или название — калории, белки, жиры и углеводы пересчитаются сразу.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                03
              </span>
              <div>
                <h3 className="landing-step-title">День собирается в рационе</h3>
                <p className="landing-section-text">
                  Завтрак, обед, ужин или перекус — с прогрессом по норме и мягкой поддержкой серии.
                </p>
              </div>
            </li>
          </ol>
        </div>
        <AppPreview />
      </section>

      <section id="features" className="landing-section landing-section-alt">
        <p className="landing-kicker">Возможности</p>
        <h2 className="landing-section-title">Всё нужное для дневника — без шума</h2>
        <p className="landing-section-text landing-section-text-wide">
          Calorie Vision рассчитан на ежедневное использование: быстро добавить еду, увидеть день и не
          потерять привычку.
        </p>
        <div className="landing-feature-grid">
          <div className="landing-feature">
            <h3 className="landing-feature-title">Распознавание</h3>
            <p className="landing-section-text">
              Фото, поиск по названию, штрихкод. Несколько блюд с одного кадра — каждое можно поправить
              отдельно.
            </p>
          </div>
          <div className="landing-feature">
            <h3 className="landing-feature-title">Макросы дня</h3>
            <p className="landing-section-text">
              Калории, БЖУ, клетчатка и сахар относительно вашей нормы. Прогресс видно сразу в рационе.
            </p>
          </div>
          <div className="landing-feature">
            <h3 className="landing-feature-title">Вес и цель</h3>
            <p className="landing-section-text">
              Календарь веса, цель и темп — без давления, чтобы видеть динамику, а не только один день.
            </p>
          </div>
          <div className="landing-feature">
            <h3 className="landing-feature-title">Серия и напоминания</h3>
            <p className="landing-section-text">
              Мягкие отметки серии и push-напоминания. На iPhone — только если открыли с экрана «Домой».
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <p className="landing-kicker">Для кого</p>
        <h2 className="landing-section-title">Если хочется учитывать еду без таблицы Excel</h2>
        <ul className="landing-audience">
          <li>
            <strong>Следите за калориями</strong> — но не хотите каждый раз искать блюдо вручную.
          </li>
          <li>
            <strong>Готовите дома или едите вне</strong> — фото тарелки часто быстрее, чем взвешивание
            всего подряд.
          </li>
          <li>
            <strong>Нужна привычка, а не отчёт</strong> — серия и напоминания поддерживают, не стыдят.
          </li>
        </ul>
      </section>

      <section id="install" className="landing-section landing-install">
        <p className="landing-kicker">На телефон</p>
        <h2 className="landing-section-title">Установите как приложение</h2>
        <p className="landing-section-text landing-section-text-wide">
          Это PWA: откройте{" "}
          <strong className="landing-inline-strong">calorievision.ru</strong> в браузере и добавьте на
          экран «Домой». Появится иконка и полноэкранный режим — как у обычного приложения из магазина.
        </p>

        <div className="landing-install-grid">
          <article className="landing-install-col">
            <h3 className="landing-install-heading">
              <ShareIcon />
              iPhone · Safari
            </h3>
            <ol className="landing-install-steps">
              <li>Откройте сайт в Safari (не Chrome).</li>
              <li>
                Нажмите «Поделиться» <ShareIcon /> внизу.
              </li>
              <li>«На экран „Домой“» → «Добавить».</li>
              <li>Запускайте с иконки — так работают уведомления (iOS 16.4+).</li>
            </ol>
          </article>

          <article className="landing-install-col">
            <h3 className="landing-install-heading">
              <MenuIcon />
              Android · Chrome
            </h3>
            <ol className="landing-install-steps">
              <li>Откройте сайт в Chrome.</li>
              <li>
                Меню <MenuIcon /> → «Установить приложение» или «На главный экран».
              </li>
              <li>Подтвердите установку.</li>
              <li>Открывайте с иконки — удобнее дневник и напоминания.</li>
            </ol>
          </article>
        </div>
      </section>

      <section className="landing-section landing-section-alt landing-faq">
        <p className="landing-kicker">Коротко</p>
        <h2 className="landing-section-title">Частые вопросы</h2>
        <dl className="landing-faq-list">
          <div className="landing-faq-item">
            <dt>Это бесплатно?</dt>
            <dd>Да. Вход через Google, VK, Telegram или email — без подписки в базовом сценарии.</dd>
          </div>
          <div className="landing-faq-item">
            <dt>Нужно ли скачивать из App Store / Google Play?</dt>
            <dd>
              Нет. Достаточно добавить сайт на экран «Домой» — получите иконку и почти нативное
              ощущение.
            </dd>
          </div>
          <div className="landing-faq-item">
            <dt>Насколько точны калории по фото?</dt>
            <dd>
              Это оценка: вы всегда подтверждаете порцию и можете поправить название или граммы до
              сохранения.
            </dd>
          </div>
          <div className="landing-faq-item">
            <dt>Где хранятся данные?</dt>
            <dd>Дневник привязан к вашему аккаунту на сервере Calorie Vision — доступен после входа.</dd>
          </div>
        </dl>
      </section>

      <section className="landing-footer-cta">
        <p className="landing-brand landing-brand-sm">Calorie Vision</p>
        <h2 className="landing-section-title">Готовы вести день проще?</h2>
        <p className="landing-section-text">
          Создайте аккаунт за минуту — и добавьте первый приём пищи по фото.
        </p>
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

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

/** Product diary — the hero visual anchor. */
function AppPreview({ className = "" }: { className?: string }) {
  return (
    <div className={`landing-phone ${className}`.trim()} aria-hidden>
      <div className="landing-phone-bezel">
        <div className="landing-phone-notch" />
        <div className="landing-phone-screen">
          <p className="landing-phone-brand">Calorie Vision</p>
          <p className="landing-phone-date">Сегодня · вторник</p>
          <div className="landing-phone-ring-wrap">
            <svg className="landing-phone-ring-svg" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" className="landing-phone-ring-track" />
              <circle cx="60" cy="60" r="50" className="landing-phone-ring-progress" />
            </svg>
            <div className="landing-phone-ring-copy">
              <span className="landing-phone-ring-value">1 420</span>
              <span className="landing-phone-ring-label">из 1 800 ккал</span>
            </div>
          </div>
          <div className="landing-phone-macros">
            <span>
              Б <b>92</b>
            </span>
            <span>
              Ж <b>48</b>
            </span>
            <span>
              У <b>142</b>
            </span>
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
              <span>Добавить по фото</span>
              <span>+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Soft food atmosphere behind the product — not the main idea. */
function HeroAtmosphere() {
  return (
    <div className="landing-hero-atmosphere" aria-hidden>
      <svg className="landing-hero-plate" viewBox="0 0 900 700" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lpPlate" x1="180" y1="120" x2="720" y2="560" gradientUnits="userSpaceOnUse">
            <stop stopColor="#dff7ef" />
            <stop offset="0.55" stopColor="#5ec4b0" />
            <stop offset="1" stopColor="#0b5f57" />
          </linearGradient>
          <linearGradient id="lpFood" x1="320" y1="220" x2="560" y2="420" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffe8c7" />
            <stop offset="1" stopColor="#e8a35c" />
          </linearGradient>
        </defs>
        <ellipse cx="450" cy="560" rx="310" ry="48" fill="#0b5f57" opacity="0.16" />
        <ellipse cx="450" cy="340" rx="250" ry="180" fill="url(#lpPlate)" />
        <ellipse cx="450" cy="340" rx="198" ry="140" fill="#f7fffc" opacity="0.42" />
        <ellipse cx="420" cy="318" rx="108" ry="82" fill="url(#lpFood)" opacity="0.95" />
        <ellipse cx="500" cy="352" rx="78" ry="58" fill="#6ecf7a" opacity="0.82" />
        <ellipse cx="388" cy="366" rx="56" ry="40" fill="#ef8b4a" opacity="0.9" />
        <ellipse cx="470" cy="278" rx="42" ry="32" fill="#e86b6b" opacity="0.78" />
        <g stroke="#4BE0BC" strokeWidth="5" strokeLinecap="square" fill="none" opacity="0.9">
          <path d="M250 170V118h52" />
          <path d="M650 170V118h-52" />
          <path d="M250 510v52h52" />
          <path d="M650 510v52h-52" />
        </g>
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
      <div className="landing-noise" aria-hidden />

      <header className="landing-top">
        <Link href="/" className="landing-top-brand" aria-label="Calorie Vision — на главную">
          <BrandMark size={34} decorative={false} />
          <span>Calorie Vision</span>
        </Link>
        <nav className="landing-top-nav" aria-label="Разделы">
          <a href="#how" className="landing-top-link">
            Как работает
          </a>
          <a href="#why" className="landing-top-link">
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
        <div className="landing-hero-stage" aria-hidden>
          <HeroAtmosphere />
          <AppPreview className="landing-phone-hero" />
        </div>
        <div className="landing-hero-copy landing-reveal">
          <p className="landing-brand">Calorie Vision</p>
          <h1 className="landing-headline">Снимок тарелки — и день уже в рационе</h1>
          <p className="landing-lead">
            Распознаём блюдо и порцию, вы подтверждаете калории. Без справочников и долгого ввода.
          </p>
          <div className="landing-cta">
            <Link href="/login" className="btn btn-primary landing-cta-primary">
              Начать бесплатно
            </Link>
            <a href="#how" className="landing-cta-secondary">
              Как это устроено
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="landing-section landing-reveal-late">
        <p className="landing-kicker">Три шага</p>
        <h2 className="landing-section-title">От кадра до записи за минуту</h2>
        <p className="landing-section-text">
          Открыли камеру, проверили порцию, сохранили — рацион дня обновляется сразу.
        </p>
        <ol className="landing-steps">
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden>
              01
            </span>
            <div>
              <h3 className="landing-step-title">Фото, название или штрихкод</h3>
              <p className="landing-section-text">
                Тарелка из кафе, этикетка с КБЖУ или упаковка из магазина. Можно просто написать, что
                едите.
              </p>
            </div>
          </li>
          <li className="landing-step">
            <span className="landing-step-num" aria-hidden>
              02
            </span>
            <div>
              <h3 className="landing-step-title">Подтвердите порцию</h3>
              <p className="landing-section-text">
                Подправьте граммы или название — калории, белки, жиры и углеводы пересчитаются до
                сохранения.
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
                Завтрак, обед, ужин и перекусы — с прогрессом по норме и мягкой поддержкой серии.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section id="why" className="landing-section landing-section-band">
        <p className="landing-kicker">Зачем это</p>
        <h2 className="landing-section-title">Дневник, который не тормозит приём пищи</h2>
        <p className="landing-section-text landing-section-text-wide">
          Calorie Vision рассчитан на каждый день: быстро добавить еду, увидеть норму и не потерять
          привычку.
        </p>
        <ul className="landing-points">
          <li className="landing-point">
            <h3 className="landing-point-title">Фото вместо таблицы</h3>
            <p className="landing-section-text">
              Несколько блюд с одного кадра, штрихкод упаковки или поиск по названию — каждое можно
              поправить отдельно.
            </p>
          </li>
          <li className="landing-point">
            <h3 className="landing-point-title">Норма дня на виду</h3>
            <p className="landing-section-text">
              Калории, БЖУ, клетчатка и сахар относительно вашей цели. Прогресс виден сразу в рационе.
            </p>
          </li>
          <li className="landing-point">
            <h3 className="landing-point-title">Вес и цель рядом</h3>
            <p className="landing-section-text">
              Календарь веса и темп — чтобы видеть динамику недели, а не только один удачный день.
            </p>
          </li>
          <li className="landing-point">
            <h3 className="landing-point-title">Серия без давления</h3>
            <p className="landing-section-text">
              Мягкие отметки серии и напоминания. На iPhone push работают, если открыли с экрана
              «Домой».
            </p>
          </li>
        </ul>
      </section>

      <section id="install" className="landing-section">
        <p className="landing-kicker">На телефон</p>
        <h2 className="landing-section-title">Поставьте на экран «Домой»</h2>
        <p className="landing-section-text landing-section-text-wide">
          Это PWA: откройте{" "}
          <strong className="landing-inline-strong">calorievision.ru</strong> в браузере и добавьте на
          главный экран. Появится иконка и полноэкранный режим — как у приложения из магазина, без
          App Store и Google Play.
        </p>

        <div className="landing-install-grid">
          <div className="landing-install-col">
            <h3 className="landing-install-heading">
              <ShareIcon />
              iPhone · Safari
            </h3>
            <ol className="landing-install-steps">
              <li>Откройте сайт в Safari.</li>
              <li>
                Нажмите «Поделиться» <ShareIcon /> внизу экрана.
              </li>
              <li>«На экран „Домой“» → «Добавить».</li>
              <li>Запускайте с иконки — так работают уведомления (iOS 16.4+).</li>
            </ol>
          </div>

          <div className="landing-install-col">
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
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-band landing-faq">
        <p className="landing-kicker">Коротко</p>
        <h2 className="landing-section-title">Частые вопросы</h2>
        <dl className="landing-faq-list">
          <div className="landing-faq-item">
            <dt>Это бесплатно?</dt>
            <dd>Да. Вход через Google, VK, Telegram или email — без подписки для обычного дневника.</dd>
          </div>
          <div className="landing-faq-item">
            <dt>Нужно ли скачивать из магазина приложений?</dt>
            <dd>Нет. Добавьте сайт на экран «Домой» — получите иконку и почти нативное ощущение.</dd>
          </div>
          <div className="landing-faq-item">
            <dt>Насколько точны калории по фото?</dt>
            <dd>
              Это оценка: перед сохранением вы всегда видите порцию и можете поправить название или
              граммы.
            </dd>
          </div>
          <div className="landing-faq-item">
            <dt>Где хранятся данные?</dt>
            <dd>Дневник привязан к вашему аккаунту на сервере Calorie Vision и доступен после входа.</dd>
          </div>
        </dl>
      </section>

      <section className="landing-footer-cta">
        <p className="landing-brand landing-brand-sm">Calorie Vision</p>
        <h2 className="landing-section-title">Первый приём пищи — по фото</h2>
        <p className="landing-section-text">
          Создайте аккаунт за минуту и сохраните сегодняшний день без ручного поиска в справочниках.
        </p>
        <div className="landing-cta landing-cta-row">
          <Link href="/login" className="btn btn-primary landing-cta-primary">
            Войти и начать
          </Link>
          <a href="#install" className="landing-cta-secondary">
            Сначала на телефон
          </a>
        </div>
      </section>
    </div>
  );
}

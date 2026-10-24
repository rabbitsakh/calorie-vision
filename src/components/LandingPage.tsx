import Link from "next/link";
import { LandingFeatureGrid } from "@/components/LandingFeatureGrid";
import { LandingFooterCta } from "@/components/LandingFooterCta";
import { LandingRecognitionShowcase } from "@/components/LandingRecognitionShowcase";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import { LandingShell } from "@/components/LandingShell";
import { LandingStatsStrip } from "@/components/LandingStatsStrip";
import { LandingTopNav } from "@/components/LandingTopNav";
import { LandingTrustBand } from "@/components/LandingTrustBand";
import {
  getApkDownloadUrl,
  getRustoreBadgeUrl,
  getRustoreUrl,
  RUSTORE_BADGE_SRC,
} from "@/lib/android-install";
import { withBasePath } from "@/lib/paths";

/** Product diary mockup in the hero. */
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
            <span>
              Кл <b>18</b>
            </span>
          </div>
          <div className="landing-phone-water">
            <span>Вода</span>
            <span>1 200 / 2 000 мл</span>
          </div>
          <div className="landing-phone-meals">
            <div className="landing-phone-meal">
              <span>Овсянка с ягодами</span>
              <span>320</span>
            </div>
            <div className="landing-phone-meal">
              <span>Куриный салат · 86%</span>
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

/** Plate illustration — dominant full-bleed hero visual. */
function HeroAtmosphere() {
  return (
    <div className="landing-hero-atmosphere" aria-hidden>
      <div className="landing-hero-mesh" />
      <svg className="landing-hero-plate" viewBox="0 0 900 700" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lpPlate" x1="180" y1="120" x2="720" y2="560" gradientUnits="userSpaceOnUse">
            <stop stopColor="#dff7ef" />
            <stop offset="0.55" stopColor="var(--landing-accent, #0d7377)" />
            <stop offset="1" stopColor="var(--landing-deep, #0f5c5e)" />
          </linearGradient>
          <linearGradient id="lpFood" x1="320" y1="220" x2="560" y2="420" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffe8c7" />
            <stop offset="1" stopColor="#e8a35c" />
          </linearGradient>
          <linearGradient id="lpLeaf" x1="460" y1="250" x2="560" y2="380" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9be3a0" />
            <stop offset="1" stopColor="#3f9e5a" />
          </linearGradient>
          <filter id="lpSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <ellipse cx="450" cy="560" rx="310" ry="48" fill="var(--landing-deep, #0f5c5e)" opacity="0.16" />
        <ellipse cx="450" cy="340" rx="250" ry="180" fill="url(#lpPlate)" />
        <ellipse cx="450" cy="340" rx="198" ry="140" fill="#f7fffc" opacity="0.42" />
        <ellipse cx="420" cy="318" rx="108" ry="82" fill="url(#lpFood)" opacity="0.95" />
        <ellipse cx="500" cy="352" rx="78" ry="58" fill="url(#lpLeaf)" opacity="0.88" />
        <ellipse cx="388" cy="366" rx="56" ry="40" fill="#ef8b4a" opacity="0.9" />
        <ellipse cx="470" cy="278" rx="42" ry="32" fill="#e86b6b" opacity="0.78" />
        <ellipse cx="360" cy="300" rx="28" ry="22" fill="#f4d35e" opacity="0.75" />
        <ellipse cx="540" cy="310" rx="22" ry="18" fill="#7ec8e3" opacity="0.7" />
        <g className="landing-hero-scan" stroke="#4BE0BC" strokeWidth="5" strokeLinecap="square" fill="none">
          <path d="M250 170V118h52" />
          <path d="M650 170V118h-52" />
          <path d="M250 510v52h52" />
          <path d="M650 510v52h-52" />
        </g>
        <rect
          className="landing-hero-scanline"
          x="280"
          y="220"
          width="340"
          height="3"
          rx="1.5"
          fill="#4BE0BC"
          opacity="0.55"
          filter="url(#lpSoft)"
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

function DownloadIcon() {
  return (
    <svg className="landing-install-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10M8.5 10.5 12 14l3.5-3.5M5 17.5v1.2A1.3 1.3 0 0 0 6.3 20h11.4a1.3 1.3 0 0 0 1.3-1.3v-1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Official RuStore store badge (hosted locally). */
function RustoreBadgeLink({ className = "" }: { className?: string }) {
  const href = getRustoreBadgeUrl();
  if (!href) return null;
  return (
    <a
      href={href}
      className={`landing-rustore-badge ${className}`.trim()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Скачать из RuStore"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBasePath(RUSTORE_BADGE_SRC)}
        alt="Скачать из RuStore"
        width={188}
        height={68}
        decoding="async"
      />
    </a>
  );
}

/** Android: RuStore first, APK fallback — only under #install. */
function AndroidApkCta() {
  const apkUrl = getApkDownloadUrl();
  const rustoreUrl = getRustoreUrl();

  return (
    <div className="landing-apk">
      <div className="landing-apk-copy">
        <h3 className="landing-install-heading">
          <DownloadIcon />
          Android · RuStore
        </h3>
        <p className="landing-apk-text">
          Сначала официальный магазин — обновления сами. Нет RuStore — APK. Тот же дневник: иконка,
          напоминания и камера.
        </p>
      </div>
      <div className="landing-apk-actions">
        {rustoreUrl ? <RustoreBadgeLink /> : null}
        <a href={apkUrl} className="landing-cta-secondary" download>
          Скачать APK напрямую
        </a>
        {!rustoreUrl ? (
          <a href="/install" className="landing-cta-secondary">
            Подробнее про установку
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function LandingPage() {
  const rustoreUrl = getRustoreUrl();

  return (
    <LandingShell className="landing">
      <div className="landing-noise" aria-hidden />
      <div className="landing-orb landing-orb-a" aria-hidden />
      <div className="landing-orb landing-orb-b" aria-hidden />

      <LandingTopNav />

      <section className="landing-hero">
        <div className="landing-hero-stage" aria-hidden>
          <div className="landing-hero-parallax-plate">
            <HeroAtmosphere />
          </div>
          <div className="landing-phone-hero">
            <div className="landing-hero-parallax-phone">
              <AppPreview />
            </div>
          </div>
        </div>
        <div className="landing-hero-copy landing-reveal">
          <p className="landing-brand">Calorie Vision</p>
          <h1 className="landing-headline">Сфотографировали — калории уже в дневнике</h1>
          <p className="landing-lead">
            Тарелка или этикетка — порция и КБЖУ в записи. Штрихкод, текст и зал в одном приложении.
            Сейчас бесплатно.
          </p>
          <div className="landing-cta">
            <Link href="/login" className="btn btn-primary landing-cta-primary landing-cta-sheen">
              Начать бесплатно
            </Link>
            {!rustoreUrl ? (
              <a href="#install" className="btn btn-secondary landing-cta-primary">
                Скачать APK
              </a>
            ) : (
              <a href="#install" className="landing-cta-secondary">
                Установить на телефон
              </a>
            )}
          </div>
        </div>
      </section>

      {/* D23 rhythm: proof → how → showcase → trust → inside → install → FAQ */}
      <LandingScrollReveal>
        <LandingStatsStrip />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="how" className="landing-section">
          <div className="landing-section-head">
            <p className="landing-kicker">Как это работает</p>
            <h2 className="landing-section-title">Три шага от фото до записи</h2>
            <p className="landing-section-text">
              Без поиска продукта в справочнике — камера, штрихкод или короткое название.
            </p>
          </div>
          <ol className="landing-steps landing-stagger">
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                01
              </span>
              <div>
                <h3 className="landing-step-title">Снимите или опишите еду</h3>
                <p className="landing-section-text">
                  Тарелка, упаковка, этикетка или штрихкод. Можно написать «гречка с курицей». Нет
                  сети — фото уйдёт в офлайн-очередь.
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
                  Подправьте граммы или название — КБЖУ пересчитаются. Низкая уверенность —
                  уточните по названию.
                </p>
              </div>
            </li>
            <li className="landing-step">
              <span className="landing-step-num" aria-hidden>
                03
              </span>
              <div>
                <h3 className="landing-step-title">Следите за днём</h3>
                <p className="landing-section-text">
                  Приёмы пищи в рационе: остаток до нормы, вода, серия и план недели.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <LandingRecognitionShowcase />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <LandingTrustBand />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="inside" className="landing-section landing-section-band">
          <div className="landing-section-head">
            <p className="landing-kicker">Что внутри</p>
            <h2 className="landing-section-title">Ежедневный учёт — в одном месте</h2>
            <p className="landing-section-text landing-section-text-wide">
              Еда, вода и зал без второй подписки — даже если сеть пропала на минуту.
            </p>
          </div>
          <LandingFeatureGrid />
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="install" className="landing-section landing-section-band landing-parallax-band">
          <div className="landing-section-head">
            <p className="landing-kicker">На телефон</p>
            <h2 className="landing-section-title">Один путь установки</h2>
            <p className="landing-section-text landing-section-text-wide">
              Android — RuStore (или APK). iPhone — Safari → на экран «Домой». Уведомления на iOS
              работают только с иконки (16.4+).
            </p>
          </div>

          <AndroidApkCta />

          <div className="landing-install-grid landing-stagger">
            <div className="landing-install-col">
              <h3 className="landing-install-heading">
                <ShareIcon />
                iPhone · Safari
              </h3>
              <ol className="landing-install-steps">
                <li>Откройте calorievision.ru в Safari.</li>
                <li>
                  «Поделиться» <ShareIcon /> → «На экран „Домой“».
                </li>
                <li>Запускайте с иконки — так работают напоминания.</li>
              </ol>
            </div>

            <div className="landing-install-col">
              <h3 className="landing-install-heading">
                <MenuIcon />
                Android · Chrome (PWA)
              </h3>
              <ol className="landing-install-steps">
                <li>Если не ставите из RuStore — откройте сайт в Chrome.</li>
                <li>
                  Меню <MenuIcon /> → «Установить приложение».
                </li>
                <li>Открывайте с иконки.</li>
              </ol>
            </div>
          </div>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="faq" className="landing-section landing-faq">
          <div className="landing-section-head">
            <p className="landing-kicker">Вопросы</p>
            <h2 className="landing-section-title">Частые вопросы</h2>
          </div>
          <dl className="landing-faq-list landing-stagger">
            <div className="landing-faq-item">
              <dt>Это правда бесплатно?</dt>
              <dd>
                Да. Сейчас весь дневник — без подписки. Сообщим заранее, если появятся платные
                возможности; базовый учёт останется доступным.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Как установить на телефон?</dt>
              <dd>
                Один блок выше —{" "}
                <a href="#install">установка</a>: RuStore / APK на Android и Safari «На экран Домой»
                на iPhone.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Насколько точны калории по фото?</dt>
              <dd>
                Умная оценка, не лаборатория. Перед сохранением видны порция и уверенность — можно
                поправить; приложение запомнит правки.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Что если нет интернета?</dt>
              <dd>
                Фото и сохранения остаются в офлайн-очереди. Когда сеть появится — распознаем и
                отправим.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Можно ли без фото?</dt>
              <dd>
                Да — название, избранное или штрихкод. Фото просто быстрее дома и в кафе.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Где хранятся данные?</dt>
              <dd>
                Дневник привязан к аккаунту на сервере Calorie Vision. Подробнее — в{" "}
                <Link href="/privacy">Политике конфиденциальности</Link>.
              </dd>
            </div>
          </dl>
        </section>
      </LandingScrollReveal>

      <LandingFooterCta />

      <footer className="landing-legal-footer">
        <p className="landing-legal-brand">Calorie Vision</p>
        <nav className="landing-legal-links" aria-label="Правовая информация">
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/terms">Условия</Link>
          <Link href="/disclaimer">Дисклеймер</Link>
        </nav>
        <p className="landing-legal-copy">
          Дневник питания по фото ·{" "}
          <a href="mailto:support@calorievision.ru">support@calorievision.ru</a>
        </p>
      </footer>
    </LandingShell>
  );
}

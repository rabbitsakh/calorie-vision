import Link from "next/link";
import { Manrope, Unbounded } from "next/font/google";
import { LandingAudience } from "@/components/LandingAudience";
import { LandingFeatureGrid } from "@/components/LandingFeatureGrid";
import { LandingFooterCta } from "@/components/LandingFooterCta";
import { LandingFreeHighlight } from "@/components/LandingFreeHighlight";
import { LandingRecognitionShowcase } from "@/components/LandingRecognitionShowcase";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import { LandingSectionMascot } from "@/components/LandingSectionMascot";
import { LandingShell } from "@/components/LandingShell";
import { LandingStatsStrip } from "@/components/LandingStatsStrip";
import { LandingTopNav } from "@/components/LandingTopNav";

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

const HERO_CHIPS = ["Фото тарелки", "Этикетка КБЖУ", "Штрихкод", "Текстом", "Вода и серия"] as const;

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
          </div>
          <div className="landing-phone-water">
            <span>💧 Вода</span>
            <span>1 200 / 2 000 мл</span>
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

/** Plate illustration — main hero visual on the first screen. */
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
    <LandingShell className={`landing ${display.variable} ${body.variable}`}>
      <div className="landing-noise" aria-hidden />

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
          <p className="landing-free-badge">Сейчас полностью бесплатно</p>
          <p className="landing-brand">Calorie Vision</p>
          <h1 className="landing-headline">
            Умный дневник питания: сфотографировали — и калории уже в дневнике
          </h1>
          <p className="landing-lead">
            Тарелка, этикетка, штрихкод или название блюда. ИИ оценивает порцию, вы проверяете и
            сохраняете за пару секунд — с водой, серией и статистикой в одном месте.
          </p>
          <ul className="landing-hero-chips" aria-label="Возможности">
            {HERO_CHIPS.map((chip) => (
              <li key={chip} className="landing-hero-chip">
                {chip}
              </li>
            ))}
          </ul>
          <div className="landing-cta">
            <Link href="/login" className="btn btn-primary landing-cta-primary">
              Начать бесплатно
            </Link>
            <a href="#how" className="landing-cta-secondary">
              Как это работает
            </a>
          </div>
          <p className="landing-hero-note">
            Без подписки на этапе запуска. Вход через Google, VK, Telegram или email. Работает в
            браузере и как PWA на телефоне.
          </p>
        </div>
      </section>

      <LandingScrollReveal>
        <LandingStatsStrip />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="how" className="landing-section landing-section-with-mascot">
          <LandingSectionMascot pose="cheer" align="right" />
          <div className="landing-section-body">
            <p className="landing-kicker">Как это работает</p>
            <h2 className="landing-section-title">Три шага от фото до записи в дневнике</h2>
            <p className="landing-section-text">
              Не нужно искать продукт в справочнике и вбивать граммы вручную — достаточно камеры или
              названия блюда.
            </p>
            <ol className="landing-steps">
              <li className="landing-step">
                <span className="landing-step-num" aria-hidden>
                  01
                </span>
                <div>
                  <h3 className="landing-step-title">Снимите или опишите еду</h3>
                  <p className="landing-section-text">
                    Тарелка в кафе, упаковка из магазина, этикетка с КБЖУ или штрихкод. Можно просто
                    написать «гречка с курицей» — подберём калорийность по названию.
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
                    Подправьте граммы или название — калории, белки, жиры и углеводы пересчитаются до
                    сохранения. Несколько блюд с одного фото можно отредактировать по отдельности.
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
                    Завтрак, обед, ужин и перекусы собираются в рационе. Видно, сколько осталось до
                    вашей нормы, как идёт вода и серия записей.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <LandingRecognitionShowcase />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="inside" className="landing-section landing-section-band landing-section-with-mascot">
          <LandingSectionMascot pose="streak" align="left" />
          <div className="landing-section-body">
            <p className="landing-kicker">Что внутри</p>
            <h2 className="landing-section-title">Всё для ежедневного учёта — в одном приложении</h2>
            <p className="landing-section-text landing-section-text-wide">
              Calorie Vision заточен под реальную жизнь: быстро добавить еду, не потерять привычку и
              понимать, куда уходит калорийный бюджет дня.
            </p>
            <LandingFeatureGrid />
            <ul className="landing-points landing-points-compact">
              <li className="landing-point">
                <h3 className="landing-point-title">Клетчатка и сахар</h3>
                <p className="landing-section-text">
                  С этикеток и базы — не только калории и БЖУ, но и дополнительные нутриенты, когда
                  они есть в данных.
                </p>
              </li>
              <li className="landing-point">
                <h3 className="landing-point-title">Работает как приложение на телефоне</h3>
                <p className="landing-section-text">
                  PWA: добавьте сайт на экран «Домой» — появится иконка и полноэкранный режим. На
                  iPhone push-уведомления работают при запуске с домашнего экрана (iOS 16.4+).
                </p>
              </li>
            </ul>
          </div>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <LandingAudience />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <LandingFreeHighlight />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="install" className="landing-section landing-section-band landing-parallax-band">
          <p className="landing-kicker">На телефон</p>
          <h2 className="landing-section-title">Установите на экран «Домой»</h2>
          <p className="landing-section-text landing-section-text-wide">
            Calorie Vision — это PWA. Откройте{" "}
            <strong className="landing-inline-strong">calorievision.ru</strong> в браузере телефона и
            добавьте на главный экран: получите иконку и полноэкранный режим, как у приложения из
            магазина — без App Store и Google Play.
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
                <li>Выберите «На экран „Домой“» → «Добавить».</li>
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
                <li>Открывайте с иконки — удобнее вести дневник и получать напоминания.</li>
              </ol>
            </div>
          </div>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="faq" className="landing-section landing-faq">
          <p className="landing-kicker">Вопросы</p>
          <h2 className="landing-section-title">Частые вопросы</h2>
          <dl className="landing-faq-list">
            <div className="landing-faq-item">
              <dt>Это правда бесплатно?</dt>
              <dd>
                Да. Сейчас весь функционал дневника — без подписки и оплаты. Мы сообщим заранее, если
                появятся платные возможности; базовый учёт останется доступным.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Нужно скачивать из App Store или Google Play?</dt>
              <dd>
                Нет. Добавьте сайт на экран «Домой» — появится иконка и почти нативное ощущение
                приложения.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Насколько точны калории по фото?</dt>
              <dd>
                Это умная оценка, а не лабораторный анализ. Перед сохранением вы всегда видите порцию
                и можете поправить название или граммы — приложение запомнит ваши исправления.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Что распознаётся кроме тарелки?</dt>
              <dd>
                Этикетки с КБЖУ, лицевые стороны упаковок, напитки, штрихкоды и готовые блюда со
                стикерами в кулинарии. Можно и просто ввести название текстом.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Есть ли учёт воды и напоминания?</dt>
              <dd>
                Да. В разделе «Рацион» — трекер воды с быстрыми кнопками. Push-напоминания о еде и
                воде можно включить в профиле (на iOS — после добавления на домашний экран).
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Где хранятся мои данные?</dt>
              <dd>
                Дневник привязан к аккаунту и хранится на сервере Calorie Vision. После входа записи
                доступны с любого устройства.
              </dd>
            </div>
            <div className="landing-faq-item">
              <dt>Можно ли вести дневник без фото?</dt>
              <dd>
                Да. Напишите название блюда или отсканируйте штрихкод — калорийность подтянется из
                базы. Фото просто быстрее, когда едите дома или в кафе.
              </dd>
            </div>
          </dl>
        </section>
      </LandingScrollReveal>

      <LandingFooterCta />
    </LandingShell>
  );
}

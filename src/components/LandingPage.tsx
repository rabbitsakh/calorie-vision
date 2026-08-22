import Link from "next/link";
import { Manrope, Unbounded } from "next/font/google";
import { BrandMark } from "@/components/BrandMark";
import { LandingHeroStage } from "@/components/LandingHeroStage";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";
import { LandingFooterCta } from "@/components/LandingFooterCta";
import { LandingFreeHighlight } from "@/components/LandingFreeHighlight";

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
          <a href="#inside" className="landing-top-link">
            Возможности
          </a>
          <a href="#free" className="landing-top-link">
            Бесплатно
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
        <LandingHeroStage />
        <div className="landing-hero-copy landing-reveal">
          <p className="landing-free-badge">Сейчас полностью бесплатно</p>
          <p className="landing-brand">Calorie Vision</p>
          <h1 className="landing-headline">Дневник питания по фото — без ручного ввода</h1>
          <p className="landing-lead">
            Сфотографируйте тарелку, этикетку или штрихкод — мы подскажем калории и БЖУ. Вы
            проверяете порцию и сохраняете за пару секунд.
          </p>
          <div className="landing-cta">
            <Link href="/login" className="btn btn-primary landing-cta-primary">
              Начать бесплатно
            </Link>
            <a href="#how" className="landing-cta-secondary">
              Как это работает
            </a>
          </div>
          <p className="landing-hero-note">
            Без подписки и скрытых платежей на этапе запуска. Вход через Google, VK, Telegram или
            email.
          </p>
        </div>
      </section>

      <LandingScrollReveal>
        <section id="how" className="landing-section">
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
                  вашей нормы, и как идёт серия записей.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="inside" className="landing-section landing-section-band">
          <p className="landing-kicker">Что внутри</p>
          <h2 className="landing-section-title">Всё для ежедневного учёта — в одном приложении</h2>
          <p className="landing-section-text landing-section-text-wide">
            Calorie Vision заточен под реальную жизнь: быстро добавить еду, не потерять привычку и
            понимать, куда уходит калорийный бюджет дня.
          </p>
          <ul className="landing-points">
            <li className="landing-point">
              <h3 className="landing-point-title">Распознавание по фото и штрихкоду</h3>
              <p className="landing-section-text">
                Несколько блюд с одного кадра, упаковки с полки, напитки и готовая еда. Если
                распознавание ошиблось — поправьте название, и мы подтянем данные из базы.
              </p>
            </li>
            <li className="landing-point">
              <h3 className="landing-point-title">Калории, БЖУ, клетчатка и сахар</h3>
              <p className="landing-section-text">
                Норма дня на кольце прогресса и в карточках приёмов пищи. Видно не только калории, но
                и баланс макронутриентов относительно вашей цели.
              </p>
            </li>
            <li className="landing-point">
              <h3 className="landing-point-title">Вес, цель и статистика</h3>
              <p className="landing-section-text">
                Календарь веса, темп снижения или набора, недельные отчёты и графики — чтобы видеть
                динамику, а не один удачный день.
              </p>
            </li>
            <li className="landing-point">
              <h3 className="landing-point-title">Мягкая мотивация без давления</h3>
              <p className="landing-section-text">
                Серия записей, напоминания и маленькие отметки прогресса. Без жёстких штрафов — только
                поддержка, когда удобно вернуться к дневнику.
              </p>
            </li>
            <li className="landing-point">
              <h3 className="landing-point-title">Работает как приложение на телефоне</h3>
              <p className="landing-section-text">
                PWA: добавьте сайт на экран «Домой» — появится иконка и полноэкранный режим. На iPhone
                push-уведомления работают при запуске с домашнего экрана (iOS 16.4+).
              </p>
            </li>
          </ul>
        </section>
      </LandingScrollReveal>

      <LandingScrollReveal>
        <LandingFreeHighlight />
      </LandingScrollReveal>

      <LandingScrollReveal>
        <section id="install" className="landing-section landing-section-band">
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
        <section className="landing-section landing-faq">
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
    </div>
  );
}

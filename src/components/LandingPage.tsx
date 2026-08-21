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
      <svg className="landing-hero-art" viewBox="0 0 720 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="plateGrad" x1="120" y1="80" x2="600" y2="460" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ecfdf8" />
            <stop offset="0.45" stopColor="#99f6e4" />
            <stop offset="1" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id="bowlGrad" x1="260" y1="160" x2="480" y2="380" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff7ed" />
            <stop offset="1" stopColor="#fdba74" />
          </linearGradient>
          <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* table atmosphere */}
        <ellipse cx="360" cy="430" rx="280" ry="48" fill="#0f766e" opacity="0.18" />
        <ellipse cx="360" cy="420" rx="220" ry="28" fill="#134e4a" opacity="0.12" />

        {/* plate */}
        <ellipse cx="360" cy="300" rx="210" ry="150" fill="url(#plateGrad)" />
        <ellipse cx="360" cy="300" rx="168" ry="118" fill="#f8fafc" opacity="0.55" />

        {/* salad bowl contents */}
        <ellipse cx="340" cy="280" rx="92" ry="70" fill="url(#bowlGrad)" opacity="0.9" />
        <ellipse cx="390" cy="310" rx="70" ry="52" fill="#4ade80" opacity="0.75" />
        <ellipse cx="310" cy="320" rx="48" ry="36" fill="#fb923c" opacity="0.85" />
        <ellipse cx="370" cy="250" rx="38" ry="28" fill="#f87171" opacity="0.7" />
        <ellipse cx="420" cy="270" rx="34" ry="24" fill="#a3e635" opacity="0.8" />

        {/* soft light bloom */}
        <circle cx="250" cy="180" r="70" fill="#ffffff" opacity="0.35" filter="url(#softBlur)" />

        {/* BrandMark-style viewfinder — product metaphor */}
        <g stroke="#4BE0BC" strokeWidth="5" strokeLinecap="square" fill="none" opacity="0.95">
          <path d="M210 150V110h40" />
          <path d="M510 150V110h-40" />
          <path d="M210 390v40h40" />
          <path d="M510 390v40h-40" />
        </g>
        <path
          d="M455 175a95 95 0 1 0 0 150"
          stroke="#027678"
          strokeWidth="18"
          strokeLinecap="butt"
          fill="none"
          opacity="0.9"
        />
      </svg>
    </div>
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
        <Link href="/login" className="landing-top-link">
          Войти
        </Link>
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
            <Link href="/login" className="landing-cta-secondary">
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section className="landing-section landing-fade-up-delay">
        <h2 className="landing-section-title">Одно фото — готовая запись</h2>
        <p className="landing-section-text">
          Камера, галерея или название: проверка порции и калорий перед сохранением в день.
        </p>
      </section>

      <section className="landing-section landing-section-alt">
        <h2 className="landing-section-title">День и серия под контролем</h2>
        <p className="landing-section-text">
          Норма калорий, белки-жиры-углеводы, клетчатка и сахар — плюс мягкие напоминания, чтобы не срывать привычку.
        </p>
      </section>

      <section className="landing-footer-cta">
        <p className="landing-brand landing-brand-sm">Calorie Vision</p>
        <h2 className="landing-section-title">Готовы вести день проще?</h2>
        <Link href="/login" className="btn btn-primary landing-cta-primary">
          Войти и начать
        </Link>
      </section>
    </div>
  );
}

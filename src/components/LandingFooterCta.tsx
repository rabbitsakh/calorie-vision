import Link from "next/link";
import { LiveMascot } from "@/components/LiveMascot";
import { LandingScrollReveal } from "@/components/LandingScrollReveal";

/** Второе место маскота на лендинге — финальный CTA перед футером. */
export function LandingFooterCta() {
  return (
    <LandingScrollReveal>
      <section className="landing-footer-cta">
        <div className="landing-footer-layout">
          <div className="landing-footer-mascot-stage">
            <div className="landing-footer-mascot-glow" aria-hidden />
            <LiveMascot
              pose="cheer"
              size="lg"
              className="landing-footer-mascot landing-mascot-float"
              title="Талисман Calorie Vision"
              idleReel={false}
              interactive
            />
          </div>
          <div className="landing-footer-copy">
            <p className="landing-brand landing-brand-sm">Calorie Vision</p>
            <h2 className="landing-section-title">Попробуйте на сегодняшнем обеде</h2>
            <p className="landing-section-text">
              Регистрация занимает минуту. Сфотографируйте тарелку — и первый приём пищи уже в дневнике,
              без поиска в справочниках.
            </p>
            <p className="landing-footer-free">Сейчас полностью бесплатно — без подписки.</p>
            <div className="landing-cta landing-cta-row">
              <Link href="/login" className="btn btn-primary landing-cta-primary landing-cta-sheen">
                Войти и начать
              </Link>
              <a href="#install" className="landing-cta-secondary">
                Сначала на телефон
              </a>
            </div>
          </div>
        </div>
      </section>
    </LandingScrollReveal>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/Mascot";

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

export function LandingHeroStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const onScroll = () => {
      const node = stageRef.current;
      if (!node) {
        return;
      }
      setScrollY(Math.max(0, -node.getBoundingClientRect().top));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  const parallax = (factor: number): React.CSSProperties | undefined =>
    reducedMotion ? undefined : { transform: `translate3d(0, ${scrollY * factor}px, 0)` };

  return (
    <div ref={stageRef} className="landing-hero-stage">
      <div className="landing-parallax-blob landing-parallax-blob-a" style={parallax(0.06)} aria-hidden />
      <div className="landing-parallax-blob landing-parallax-blob-b" style={parallax(0.1)} aria-hidden />
      <div className="landing-parallax-layer landing-parallax-layer-plate">
        <div style={parallax(0.16)}>
          <HeroAtmosphere />
        </div>
      </div>
      <div className="landing-hero-mascot">
        <div style={parallax(0.1)}>
          <Mascot pose="cheer" size="xl" title="Талисман Calorie Vision приветствует" />
        </div>
      </div>
      <div className="landing-phone-hero-wrap">
        <div style={parallax(0.07)}>
          <AppPreview className="landing-phone-hero" />
        </div>
      </div>
    </div>
  );
}

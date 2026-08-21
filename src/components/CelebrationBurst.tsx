"use client";

import { useEffect, useRef } from "react";

type CelebrationBurstProps = {
  active: boolean;
  /** Accent palette for particles. */
  colors?: string[];
  className?: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
  spin: number;
  kind: "rect" | "circle" | "ribbon";
};

const DEFAULT_COLORS = ["#5eead4", "#14b8a6", "#f59e0b", "#fbbf24", "#ffffff", "#99f6e4"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Canvas particle burst for fullscreen celebrations (Duolingo-like confetti).
 * No-ops when prefers-reduced-motion is set.
 */
export function CelebrationBurst({
  active,
  colors = DEFAULT_COLORS,
  className,
}: CelebrationBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || prefersReducedMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const originX = w / 2;
    const originY = h * 0.38;
    const count = Math.min(120, Math.round((w * h) / 9000) + 64);

    particlesRef.current = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 4 + Math.random() * 9;
      return {
        x: originX + (Math.random() - 0.5) * 40,
        y: originY + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed * (0.55 + Math.random()),
        vy: Math.sin(angle) * speed * 0.55 - (3 + Math.random() * 6),
        size: 3 + Math.random() * 6,
        color: colors[i % colors.length]!,
        life: 0,
        maxLife: 55 + Math.random() * 45,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        kind: (["rect", "circle", "ribbon"] as const)[i % 3]!,
      };
    });

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of particlesRef.current) {
        p.life += 1;
        if (p.life > p.maxLife) continue;
        alive += 1;
        p.vy += 0.18;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.kind === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "ribbon") {
          ctx.fillRect(-p.size * 0.2, -p.size * 1.2, p.size * 0.4, p.size * 2.4);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (alive > 0) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      particlesRef.current = [];
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };
  }, [active, colors]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
      aria-hidden
    />
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ProfileForm } from "@/components/ProfileForm";
import { PushRemindersSettings } from "@/components/PushRemindersSettings";
import { FastingWindowSettings } from "@/components/FastingWindowSettings";
import { GamificationQuietToggle } from "@/components/GamificationQuietToggle";
import { BadgesPanel } from "@/components/BadgesPanel";
import { RewardsPanel } from "@/components/RewardsPanel";

function ProfileSection({
  id,
  title,
  hint,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <section className="card overflow-hidden" id={id}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        <span className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {open ? <div className="min-w-0 overflow-x-hidden border-t border-slate-100 px-4 py-3 md:px-5">{children}</div> : null}
    </section>
  );
}

export default function ProfilePage() {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(typeof window !== "undefined" ? window.location.hash : "");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (hash !== "#rewards" && hash !== "#reminders" && hash !== "#nutrient-goals" && hash !== "#account") {
      return;
    }
    const id =
      hash === "#rewards"
        ? "rewards"
        : hash === "#reminders"
          ? "reminders"
          : hash === "#nutrient-goals"
            ? "nutrient-goals"
            : "account";
    // Wait a tick so accordion content (ProfileForm) is mounted when account opens.
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <AppShell title="Профиль" compact description="Аккаунт, норма, напоминания и награды.">
      <AuthGate>
        <div className="flex flex-col gap-4 md:gap-5">
          <ProfileSection
            id="account"
            title="Аккаунт и цели"
            hint="Профиль, норма, окно еды"
            defaultOpen={
              hash !== "#rewards" && hash !== "#reminders"
            }
            forceOpen={hash === "#account" || hash === "#nutrient-goals"}
          >
            <div className="flex flex-col gap-4">
              <ProfileForm />
              <FastingWindowSettings />
              <section className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <h2 className="font-display text-base font-semibold text-slate-800">Цель по весу</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Вес и цель ведутся в разделе «Вес».
                </p>
                <Link href="/weight" className="btn btn-primary mt-3 inline-flex self-start text-sm">
                  Открыть вес и цель
                </Link>
              </section>
            </div>
          </ProfileSection>

          <ProfileSection
            id="reminders"
            title="Напоминания"
            hint="Push, тихие часы, спокойный режим"
            forceOpen={hash === "#reminders"}
          >
            <div className="flex flex-col gap-4">
              <PushRemindersSettings />
              <GamificationQuietToggle />
            </div>
          </ProfileSection>

          <ProfileSection
            id="rewards"
            title="Награды"
            hint="Значки и коллекция"
            forceOpen={hash === "#rewards"}
          >
            <div className="flex flex-col gap-4">
              <BadgesPanel />
              <RewardsPanel />
            </div>
          </ProfileSection>
        </div>
      </AuthGate>
    </AppShell>
  );
}

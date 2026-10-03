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
import { useSelectedDate, withDateQuery } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";

/** D4: settings-list row — hairline group, not a stacked card accordion. */
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
    <section className="profile-settings__item" id={id}>
      <button
        type="button"
        className="profile-settings__row"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>
        <span
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? <div className="profile-settings__body">{children}</div> : null}
    </section>
  );
}

function ProfileDoor({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className="profile-settings__door">
      <span className="min-w-0">
        <span className="block font-semibold text-slate-800">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <span className="shrink-0 text-slate-400" aria-hidden>
        →
      </span>
    </Link>
  );
}

export default function ProfilePage() {
  const [hash, setHash] = useState("");
  const timezone = useTimezone();
  const { date } = useSelectedDate(timezone);

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
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [hash]);

  return (
    <AppShell title="Профиль" compact description="Цели, система и награды." date={date}>
      <AuthGate>
        {/* D4: one settings list — not nested card stacks. */}
        <div className="profile-settings">
          <ProfileSection
            id="account"
            title="Цели и аккаунт"
            hint="Норма, данные, аллергены"
            defaultOpen={hash !== "#rewards" && hash !== "#reminders"}
            forceOpen={hash === "#account" || hash === "#nutrient-goals"}
          >
            <ProfileForm />
          </ProfileSection>

          <div className="profile-settings__group" aria-label="Разделы">
            <ProfileDoor href={withDateQuery("/weight", date)} title="Вес и цель" hint="График и целевой вес" />
            <ProfileDoor href={withDateQuery("/plan", date)} title="Неделя и покупки" hint="План, челлендж, список" />
            <ProfileDoor href={withDateQuery("/workouts", date)} title="Тренировки" hint="Вкладка «Зал»" />
          </div>

          <ProfileSection
            id="reminders"
            title="Система"
            hint="Напоминания, окно еды, спокойный режим"
            forceOpen={hash === "#reminders"}
          >
            <div className="flex flex-col gap-4">
              <PushRemindersSettings />
              <FastingWindowSettings />
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

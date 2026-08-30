"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ProfileForm } from "@/components/ProfileForm";
import { PushRemindersSettings } from "@/components/PushRemindersSettings";
import { FastingWindowSettings } from "@/components/FastingWindowSettings";
import { GamificationQuietToggle } from "@/components/GamificationQuietToggle";
import { BadgesPanel } from "@/components/BadgesPanel";
import { RewardsPanel } from "@/components/RewardsPanel";

export default function ProfilePage() {
  return (
    <AppShell title="Профиль" compact description="Аккаунт, норма, напоминания и награды.">
      <AuthGate>
        <div className="flex flex-col gap-4 md:gap-5">
          <ProfileForm />
          <FastingWindowSettings />
          <PushRemindersSettings />
          <GamificationQuietToggle />
          <BadgesPanel />
          <RewardsPanel />
          <section className="card p-4 md:p-5">
            <h2 className="font-display text-base font-semibold text-slate-800">Цель по весу</h2>
            <p className="mt-1 text-sm text-slate-500">
              Вес и цель ведутся в разделе «Вес» — так проще не путать с профилем.
            </p>
            <Link href="/weight" className="btn btn-primary mt-3 inline-flex self-start text-sm">
              Открыть вес и цель
            </Link>
          </section>
        </div>
      </AuthGate>
    </AppShell>
  );
}

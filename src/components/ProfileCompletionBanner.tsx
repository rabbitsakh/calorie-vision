"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

type AccountSnippet = {
  sex: string | null;
  heightCm: number | null;
  birthYear: number | null;
};

/** Soft nudge when sex / height / birth year are missing for better calorie targets. */
export function ProfileCompletionBanner() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"));
        if (!resp.ok) return;
        const data = (await resp.json()) as AccountSnippet;
        if (cancelled) return;
        const incomplete = !data.sex || !data.heightCm || !data.birthYear;
        setMissing(incomplete);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!missing) return null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3">
      <p className="text-sm font-semibold text-sky-950">Дополните профиль</p>
      <p className="mt-0.5 text-xs text-sky-800">
        Укажите пол, рост и год рождения — нормы калорий станут точнее.
      </p>
      <Link
        href="/profile"
        className="mt-2 inline-flex text-sm font-semibold text-sky-900 underline-offset-2 hover:underline"
      >
        Открыть профиль
      </Link>
    </div>
  );
}

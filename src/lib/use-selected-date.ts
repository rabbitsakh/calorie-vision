"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateInput, isDateKey } from "@/lib/dates";

export function useSelectedDate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = formatDateInput(new Date());
  const raw = searchParams.get("date");
  const date = raw && isDateKey(raw) ? raw : today;

  function setDate(next: string, href = pathname) {
    router.push(`${href}?date=${next}`);
  }

  return { date, setDate, today };
}

export function withDateQuery(path: string, date: string): string {
  return `${path}?date=${date}`;
}

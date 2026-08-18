"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

type AccountSummary = { timezone?: string | null };

let cache: string | null | undefined = undefined;

export function useTimezone(): string | null {
  const [timezone, setTimezone] = useState<string | null>(
    cache !== undefined ? cache : null,
  );

  useEffect(() => {
    if (cache !== undefined) {
      setTimezone(cache);
      return;
    }

    fetch(withBasePath("/api/account"))
      .then((res) => (res.ok ? (res.json() as Promise<AccountSummary>) : null))
      .then((data) => {
        const tz = data?.timezone ?? null;
        cache = tz;
        setTimezone(tz);
      })
      .catch(() => {
        cache = null;
        setTimezone(null);
      });
  }, []);

  return timezone;
}

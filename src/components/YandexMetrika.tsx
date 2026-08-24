"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { setMetrikaClientId, shouldTrackMetrikaPath } from "@/lib/yandex-metrika";

type YandexMetrikaProps = {
  counterId: string;
};

/** SPA pageviews after the first load (the first hit is sent by the head snippet). */
export function YandexMetrika({ counterId }: YandexMetrikaProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = Number(counterId);
  const skipFirst = useRef(true);

  useEffect(() => {
    setMetrikaClientId(counterId);
  }, [counterId]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (!Number.isFinite(id) || !pathname || !shouldTrackMetrikaPath(pathname)) {
      return;
    }
    window.ym?.(id, "hit", window.location.href);
  }, [id, pathname, searchParams]);

  return null;
}

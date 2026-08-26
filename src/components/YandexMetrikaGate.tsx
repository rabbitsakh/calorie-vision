"use client";

import { Suspense, useEffect, useState } from "react";
import { YandexMetrika } from "@/components/YandexMetrika";
import {
  getMetrikaConsent,
  hasAcceptedMetrikaConsent,
  type MetrikaConsent,
} from "@/lib/metrika-consent";
import { buildMetrikaInitScript, setMetrikaClientId } from "@/lib/yandex-metrika";

type YandexMetrikaGateProps = {
  counterId: string;
};

/**
 * Loads Yandex Metrika tag.js only after analytics consent is accepted.
 * Declined / undecided: no script; MetrikaFunnel goals stay no-op (no window.ym).
 */
export function YandexMetrikaGate({ counterId }: YandexMetrikaGateProps) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = (next?: MetrikaConsent | null) => {
      const consent = next ?? getMetrikaConsent();
      const ok = consent === "accepted";
      setAllowed(ok);
      if (!ok) {
        setMetrikaClientId(null);
      }
    };

    sync();
    // If already accepted on first paint (SSR hydration), ensure state matches.
    if (hasAcceptedMetrikaConsent()) {
      setAllowed(true);
    }

    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<MetrikaConsent>).detail;
      sync(detail);
    };
    window.addEventListener("cv-metrika-consent", onConsent);
    return () => window.removeEventListener("cv-metrika-consent", onConsent);
  }, []);

  useEffect(() => {
    if (!allowed || !counterId) {
      return;
    }

    const existing = document.getElementById("yandex-metrika");
    if (existing) {
      setMetrikaClientId(counterId);
      return;
    }

    const script = document.createElement("script");
    script.id = "yandex-metrika";
    script.text = buildMetrikaInitScript(counterId);
    document.head.appendChild(script);
    setMetrikaClientId(counterId);
  }, [allowed, counterId]);

  if (!allowed) {
    return null;
  }

  return (
    <>
      <Suspense fallback={null}>
        <YandexMetrika counterId={counterId} />
      </Suspense>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${counterId}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}

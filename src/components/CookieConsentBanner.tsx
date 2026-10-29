"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getMetrikaConsent,
  setMetrikaConsent,
  type MetrikaConsent,
} from "@/lib/metrika-consent";
import { withBasePath } from "@/lib/paths";

/**
 * Cookie / analytics consent banner.
 * Persists choice in localStorage; Metrika loads only after "accepted".
 */
export function CookieConsentBanner() {
  const [consent, setConsent] = useState<MetrikaConsent | null | "loading">("loading");

  useEffect(() => {
    setConsent(getMetrikaConsent());
  }, []);

  const choose = useCallback((value: MetrikaConsent) => {
    setMetrikaConsent(value);
    setConsent(value);
  }, []);

  if (consent === "loading" || consent !== null) {
    return null;
  }

  return (
    <div
      className="cookie-consent cookie-consent--strip"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="cookie-consent-inner">
        <p id="cookie-consent-title" className="cookie-consent-title sr-only">
          Cookies и аналитика
        </p>
        <p id="cookie-consent-desc" className="cookie-consent-text">
          Нужные cookies для входа. Метрику — только с согласия.{" "}
          <Link href={withBasePath("/privacy")} className="cookie-consent-link">
            Политика
          </Link>
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="cookie-consent-btn cookie-consent-btn--ghost" onClick={() => choose("declined")}>
            Нет
          </button>
          <button type="button" className="cookie-consent-btn cookie-consent-btn--ok" onClick={() => choose("accepted")}>
            Ок
          </button>
        </div>
      </div>
    </div>
  );
}

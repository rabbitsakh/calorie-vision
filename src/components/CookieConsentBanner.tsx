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
      className="cookie-consent"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="cookie-consent-inner">
        <div className="cookie-consent-copy">
          <p id="cookie-consent-title" className="cookie-consent-title">
            Cookies и аналитика
          </p>
          <p id="cookie-consent-desc" className="cookie-consent-text">
            Мы используем необходимые cookies для входа. Яндекс Метрику подключаем только с вашего
            согласия — чтобы понимать, как пользоваться сайтом. Подробнее в{" "}
            <Link href={withBasePath("/privacy")} className="cookie-consent-link">
              Политике конфиденциальности
            </Link>
            .
          </p>
        </div>
        <div className="cookie-consent-actions">
          <button type="button" className="btn btn-secondary text-sm" onClick={() => choose("declined")}>
            Отклонить
          </button>
          <button type="button" className="btn btn-primary text-sm" onClick={() => choose("accepted")}>
            Принять
          </button>
        </div>
      </div>
    </div>
  );
}

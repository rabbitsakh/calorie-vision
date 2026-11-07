"use client";

import { useEffect, useState } from "react";
import { isStaleServerActionError, reloadOnceForStaleServerAction } from "@/lib/stale-server-action";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (reloadOnceForStaleServerAction(error)) return;
    if (!isStaleServerActionError(error)) console.error(error);
    setShowFallback(true);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        {showFallback ? (
          <main style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
            <p>Не удалось открыть страницу.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Обновить
            </button>
          </main>
        ) : null}
      </body>
    </html>
  );
}

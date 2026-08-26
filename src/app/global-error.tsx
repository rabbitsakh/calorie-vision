"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: "#0f172a",
          background:
            "radial-gradient(circle at top left, rgba(15, 118, 110, 0.1), transparent 34%), radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.05), transparent 40%), #f4f7fb",
        }}
      >
        <main
          style={{
            margin: "0 auto",
            display: "flex",
            minHeight: "100vh",
            width: "100%",
            maxWidth: "28rem",
            flexDirection: "column",
            justifyContent: "center",
            padding: "3rem 1rem",
            boxSizing: "border-box",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: "20px",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.07)",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#0f766e",
              }}
            >
              Calorie Vision
            </p>
            <h1
              style={{
                margin: "0.75rem 0 0",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Критическая ошибка
            </h1>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              Приложение не смогло загрузиться. Обновите страницу или зайдите позже.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: "1.5rem",
                border: "none",
                borderRadius: "999px",
                background: "#0f766e",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 600,
                minHeight: "48px",
                padding: "0.75rem 1.25rem",
              }}
            >
              Обновить
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

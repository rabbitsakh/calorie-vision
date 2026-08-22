import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { Suspense } from "react";
import { AppVersion } from "@/components/AppVersion";
import { PageFallback } from "@/components/AppShell";
import { Providers } from "@/components/Providers";
import { YandexMetrika } from "@/components/YandexMetrika";
import { buildMetrikaInitScript, resolveMetrikaId } from "@/lib/yandex-metrika";
import "./globals.css";

const body = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Calorie Vision",
  description: "Сфотографируйте еду — Calorie Vision распознает порцию и КБЖУ и сохранит день в дневнике",
  applicationName: "Calorie Vision",
  appleWebApp: {
    capable: true,
    title: "Calorie Vision",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const metrikaId = resolveMetrikaId(
    process.env.YANDEX_METRIKA_ID,
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID,
  );

  return (
    <html lang="ru" className={`${body.variable} ${display.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        {metrikaId ? (
          <script
            id="yandex-metrika"
            dangerouslySetInnerHTML={{ __html: buildMetrikaInitScript(metrikaId) }}
          />
        ) : null}
      </head>
      <body className={body.className}>
        <Providers>
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </Providers>
        {metrikaId ? (
          <>
            <Suspense fallback={null}>
              <YandexMetrika counterId={metrikaId} />
            </Suspense>
            <noscript>
              <div>
                <img
                  src={`https://mc.yandex.ru/watch/${metrikaId}`}
                  style={{ position: "absolute", left: "-9999px" }}
                  alt=""
                />
              </div>
            </noscript>
          </>
        ) : null}
        <AppVersion />
      </body>
    </html>
  );
}

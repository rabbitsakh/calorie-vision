import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppVersion } from "@/components/AppVersion";
import { PageFallback } from "@/components/AppShell";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { Providers } from "@/components/Providers";
import { YandexMetrikaGate } from "@/components/YandexMetrikaGate";
import { bodyFont, displayFont } from "@/lib/app-fonts";
import { resolveMetrikaId } from "@/lib/yandex-metrika";
import "./globals.css";

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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-120.png", type: "image/png", sizes: "120x120" },
      { url: "/favicon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Keep pinch-zoom for a11y on the web. Capacitor shell locks maximum-scale
  // at runtime (see CapacitorNativeViewport) so focus on portion/set fields
  // never auto-zooms inside the APK WebView.
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
    <html lang="ru" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <head>
        {/* Yandex / browsers: SVG + 120×120 PNG + classic favicon.ico */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-120.png" type="image/png" sizes="120x120" />
        <link rel="icon" href="/favicon.png?v=2.2.1" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=2.2.1" sizes="180x180" />
      </head>
      <body className={bodyFont.className}>
        <Providers>
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </Providers>
        {metrikaId ? <YandexMetrikaGate counterId={metrikaId} /> : null}
        <CookieConsentBanner />
        <AppVersion />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppVersion } from "@/components/AppVersion";
import { PageFallback } from "@/components/AppShell";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { Providers } from "@/components/Providers";
import { YandexMetrikaGate } from "@/components/YandexMetrikaGate";
import { bodyFont, displayFont } from "@/lib/app-fonts";
import { getSiteOrigin } from "@/lib/site-url";
import { resolveMetrikaId } from "@/lib/yandex-metrika";
import "./globals.css";

const siteOrigin = getSiteOrigin();
const siteTitle = "Calorie Vision — калории и КБЖУ по фото еды";
const siteDescription =
  "Сфотографируйте еду — Calorie Vision распознает порцию и КБЖУ, сохранит день в дневнике и поможет с залом. Веб и Android в RuStore.";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: siteTitle,
    template: "%s · Calorie Vision",
  },
  description: siteDescription,
  applicationName: "Calorie Vision",
  keywords: [
    "калории по фото",
    "счётчик калорий",
    "КБЖУ",
    "дневник питания",
    "распознавание еды",
    "Calorie Vision",
  ],
  authors: [{ name: "Calorie Vision", url: siteOrigin }],
  creator: "Calorie Vision",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteOrigin,
    siteName: "Calorie Vision",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Calorie Vision" }],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/icon-512.png"],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
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
  themeColor: "#0d7377",
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

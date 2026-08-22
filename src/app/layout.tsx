import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { Suspense } from "react";
import { AppVersion } from "@/components/AppVersion";
import { PageFallback } from "@/components/AppShell";
import { Providers } from "@/components/Providers";
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
  description: "Распознавание еды по фото и учёт калорий по дням",
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
  return (
    <html lang="ru" className={`${body.variable} ${display.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={body.className}>
        <Providers>
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </Providers>
        <AppVersion />
      </body>
    </html>
  );
}

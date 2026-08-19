import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppVersion } from "@/components/AppVersion";
import { PageFallback } from "@/components/AppShell";
import { Providers } from "@/components/Providers";
import "./globals.css";

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
    <html lang="ru">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>
        <Providers>
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </Providers>
        <AppVersion />
      </body>
    </html>
  );
}

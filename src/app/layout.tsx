import type { Metadata } from "next";
import { Suspense } from "react";
import { AppVersion } from "@/components/AppVersion";
import { PageFallback } from "@/components/AppShell";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calorie Vision",
  description: "Распознавание еды по фото и учёт калорий по дням",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </Providers>
        <AppVersion />
      </body>
    </html>
  );
}

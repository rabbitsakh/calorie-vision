import type { Metadata } from "next";
import { AppVersion } from "@/components/AppVersion";
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
        <Providers>{children}</Providers>
        <AppVersion />
      </body>
    </html>
  );
}

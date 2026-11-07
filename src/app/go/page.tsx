import type { Metadata } from "next";
import { GoLanding } from "@/components/GoLanding";
import { parseSignupAttribution } from "@/lib/signup-attribution";

const title = "Фото еды → калории и БЖУ";
const description =
  "Сфотографируйте еду — калории и БЖУ за секунды. ИИ-тренер, программы и карта мышц в том же приложении. Бесплатно.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title: "Calorie Vision — фото еды, калории и зал",
    description,
    url: "/go",
    type: "website",
    locale: "ru_RU",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Calorie Vision" }],
  },
  twitter: {
    card: "summary",
    title: "Calorie Vision — фото еды, калории и зал",
    description,
    images: ["/icon-512.png"],
  },
  alternates: { canonical: "/go" },
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GoPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  return <GoLanding initial={parseSignupAttribution(query)} />;
}

import type { Metadata } from "next";
import { FoodConfirmPreview } from "./preview";

export const metadata: Metadata = {
  title: "Проверка карточки еды",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Не в навигации. Нужна Playwright-проверке пересчёта порции на настоящей карточке. */
export default async function FoodConfirmE2EPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = params.mode;
  const mode = raw === "total" || (Array.isArray(raw) && raw[0] === "total") ? "total" : "per100";
  return <FoodConfirmPreview mode={mode} />;
}

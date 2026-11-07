import type { Metadata } from "next";
import { ListingShots } from "./ListingShots";

export const metadata: Metadata = {
  title: "Кадры карточки RuStore",
  robots: { index: false, follow: false },
};

type Props = { searchParams?: Promise<{ shot?: string }> };

/** Демо-кадры 1080×1920 для витрины. Не боевые данные пользователей. */
export default async function RustoreListingShotsPage({ searchParams }: Props) {
  const shot = (await searchParams)?.shot ?? "01";
  return <ListingShots shot={shot} />;
}

import { redirect } from "next/navigation";

type LegacyPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function CalendarRedirectPage({ searchParams }: LegacyPageProps) {
  const params = await searchParams;
  redirect(params.date ? `/ration?date=${params.date}` : "/ration");
}

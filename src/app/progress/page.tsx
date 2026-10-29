import { redirect } from "next/navigation";
import { NAV_ALIASES } from "@/lib/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") params.set(k, v);
  }
  const qs = params.toString();
  const target = NAV_ALIASES["/progress"] ?? "/stats";
  redirect(qs ? `${target}?${qs}` : target);
}

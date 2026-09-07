import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { LandingPage } from "@/components/LandingPage";
import { ReferralCapture } from "@/components/ReferralCapture";
import { authOptions } from "@/lib/auth-options";

type HomeProps = {
  searchParams?: Promise<{ ref?: string }>;
};

export default async function HomePage({ searchParams }: HomeProps) {
  const session = await getServerSession(authOptions);
  const params = searchParams ? await searchParams : {};
  const ref = typeof params.ref === "string" ? params.ref.trim() : "";

  if (session?.user?.id) {
    redirect(ref ? `/ration/?ref=${encodeURIComponent(ref)}` : "/ration/");
  }

  return (
    <>
      <ReferralCapture />
      <LandingPage />
    </>
  );
}

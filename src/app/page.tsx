import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { LandingPage } from "@/components/LandingPage";
import { authOptions } from "@/lib/auth-options";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/ration/");
  }

  return <LandingPage />;
}

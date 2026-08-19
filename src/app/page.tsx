"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageFallback } from "@/components/AppShell";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ration/");
  }, [router]);

  return <PageFallback />;
}

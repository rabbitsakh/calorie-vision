"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { MetrikaFunnel } from "@/components/MetrikaFunnel";
import { ensureCapacitorOAuthDeepLink } from "@/lib/capacitor-oauth";
import { withBasePath } from "@/lib/paths";

function CapacitorOAuthDeepLink() {
  useEffect(() => {
    void ensureCapacitorOAuthDeepLink();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={withBasePath("/api/auth")}>
      <CapacitorOAuthDeepLink />
      <MetrikaFunnel />
      {children}
    </SessionProvider>
  );
}

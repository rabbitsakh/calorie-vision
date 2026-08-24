"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { MetrikaFunnel } from "@/components/MetrikaFunnel";
import { withBasePath } from "@/lib/paths";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={withBasePath("/api/auth")}>
      <MetrikaFunnel />
      {children}
    </SessionProvider>
  );
}

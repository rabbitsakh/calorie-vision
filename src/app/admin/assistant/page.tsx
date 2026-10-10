"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminGate } from "@/components/AdminGate";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { withBasePath } from "@/lib/paths";

/** Legacy admin URL → public assistant. */
export default function AdminAssistantRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(withBasePath("/assistant"));
  }, [router]);

  return (
    <AppShell title="AI‑ассистент" description="Переход…">
      <AuthGate>
        <AdminGate>
          <p className="text-sm text-[var(--muted)]">Открываю ассистента…</p>
        </AdminGate>
      </AuthGate>
    </AppShell>
  );
}

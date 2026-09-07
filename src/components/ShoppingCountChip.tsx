"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { countUnchecked, loadList } from "@/lib/shopping-list";
import { withBasePath } from "@/lib/paths";

/** Soft unchecked shopping count for habits header. */
export function ShoppingCountChip() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function fromLocal() {
      setCount(countUnchecked(loadList({ userId })));
    }

    fromLocal();

    void (async () => {
      if (!userId) return;
      try {
        const resp = await fetch(withBasePath("/api/shopping-list"), { cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as { items?: Array<{ checked?: boolean }> };
        const items = Array.isArray(data.items) ? data.items : [];
        if (!cancelled) {
          setCount(items.filter((i) => !i.checked).length);
        }
      } catch {
        // local already set
      }
    })();

    function onStorage(event: StorageEvent) {
      if (event.key?.includes("cv-shopping-list")) fromLocal();
    }
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(fromLocal, 4000);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [userId]);

  if (count <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-teal-800">
      покупки {count}
    </span>
  );
}

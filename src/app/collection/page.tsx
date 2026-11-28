"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { CollectionBoard, exchangeCollection, type CollectionModel } from "@/components/CollectionBoard";
import { withBasePath } from "@/lib/paths";

export default function CollectionPage() {
  const [model, setModel] = useState<CollectionModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(withBasePath("/api/collection"), { cache: "no-store" })
      .then(async (resp) => {
        if (!resp.ok) {
          setError("Коллекция не открылась");
          return;
        }
        setModel((await resp.json()) as CollectionModel);
      })
      .catch(() => setError("Нет связи"));
  }, []);

  return (
    <AppShell title="Коллекция">
      <AuthGate>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-4">
          <Link href={withBasePath("/profile")} className="text-sm font-semibold text-[var(--accent-ink)]">
            В профиль
          </Link>
          {error ? <p>{error}</p> : null}
          {model ? (
            <CollectionBoard
              model={model}
              onExchange={(setKey, rewardKey) => {
                void exchangeCollection(setKey, rewardKey).then(async (resp) => {
                  if (!resp.ok) {
                    const body = (await resp.json()) as { error?: string };
                    setError(body.error ?? "Обмен не вышел");
                    return;
                  }
                  setModel((await resp.json()) as CollectionModel);
                });
              }}
            />
          ) : null}
        </div>
      </AuthGate>
    </AppShell>
  );
}

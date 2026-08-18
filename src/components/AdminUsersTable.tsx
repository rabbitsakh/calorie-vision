"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DaisyLoading } from "@/components/DaisyLoading";
import { ADMIN_PAGE_SIZE, type AdminUserRow, type AdminUsersResponse } from "@/lib/admin";
import { sexLabel } from "@/lib/diet";
import { formatPhoneDisplay } from "@/lib/phone";
import { getImageUrl, withBasePath } from "@/lib/paths";

type AdminUsersTableProps = {
  showCounts?: boolean;
};

function formatRegisteredAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function displayName(user: AdminUserRow): string {
  return user.name?.trim() || user.email || user.phone || "Без имени";
}

export function AdminUsersTable({ showCounts = false }: AdminUsersTableProps) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        withBasePath(`/api/admin/users?offset=${offsetRef.current}&limit=${ADMIN_PAGE_SIZE}`),
      );
      const data = (await response.json()) as AdminUsersResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить пользователей");
      }

      offsetRef.current += data.users.length;
      hasMoreRef.current = data.hasMore;
      setHasMore(data.hasMore);
      setTotal(data.total);
      setUsers((current) => [...current, ...data.users]);
    } catch (err) {
      hasMoreRef.current = false;
      setHasMore(false);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMore();
  }, [loadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, users.length]);

  return (
    <section className="card overflow-hidden p-4 md:p-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Пользователи</h2>
        {total !== null ? <p className="text-sm text-slate-500">{total}</p> : null}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Пол</th>
              <th>Регистрация</th>
              {showCounts ? (
                <>
                  <th>Блюда</th>
                  <th>Вес</th>
                  <th>Фото</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(user.image)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800">
                        {displayName(user).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-slate-900">{displayName(user)}</span>
                  </div>
                </td>
                <td>{user.email ?? "—"}</td>
                <td>{user.phone ? formatPhoneDisplay(user.phone) : "—"}</td>
                <td>{sexLabel(user.sex) ?? "—"}</td>
                <td>{formatRegisteredAt(user.createdAt)}</td>
                {showCounts ? (
                  <>
                    <td>{user.mealCount}</td>
                    <td>{user.weightCount}</td>
                    <td>{user.photoCount}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {loading ? <DaisyLoading /> : null}
      {hasMore ? <div ref={sentinelRef} className="h-4" /> : null}
      {!loading && !hasMore && users.length === 0 && !error ? (
        <p className="mt-3 text-sm text-slate-500">Пользователей пока нет</p>
      ) : null}
    </section>
  );
}

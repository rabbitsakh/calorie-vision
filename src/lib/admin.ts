import type { Sex } from "@/lib/diet";

export const ADMIN_EMAIL = "rabbitsakh@gmail.com";
export const ADMIN_PAGE_SIZE = 10;

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  sex: Sex | null;
  timezone: string | null;
  image: string | null;
  createdAt: string;
  mealCount: number;
  weightCount: number;
  photoCount: number;
};

export type AdminUsersResponse = {
  users: AdminUserRow[];
  total: number;
  hasMore: boolean;
};

export type AdminStatsResponse = {
  userCount: number;
  mealCount: number;
  weightCount: number;
  photoCount: number;
};

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email?.trim().toLowerCase() ?? "") === ADMIN_EMAIL;
}

export function parseAdminPageOffset(raw: string | null): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

export function parseAdminPageSize(raw: string | null): number {
  const value = Number(raw ?? ADMIN_PAGE_SIZE);
  if (!Number.isFinite(value)) {
    return ADMIN_PAGE_SIZE;
  }
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

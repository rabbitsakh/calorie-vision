import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import type { ShoppingListItem } from "@/lib/shopping-list";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isItem(value: unknown): value is ShoppingListItem {
  if (!value || typeof value !== "object") return false;
  const item = value as ShoppingListItem;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.checked === "boolean" &&
    (item.sourceDate === undefined || typeof item.sourceDate === "string")
  );
}

function normalizeItems(raw: unknown): ShoppingListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isItem).map((item) => ({
    id: item.id,
    name: item.name.trim().replace(/\s+/g, " ").slice(0, 200),
    checked: item.checked,
    ...(item.sourceDate ? { sourceDate: item.sourceDate } : {}),
  }));
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const row = await prisma.shoppingList.findUnique({
      where: { userId: session.user.id },
      select: { items: true, updatedAt: true },
    });

    const items = normalizeItems(row?.items ?? []);
    return NextResponse.json({
      items,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      synced: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить список покупок" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { items?: unknown };
    const items = normalizeItems(body.items);

    const row = await prisma.shoppingList.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        items,
      },
      update: {
        items,
      },
      select: { items: true, updatedAt: true },
    });

    return NextResponse.json({
      items: normalizeItems(row.items),
      updatedAt: row.updatedAt.toISOString(),
      synced: true,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить список покупок" }, { status: 500 });
  }
}

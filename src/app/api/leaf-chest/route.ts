import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { openLeafChest, spendYesterdaySpare, syncLeafWorld } from "@/lib/leaf-chest-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;
    const synced = await syncLeafWorld(session.user.id);
    return NextResponse.json(synced.view);
  } catch (error) {
    console.error("leaf-chest GET", error);
    return NextResponse.json({ error: "Не удалось загрузить сундук" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action === "spare") {
      const spent = await spendYesterdaySpare(session.user.id);
      if (!spent.ok) {
        return NextResponse.json({ error: spent.error }, { status: 400 });
      }
      return NextResponse.json(spent.view);
    }
    if (body.action === "open") {
      const opened = await openLeafChest(session.user.id);
      return NextResponse.json(opened);
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("leaf-chest POST", error);
    return NextResponse.json({ error: "Не удалось открыть сундук" }, { status: 500 });
  }
}

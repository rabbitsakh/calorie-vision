import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { searchMealPhotoCandidates } from "@/lib/meal-photo-search";

/** POST { query } → { candidates: [{ url, source, label? }] } */
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json().catch(() => ({}))) as { query?: string };
    const query = body.query?.trim() ?? "";
    if (query.length < 2) {
      return NextResponse.json({ error: "Введите название для поиска" }, { status: 400 });
    }

    const candidates = await searchMealPhotoCandidates(query, 10);
    return NextResponse.json({ candidates, query });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось найти фото" }, { status: 500 });
  }
}

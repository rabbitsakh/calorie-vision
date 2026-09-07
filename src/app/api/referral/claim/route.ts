import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { referralCodeForUser, referralCodesMatch } from "@/lib/referral";
import { grantChestReward } from "@/lib/reward-grant";

export const dynamic = "force-dynamic";

function referralChestSourceKey(inviteeId: string): string {
  return `referral:${inviteeId}`;
}

/**
 * Claim a pending ?ref= invite once per account.
 * Grants the referrer a soft chest (idempotent per invitee).
 */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const code = body.code?.trim() || "";
    if (!code || code.length < 6) {
      return NextResponse.json({ error: "Нужен код приглашения" }, { status: 400 });
    }

    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        referredByUserId: true,
        referralClaimedAt: true,
        referralCode: true,
      },
    });
    if (!me) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (me.referredByUserId || me.referralClaimedAt) {
      return NextResponse.json({ ok: true, alreadyClaimed: true });
    }

    const myCode = me.referralCode || referralCodeForUser(me.id);
    if (!me.referralCode) {
      await prisma.user.update({
        where: { id: me.id },
        data: { referralCode: myCode },
      });
    }
    if (referralCodesMatch(me.id, code)) {
      return NextResponse.json({ error: "Нельзя пригласить себя" }, { status: 400 });
    }

    let referrer = await prisma.user.findFirst({
      where: { referralCode: code },
      select: { id: true, referralCode: true },
    });

    // Legacy: code derived but not yet persisted on referrer row.
    if (!referrer) {
      const candidates = await prisma.user.findMany({
        where: { referralCode: null },
        select: { id: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      });
      for (const row of candidates) {
        if (referralCodesMatch(row.id, code)) {
          await prisma.user.update({
            where: { id: row.id },
            data: { referralCode: referralCodeForUser(row.id) },
          });
          referrer = { id: row.id, referralCode: referralCodeForUser(row.id) };
          break;
        }
      }
    }

    if (!referrer) {
      return NextResponse.json({ error: "Код приглашения не найден" }, { status: 404 });
    }

    if (referrer.id === me.id) {
      return NextResponse.json({ error: "Нельзя пригласить себя" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: me.id },
      data: {
        referredByUserId: referrer.id,
        referralClaimedAt: new Date(),
      },
    });

    const chest = await grantChestReward(
      referrer.id,
      "referral",
      referralChestSourceKey(me.id),
      referralChestSourceKey(me.id),
    );

    return NextResponse.json({
      ok: true,
      alreadyClaimed: false,
      bonus: "chest",
      newlyGranted: chest.newlyGranted,
    });
  } catch (error) {
    console.error("referral claim", error);
    return NextResponse.json({ error: "Не удалось применить приглашение" }, { status: 500 });
  }
}

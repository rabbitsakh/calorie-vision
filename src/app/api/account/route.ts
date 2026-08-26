import { NextRequest, NextResponse } from "next/server";
import { deleteUserAccount } from "@/lib/account-delete";
import { ACCOUNT_DELETE_CONFIRM } from "@/lib/account-delete-confirm";
import { lockedEmailDecision } from "@/lib/account-email";
import { requireSession } from "@/lib/auth-session";
import { isSex, type Sex } from "@/lib/diet";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { referralCodeForUser } from "@/lib/referral";
import { clampHour } from "@/lib/quiet-hours";
import { saveUploadedImage } from "@/lib/upload";

export const dynamic = "force-dynamic";

function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const [user, accounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          timezone: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          fastingStartHour: true,
          fastingEndHour: true,
          sex: true,
          heightCm: true,
          birthYear: true,
          fiberTargetG: true,
          sugarTargetG: true,
        },
      }),
      prisma.account.findMany({
        where: { userId: session.user.id },
        select: { provider: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const { firstName, lastName } = splitName(user.name);
    const linkedProviders = accounts.map((account) => account.provider);

    return NextResponse.json({
      firstName,
      lastName,
      email: user.email,
      phone: user.phone,
      image: user.image,
      timezone: user.timezone ?? null,
      quietHoursStart: user.quietHoursStart ?? null,
      quietHoursEnd: user.quietHoursEnd ?? null,
      fastingStartHour: user.fastingStartHour ?? null,
      fastingEndHour: user.fastingEndHour ?? null,
      sex: user.sex ?? null,
      heightCm: user.heightCm ?? null,
      birthYear: user.birthYear ?? null,
      fiberTargetG: user.fiberTargetG ?? null,
      sugarTargetG: user.sugarTargetG ?? null,
      linkedProviders,
      emailLocked: linkedProviders.includes("google") || linkedProviders.includes("vk"),
      referralCode: referralCodeForUser(user.id),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить профиль" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
      image?: string | null;
      timezone?: string | null;
      quietHoursStart?: number | null;
      quietHoursEnd?: number | null;
      fastingStartHour?: number | null;
      fastingEndHour?: number | null;
      sex?: string | null;
      heightCm?: number | null;
      birthYear?: number | null;
      fiberTargetG?: number | null;
      sugarTargetG?: number | null;
    };

    const [currentUser, accounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      }),
      prisma.account.findMany({
        where: { userId: session.user.id },
        select: { provider: true },
      }),
    ]);
    if (!currentUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const linkedProviders = accounts.map((account) => account.provider);
    const emailLocked = linkedProviders.includes("google") || linkedProviders.includes("vk");

    const data: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      phoneVerified?: Date | null;
      image?: string | null;
      timezone?: string | null;
      quietHoursStart?: number | null;
      quietHoursEnd?: number | null;
      fastingStartHour?: number | null;
      fastingEndHour?: number | null;
      sex?: Sex | null;
      heightCm?: number | null;
      birthYear?: number | null;
      fiberTargetG?: number | null;
      sugarTargetG?: number | null;
    } = {};

    if (body.firstName !== undefined || body.lastName !== undefined) {
      const firstName = body.firstName?.trim() ?? "";
      const lastName = body.lastName?.trim() ?? "";
      data.name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
    }

    if (body.image !== undefined) {
      data.image = body.image;
    }

    if (body.heightCm !== undefined) {
      data.heightCm = body.heightCm && body.heightCm > 0 ? Math.round(body.heightCm) : null;
    }

    if (body.birthYear !== undefined) {
      const currentYear = new Date().getFullYear();
      data.birthYear = body.birthYear && body.birthYear > 1900 && body.birthYear < currentYear
        ? Math.round(body.birthYear)
        : null;
    }

    if (body.fiberTargetG !== undefined) {
      const raw = body.fiberTargetG;
      if (raw == null || raw === ("" as unknown)) {
        data.fiberTargetG = null;
      } else if (!Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > 100) {
        return NextResponse.json({ error: "Клетчатка: укажите цель от 1 до 100 г" }, { status: 400 });
      } else {
        data.fiberTargetG = Math.round(Number(raw) * 10) / 10;
      }
    }

    if (body.sugarTargetG !== undefined) {
      const raw = body.sugarTargetG;
      if (raw == null || raw === ("" as unknown)) {
        data.sugarTargetG = null;
      } else if (!Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > 150) {
        return NextResponse.json({ error: "Сахар: укажите лимит от 1 до 150 г" }, { status: 400 });
      } else {
        data.sugarTargetG = Math.round(Number(raw) * 10) / 10;
      }
    }

    if (body.sex !== undefined) {
      if (body.sex === null || body.sex === "") {
        data.sex = null;
      } else if (!isSex(body.sex)) {
        return NextResponse.json({ error: "Укажите пол: женский или мужской" }, { status: 400 });
      } else {
        data.sex = body.sex;
      }
    }

    if (body.phone !== undefined) {
      const raw = body.phone?.trim() ?? "";
      if (!raw) {
        data.phone = null;
        data.phoneVerified = null;
      } else {
        const phone = normalizePhone(raw);
        if (!phone || !isValidPhone(phone)) {
          return NextResponse.json({ error: "Укажите телефон в формате +7 XXX XXX-XX-XX" }, { status: 400 });
        }

        const existing = await prisma.user.findFirst({
          where: { phone, NOT: { id: session.user.id } },
        });
        if (existing) {
          return NextResponse.json({ error: "Этот телефон уже используется" }, { status: 400 });
        }

        if (phone !== session.user.phone) {
          data.phoneVerified = null;
        }
        data.phone = phone;
      }
    }

    if (body.timezone !== undefined) {
      const tz = body.timezone?.trim() || null;
      if (tz) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
        } catch {
          return NextResponse.json({ error: "Неизвестный часовой пояс" }, { status: 400 });
        }
      }
      data.timezone = tz;
    }


    if (body.quietHoursStart !== undefined || body.quietHoursEnd !== undefined) {
      let start: number | null | undefined = body.quietHoursStart === undefined
        ? undefined
        : body.quietHoursStart === null
          ? null
          : clampHour(body.quietHoursStart);
      let end: number | null | undefined = body.quietHoursEnd === undefined
        ? undefined
        : body.quietHoursEnd === null
          ? null
          : clampHour(body.quietHoursEnd);
      if (body.quietHoursStart !== undefined && body.quietHoursStart !== null && start === null) {
        return NextResponse.json({ error: "Час начала тишины: 0–23" }, { status: 400 });
      }
      if (body.quietHoursEnd !== undefined && body.quietHoursEnd !== null && end === null) {
        return NextResponse.json({ error: "Час конца тишины: 0–23" }, { status: 400 });
      }
      // Clearing one side disables quiet hours entirely.
      if (start === null || end === null) {
        start = null;
        end = null;
      }
      if (start !== undefined) data.quietHoursStart = start;
      if (end !== undefined) data.quietHoursEnd = end;
    }

    if (body.fastingStartHour !== undefined || body.fastingEndHour !== undefined) {
      let start: number | null | undefined = body.fastingStartHour === undefined
        ? undefined
        : body.fastingStartHour === null
          ? null
          : clampHour(body.fastingStartHour);
      let end: number | null | undefined = body.fastingEndHour === undefined
        ? undefined
        : body.fastingEndHour === null
          ? null
          : clampHour(body.fastingEndHour);
      if (body.fastingStartHour !== undefined && body.fastingStartHour !== null && start === null) {
        return NextResponse.json({ error: "Час начала окна питания: 0–23" }, { status: 400 });
      }
      if (body.fastingEndHour !== undefined && body.fastingEndHour !== null && end === null) {
        return NextResponse.json({ error: "Час конца окна питания: 0–23" }, { status: 400 });
      }
      if (start === null || end === null) {
        start = null;
        end = null;
      }
      if (start !== undefined) data.fastingStartHour = start;
      if (end !== undefined) data.fastingEndHour = end;
    }

    const emailDecision = lockedEmailDecision(emailLocked, body.email, currentUser.email);
    if (emailDecision.action === "reject") {
      return NextResponse.json(
        { error: "Email нельзя изменить — вход привязан к Google или VK" },
        { status: 400 },
      );
    }

    if (emailDecision.action === "update") {
      const email = emailDecision.email;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
      }

      if (email) {
        const existing = await prisma.user.findFirst({
          where: { email, NOT: { id: session.user.id } },
        });
        if (existing) {
          return NextResponse.json({ error: "Этот email уже используется" }, { status: 400 });
        }
      }

      data.email = email;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        name: true,
        email: true,
        phone: true,
        image: true,
        timezone: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        fastingStartHour: true,
        fastingEndHour: true,
        sex: true,
        heightCm: true,
        birthYear: true,
        fiberTargetG: true,
        sugarTargetG: true,
      },
    });

    const split = splitName(user.name);
    return NextResponse.json({
      firstName: split.firstName,
      lastName: split.lastName,
      email: user.email,
      phone: user.phone,
      image: user.image,
      timezone: user.timezone ?? null,
      quietHoursStart: user.quietHoursStart ?? null,
      quietHoursEnd: user.quietHoursEnd ?? null,
      fastingStartHour: user.fastingStartHour ?? null,
      fastingEndHour: user.fastingEndHour ?? null,
      sex: user.sex ?? null,
      heightCm: user.heightCm ?? null,
      birthYear: user.birthYear ?? null,
      fiberTargetG: user.fiberTargetG ?? null,
      sugarTargetG: user.sugarTargetG ?? null,
      linkedProviders,
      emailLocked,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить профиль" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Загрузите фото" }, { status: 400 });
    }

    const imagePath = await saveUploadedImage(file, { ownerUserId: session.user.id });
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imagePath },
      select: { image: true },
    });

    return NextResponse.json({ image: user.image });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить фото" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    let confirm: string | undefined;
    try {
      const body = (await request.json()) as { confirm?: string };
      confirm = body.confirm;
    } catch {
      confirm = undefined;
    }

    if (confirm !== ACCOUNT_DELETE_CONFIRM) {
      return NextResponse.json(
        {
          error: `Для удаления аккаунта отправьте confirm: "${ACCOUNT_DELETE_CONFIRM}"`,
        },
        { status: 400 },
      );
    }

    try {
      await deleteUserAccount(session.user.id);
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось удалить аккаунт" }, { status: 500 });
  }
}

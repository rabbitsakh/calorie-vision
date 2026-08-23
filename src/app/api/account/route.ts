import { NextRequest, NextResponse } from "next/server";
import { lockedEmailDecision } from "@/lib/account-email";
import { requireSession } from "@/lib/auth-session";
import { isSex, type Sex } from "@/lib/diet";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
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
          sex: true,
          heightCm: true,
          birthYear: true,
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
      sex: user.sex ?? null,
      heightCm: user.heightCm ?? null,
      birthYear: user.birthYear ?? null,
      linkedProviders,
      emailLocked: linkedProviders.includes("google") || linkedProviders.includes("vk"),
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
      sex?: string | null;
      heightCm?: number | null;
      birthYear?: number | null;
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

    const firstName = body.firstName?.trim() ?? "";
    const lastName = body.lastName?.trim() ?? "";
    const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    const data: {
      name: string | null;
      email?: string | null;
      phone?: string | null;
      phoneVerified?: Date | null;
      image?: string | null;
      timezone?: string | null;
      sex?: Sex | null;
      heightCm?: number | null;
      birthYear?: number | null;
    } = { name };

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
      select: { name: true, email: true, phone: true, image: true, timezone: true, sex: true },
    });

    const split = splitName(user.name);
    return NextResponse.json({
      firstName: split.firstName,
      lastName: split.lastName,
      email: user.email,
      phone: user.phone,
      image: user.image,
      timezone: user.timezone ?? null,
      sex: user.sex ?? null,
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

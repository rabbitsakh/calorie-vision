import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
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
      image?: string | null;
      timezone?: string | null;
    };

    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      select: { provider: true },
    });
    const linkedProviders = accounts.map((account) => account.provider);
    const emailLocked = linkedProviders.includes("google") || linkedProviders.includes("vk");

    const firstName = body.firstName?.trim() ?? "";
    const lastName = body.lastName?.trim() ?? "";
    const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

    const data: {
      name: string | null;
      email?: string | null;
      image?: string | null;
      timezone?: string | null;
    } = { name };

    if (body.image !== undefined) {
      data.image = body.image;
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

    if (body.email !== undefined) {
      if (emailLocked) {
        return NextResponse.json(
          { error: "Email нельзя изменить — вход привязан к Google или VK" },
          { status: 400 },
        );
      }

      const email = body.email?.trim().toLowerCase() || null;
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
      select: { name: true, email: true, phone: true, image: true, timezone: true },
    });

    const split = splitName(user.name);
    return NextResponse.json({
      firstName: split.firstName,
      lastName: split.lastName,
      email: user.email,
      phone: user.phone,
      image: user.image,
      timezone: user.timezone ?? null,
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

    const imagePath = await saveUploadedImage(file);
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

import { NextRequest, NextResponse } from "next/server";
import { generateOtpCode, savePhoneOtp } from "@/lib/otp";
import { normalizePhone } from "@/lib/phone";
import { assertSmsReady, sendSmsOtp } from "@/lib/sms";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { phone?: string };
    const phone = normalizePhone(body.phone ?? "");

    if (!phone) {
      return NextResponse.json({ error: "Введите номер в формате +7..." }, { status: 400 });
    }

    assertSmsReady(phone);

    const code = generateOtpCode();
    await savePhoneOtp(phone, code);
    await sendSmsOtp(phone, code, clientIp(request));

    return NextResponse.json({
      ok: true,
      message: "Код отправлен по SMS",
      devCode: process.env.SMS_RU_API_ID ? undefined : code,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить код" },
      { status: 500 },
    );
  }
}

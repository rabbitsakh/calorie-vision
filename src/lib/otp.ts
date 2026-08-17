import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;
const PHONE_IDENTIFIER_PREFIX = "phone:";

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function phoneOtpIdentifier(phone: string): string {
  return `${PHONE_IDENTIFIER_PREFIX}${phone}`;
}

export async function savePhoneOtp(phone: string, code: string): Promise<void> {
  const identifier = phoneOtpIdentifier(phone);
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: code, expires },
  });
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<boolean> {
  const identifier = phoneOtpIdentifier(phone);
  const record = await prisma.verificationToken.findFirst({
    where: { identifier, token: code },
  });

  if (!record || record.expires < new Date()) {
    return false;
  }

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  return true;
}

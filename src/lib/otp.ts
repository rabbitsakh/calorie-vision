import { randomInt } from "crypto";
import { hashPhoneOtp, phoneOtpIdentifier } from "@/lib/otp-token";
import { prisma } from "@/lib/prisma";

const OTP_TTL_MINUTES = 10;

export { hashPhoneOtp, phoneOtpIdentifier } from "@/lib/otp-token";

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export async function savePhoneOtp(phone: string, code: string): Promise<void> {
  const identifier = phoneOtpIdentifier(phone);
  const token = hashPhoneOtp(phone, code);
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<boolean> {
  const identifier = phoneOtpIdentifier(phone);
  const token = hashPhoneOtp(phone, code);
  const record = await prisma.verificationToken.findFirst({
    where: { identifier, token },
  });

  if (!record || record.expires < new Date()) {
    return false;
  }

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  return true;
}

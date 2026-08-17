import { createHash } from "crypto";

export const PHONE_IDENTIFIER_PREFIX = "phone:";

export function phoneOtpIdentifier(phone: string): string {
  return `${PHONE_IDENTIFIER_PREFIX}${phone}`;
}

export function hashPhoneOtp(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phoneOtpIdentifier(phone)}:${code.trim()}`)
    .digest("hex");
}

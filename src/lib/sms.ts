import { isValidPhone } from "@/lib/phone";
import { getSmsRuSendError, type SmsRuSendResponse } from "@/lib/sms-response";

export type { SmsRuMessageStatus, SmsRuSendResponse } from "@/lib/sms-response";
export { getSmsRuSendError } from "@/lib/sms-response";

export async function sendSmsOtp(
  phone: string,
  code: string,
  ip?: string | null,
): Promise<void> {
  const message = `Calorie Vision: код входа ${code}. Действует 10 минут.`;

  const apiId = process.env.SMS_RU_API_ID;
  if (!apiId) {
    console.info(`[SMS dev] ${phone}: ${code}`);
    return;
  }

  const digits = phone.replace(/\D/g, "");
  const body = new URLSearchParams({
    api_id: apiId,
    to: digits,
    msg: message,
    json: "1",
  });

  if (process.env.SMS_RU_FROM) {
    body.set("from", process.env.SMS_RU_FROM);
  }

  if (ip) {
    body.set("ip", ip);
  }

  const response = await fetch("https://sms.ru/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });

  if (!response.ok) {
    throw new Error("Не удалось отправить SMS");
  }

  const payload = (await response.json()) as SmsRuSendResponse;
  const error = getSmsRuSendError(payload);
  if (error) {
    throw new Error(error);
  }
}

export function assertSmsReady(phone: string): void {
  if (!isValidPhone(phone)) {
    throw new Error("Некорректный номер телефона");
  }
}

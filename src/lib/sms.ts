import { isValidPhone } from "@/lib/phone";

export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const message = `Calorie Vision: код входа ${code}. Действует 10 минут.`;

  const apiId = process.env.SMS_RU_API_ID;
  if (!apiId) {
    console.info(`[SMS dev] ${phone}: ${code}`);
    return;
  }

  const digits = phone.replace(/\D/g, "");
  const url = new URL("https://sms.ru/sms/send");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("to", digits);
  url.searchParams.set("msg", message);
  url.searchParams.set("json", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Не удалось отправить SMS");
  }

  const payload = (await response.json()) as { status?: string; status_code?: number };
  if (payload.status !== "OK" && payload.status_code !== 100) {
    throw new Error("SMS-сервис отклонил отправку");
  }
}

export function assertSmsReady(phone: string): void {
  if (!isValidPhone(phone)) {
    throw new Error("Некорректный номер телефона");
  }
}

export type SmsRuMessageStatus = {
  status?: string;
  status_code?: number;
  status_text?: string;
};

export type SmsRuSendResponse = {
  status?: string;
  status_code?: number;
  status_text?: string;
  sms?: Record<string, SmsRuMessageStatus>;
};

export function getSmsRuSendError(payload: SmsRuSendResponse): string | null {
  if (payload.status !== "OK") {
    return payload.status_text ?? "SMS-сервис отклонил отправку";
  }

  const results = Object.values(payload.sms ?? {});
  if (results.length === 0) {
    return "SMS-сервис не вернул статус сообщения";
  }

  const failed = results.find((item) => item.status !== "OK");
  if (failed) {
    return failed.status_text ?? "SMS-сервис отклонил отправку";
  }

  return null;
}

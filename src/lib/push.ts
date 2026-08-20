import webpush from "web-push";

let configured = false;

/**
 * web-push requires subject to be a mailto: or https: URL.
 * Accepts common mistakes like bare domains or emails without mailto:.
 */
export function normalizeVapidSubject(raw: string | undefined | null): string {
  const value = raw?.trim() || "mailto:support@calorievision.ru";
  if (/^mailto:/i.test(value) || /^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.includes("@")) {
    return `mailto:${value}`;
  }
  // Bare domain: calorievision.ru → https://calorievision.ru
  return `https://${value.replace(/^\/+/, "")}`;
}

function ensureVapid(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT);

  if (!publicKey || !privateKey) {
    return null;
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return { publicKey, privateKey };
}

export function getVapidPublicKey(): string | null {
  return ensureVapid()?.publicKey ?? null;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) {
    throw new Error("VAPID keys not configured");
  }

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
    JSON.stringify(payload),
  );
}

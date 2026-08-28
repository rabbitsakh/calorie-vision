import { prisma } from "@/lib/prisma";
import { getTelegramBotToken } from "@/lib/telegram-bot";
import {
  telegramDisplayName,
  type TelegramAuthPayload,
} from "@/lib/telegram-verify";

export type { TelegramAuthPayload } from "@/lib/telegram-verify";
export {
  TELEGRAM_AUTH_MAX_AGE_SEC,
  telegramDisplayName,
  verifyTelegramAuth,
} from "@/lib/telegram-verify";

const TELEGRAM_PROVIDER = "telegram";

export function isTelegramLoginConfigured(): boolean {
  return Boolean(getTelegramBotToken());
}

export async function findOrCreateTelegramUser(data: TelegramAuthPayload) {
  const providerAccountId = String(data.id);
  const existing = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: TELEGRAM_PROVIDER,
        providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existing?.user) {
    const name = telegramDisplayName(data);
    const image = data.photo_url?.trim() || null;
    const needsUpdate =
      (name && existing.user.name !== name) ||
      (image && existing.user.image !== image);

    if (needsUpdate) {
      return prisma.user.update({
        where: { id: existing.user.id },
        data: {
          ...(name ? { name } : {}),
          ...(image ? { image } : {}),
        },
      });
    }

    return existing.user;
  }

  return prisma.user.create({
    data: {
      name: telegramDisplayName(data),
      image: data.photo_url?.trim() || null,
      accounts: {
        create: {
          type: "credentials",
          provider: TELEGRAM_PROVIDER,
          providerAccountId,
        },
      },
    },
  });
}

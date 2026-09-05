import { prisma } from "@/lib/prisma";
import { getTelegramBotToken } from "@/lib/telegram-login-config";
import { normalizeTelegramPhone } from "@/lib/telegram-phone-link";
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

export type TelegramAuthWithPhone = TelegramAuthPayload & {
  phone_number?: string | null;
};

export function isTelegramLoginConfigured(): boolean {
  return Boolean(getTelegramBotToken());
}

async function syncTelegramProfile(
  userId: string,
  data: TelegramAuthWithPhone,
  options?: { setPhone?: string | null },
) {
  const name = telegramDisplayName(data);
  const image = data.photo_url?.trim() || null;
  const phone = options?.setPhone;

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name ? { name } : {}),
      ...(image ? { image } : {}),
      ...(phone
        ? {
            phone,
            phoneVerified: new Date(),
          }
        : {}),
    },
  });
}

/**
 * If this Telegram id is already linked to an empty orphan account, but the
 * verified phone belongs to another user, move the Telegram link to that user
 * and delete the orphan so login lands on the existing phone account.
 */
async function mergeOrphanTelegramIntoPhoneUser(input: {
  telegramUserId: string;
  providerAccountId: string;
  phone: string;
  data: TelegramAuthWithPhone;
}) {
  const phoneUser = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!phoneUser || phoneUser.id === input.telegramUserId) {
    return null;
  }

  const telegramUser = await prisma.user.findUnique({
    where: { id: input.telegramUserId },
    include: {
      accounts: { select: { provider: true } },
      _count: {
        select: {
          mealEntries: true,
          weightEntries: true,
          waterEntries: true,
        },
      },
    },
  });

  if (!telegramUser) {
    return null;
  }

  const telegramOnly =
    telegramUser.accounts.length > 0 &&
    telegramUser.accounts.every((account) => account.provider === TELEGRAM_PROVIDER);
  const emptyDiary =
    telegramUser._count.mealEntries === 0 &&
    telegramUser._count.weightEntries === 0 &&
    telegramUser._count.waterEntries === 0;
  const isOrphan = !telegramUser.email && !telegramUser.phone && telegramOnly && emptyDiary;

  if (!isOrphan) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: {
        provider_providerAccountId: {
          provider: TELEGRAM_PROVIDER,
          providerAccountId: input.providerAccountId,
        },
      },
      data: { userId: phoneUser.id },
    });
    await tx.user.delete({ where: { id: telegramUser.id } });
  });

  return syncTelegramProfile(phoneUser.id, input.data);
}

export async function findOrCreateTelegramUser(data: TelegramAuthWithPhone) {
  const providerAccountId = String(data.id);
  const phone = normalizeTelegramPhone(data.phone_number ?? undefined);

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
    if (phone) {
      const merged = await mergeOrphanTelegramIntoPhoneUser({
        telegramUserId: existing.user.id,
        providerAccountId,
        phone,
        data,
      });
      if (merged) {
        return merged;
      }
    }

    const canSetPhone =
      Boolean(phone) &&
      (!existing.user.phone || existing.user.phone === phone) &&
      (existing.user.phone === phone ||
        !(await prisma.user.findUnique({
          where: { phone: phone! },
          select: { id: true },
        })));

    const name = telegramDisplayName(data);
    const image = data.photo_url?.trim() || null;
    const needsUpdate =
      (name && existing.user.name !== name) ||
      (image && existing.user.image !== image) ||
      (canSetPhone && existing.user.phone !== phone);

    if (needsUpdate) {
      return syncTelegramProfile(existing.user.id, data, {
        setPhone: canSetPhone ? phone : null,
      });
    }

    return existing.user;
  }

  if (phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone } });
    if (byPhone) {
      await prisma.account.create({
        data: {
          userId: byPhone.id,
          type: "credentials",
          provider: TELEGRAM_PROVIDER,
          providerAccountId,
        },
      });
      return syncTelegramProfile(byPhone.id, data);
    }
  }

  return prisma.user.create({
    data: {
      name: telegramDisplayName(data),
      image: data.photo_url?.trim() || null,
      ...(phone
        ? {
            phone,
            phoneVerified: new Date(),
          }
        : {}),
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

import { normalizeAuthPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type OAuthIdentityFields = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  image?: string | null;
};

/** Pull a phone from Yandex `default_phone`, VK `phone`, or a plain string on the profile. */
export function extractOAuthPhone(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const record = profile as Record<string, unknown>;

  if (typeof record.phone === "string") {
    return normalizeAuthPhone(record.phone);
  }

  const defaultPhone = record.default_phone;
  if (defaultPhone && typeof defaultPhone === "object") {
    const number = (defaultPhone as { number?: unknown }).number;
    if (typeof number === "string" || typeof number === "number") {
      return normalizeAuthPhone(String(number));
    }
  }

  const nestedUser = record.user;
  if (nestedUser && typeof nestedUser === "object") {
    const nestedPhone = (nestedUser as { phone?: unknown }).phone;
    if (typeof nestedPhone === "string") {
      return normalizeAuthPhone(nestedPhone);
    }
  }

  return null;
}

export function normalizeOAuthEmail(email: unknown): string | null {
  if (typeof email !== "string") {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Find an existing account to attach a new OAuth login to — email first, then phone.
 */
export async function findUserForOAuthLink(identity: {
  email: string | null;
  phone: string | null;
}) {
  if (identity.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
    if (byEmail) {
      return byEmail;
    }
  }

  if (identity.phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone: identity.phone } });
    if (byPhone) {
      return byPhone;
    }
  }

  return null;
}

/**
 * Soft-fill email/phone/name/image on an existing user from a verified OAuth claim.
 * Never steals an email or phone that already belongs to another account.
 */
export async function syncOAuthIdentityToUser(
  userId: string,
  identity: OAuthIdentityFields,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return;
  }

  const email = normalizeOAuthEmail(identity.email);
  const phone = normalizeAuthPhone(identity.phone);
  const data: {
    email?: string;
    emailVerified?: Date;
    phone?: string;
    phoneVerified?: Date;
    name?: string;
    image?: string;
  } = {};

  if (email && !user.email) {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!taken) {
      data.email = email;
      data.emailVerified = new Date();
    }
  }

  if (phone) {
    if (!user.phone) {
      const taken = await prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });
      if (!taken) {
        data.phone = phone;
        data.phoneVerified = new Date();
      }
    } else if (user.phone === phone && !user.phoneVerified) {
      data.phoneVerified = new Date();
    }
  }

  const name = typeof identity.name === "string" ? identity.name.trim() : "";
  if (name && !user.name) {
    data.name = name;
  }

  const image = typeof identity.image === "string" ? identity.image.trim() : "";
  if (image && !user.image) {
    data.image = image;
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await prisma.user.update({ where: { id: userId }, data });
}

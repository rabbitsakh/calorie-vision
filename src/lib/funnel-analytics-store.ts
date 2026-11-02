import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import type { FunnelEventRecord } from "@/lib/funnel-analytics";
import { prisma } from "@/lib/prisma";

const ONCE_EVENTS = new Set([
  "signup",
  "first_photo_recognized",
  "day_1_return",
  "day_7_return",
]);

function onceEventId(userHash: string, name: string): string {
  return createHash("sha256").update(`once:${userHash}:${name}`).digest("hex").slice(0, 32);
}

export async function hasFunnelEvent(userHash: string, name: string): Promise<boolean> {
  const row = await prisma.funnelEvent.findFirst({
    where: { userHash, name },
    select: { id: true },
  });
  return Boolean(row);
}

export async function loadUserCreatedAt(userId: string): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  return user?.createdAt ?? null;
}

export async function persistFunnelEvent(event: FunnelEventRecord): Promise<void> {
  const propsJson = (event.props ?? undefined) as Prisma.InputJsonValue | undefined;
  const once = Boolean(event.userHash) && ONCE_EVENTS.has(event.name);

  if (once && event.userHash) {
    const id = onceEventId(event.userHash, event.name);
    await prisma.funnelEvent.upsert({
      where: { id },
      create: {
        id,
        name: event.name,
        userHash: event.userHash,
        propsJson,
        createdAt: event.occurredAt,
      },
      update: { name: event.name },
    });
    return;
  }

  await prisma.funnelEvent.create({
    data: {
      id: randomBytes(16).toString("hex"),
      name: event.name,
      userHash: event.userHash,
      propsJson,
      createdAt: event.occurredAt,
    },
  });
}

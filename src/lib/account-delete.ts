import { promises as fs } from "fs";
import path from "path";
import { ACCOUNT_DELETE_CONFIRM } from "@/lib/account-delete-confirm";
import { invalidateFoodCorrectionCache } from "@/lib/food-corrections-store";
import { prisma } from "@/lib/prisma";
import { resolveLegacyImageId } from "@/lib/upload";

export { ACCOUNT_DELETE_CONFIRM };

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "public/uploads";

function getUploadDirectory(): string {
  return path.join(process.cwd(), UPLOAD_DIR);
}

/** Remove image + `.owner` sidecar for one upload id. */
export async function deleteUploadFiles(id: string): Promise<void> {
  const safeId = id.trim();
  if (!safeId || safeId.includes("/") || safeId.includes("..")) {
    return;
  }

  const uploadPath = getUploadDirectory();
  let files: string[];
  try {
    files = await fs.readdir(uploadPath);
  } catch {
    return;
  }

  await Promise.all(
    files
      .filter((file) => file === safeId || file === `${safeId}.owner` || file.startsWith(`${safeId}.`))
      .map(async (file) => {
        try {
          await fs.unlink(path.join(uploadPath, file));
        } catch {
          // best-effort cleanup
        }
      }),
  );
}

function collectImageIds(paths: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const imagePath of paths) {
    if (!imagePath) continue;
    const id = resolveLegacyImageId(imagePath);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * GDPR account wipe: cascade Prisma user graph, food corrections (no FK),
 * verification tokens, then best-effort upload files.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, image: true },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const mealImages = await prisma.mealEntry.findMany({
    where: { userId, imagePath: { not: null } },
    select: { imagePath: true },
  });

  const imageIds = collectImageIds([user.image, ...mealImages.map((row) => row.imagePath)]);

  const identifiers = [user.email, user.phone].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  await prisma.$transaction(async (tx) => {
    await tx.foodCorrection.deleteMany({ where: { userId } });
    if (identifiers.length > 0) {
      await tx.verificationToken.deleteMany({
        where: { identifier: { in: identifiers } },
      });
    }
    // Cascades: accounts, sessions, meals, weights, water, diary, custom foods,
    // day templates, streak freezes, push subscriptions/logs, challenges, badges.
    await tx.user.delete({ where: { id: userId } });
  });

  invalidateFoodCorrectionCache(userId);

  await Promise.all(imageIds.map((id) => deleteUploadFiles(id)));
}

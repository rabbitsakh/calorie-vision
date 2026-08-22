import { createHash } from "crypto";

type FileIdCacheEntry = {
  fileId: string;
  expiresAt: number;
};

const FILE_ID_CACHE_TTL_MS = 8 * 60 * 1000;
const fileIdCache = new Map<string, FileIdCacheEntry>();

export function imageUploadCacheKey(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function getCachedFileId(cacheKey: string): string | null {
  const entry = fileIdCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    fileIdCache.delete(cacheKey);
    return null;
  }
  return entry.fileId;
}

export function rememberCachedFileId(cacheKey: string, fileId: string): void {
  fileIdCache.set(cacheKey, {
    fileId,
    expiresAt: Date.now() + FILE_ID_CACHE_TTL_MS,
  });

  if (fileIdCache.size > 200) {
    const cutoff = Date.now();
    for (const [key, value] of fileIdCache) {
      if (value.expiresAt <= cutoff) {
        fileIdCache.delete(key);
      }
    }
  }
}

export function resetFileIdCacheForTests(): void {
  fileIdCache.clear();
}

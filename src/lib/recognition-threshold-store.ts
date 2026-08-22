import { prisma } from "@/lib/prisma";

const CONFIG_ID = "default";

let cachedThreshold: number | null = null;

export function getCachedLowConfidenceThreshold(): number | null {
  return cachedThreshold;
}

export function setCachedLowConfidenceThreshold(value: number): void {
  cachedThreshold = value;
}

export async function loadLowConfidenceThresholdFromDb(): Promise<number | null> {
  try {
    const row = await prisma.recognitionConfig.findUnique({
      where: { id: CONFIG_ID },
      select: { lowConfidenceThreshold: true },
    });
    if (row && Number.isFinite(row.lowConfidenceThreshold)) {
      cachedThreshold = row.lowConfidenceThreshold;
      return row.lowConfidenceThreshold;
    }
  } catch (error) {
    console.warn("Failed to load recognition config", error);
  }
  return null;
}

export async function saveLowConfidenceThresholdToDb(value: number): Promise<number> {
  const row = await prisma.recognitionConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, lowConfidenceThreshold: value },
    update: { lowConfidenceThreshold: value },
    select: { lowConfidenceThreshold: true },
  });
  cachedThreshold = row.lowConfidenceThreshold;
  return row.lowConfidenceThreshold;
}

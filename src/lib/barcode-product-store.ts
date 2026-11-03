import type { BarcodeCatalogProduct, BarcodeCatalogSource } from "@/lib/barcode-product";
import { prisma } from "@/lib/prisma";

function asSource(value: string): BarcodeCatalogSource {
  if (value === "user" || value === "ru-sku" || value === "openfoodfacts") {
    return value;
  }
  return "openfoodfacts";
}

function mapRow(row: {
  barcode: string;
  name: string;
  brand: string | null;
  kcalPer100: number;
  proteinPer100: number | null;
  fatPer100: number | null;
  carbsPer100: number | null;
  packGrams: number | null;
  imageUrl: string | null;
  source: string;
  userContributed: boolean;
}): BarcodeCatalogProduct {
  return {
    barcode: row.barcode,
    name: row.name,
    brand: row.brand ?? undefined,
    kcalPer100: row.kcalPer100,
    proteinPer100: row.proteinPer100 ?? undefined,
    fatPer100: row.fatPer100 ?? undefined,
    carbsPer100: row.carbsPer100 ?? undefined,
    packGrams: row.packGrams ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    source: asSource(row.source),
    userContributed: row.userContributed,
  };
}

export async function readBarcodeProduct(barcode: string): Promise<BarcodeCatalogProduct | null> {
  const row = await prisma.barcodeProduct.findUnique({ where: { barcode } });
  return row ? mapRow(row) : null;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Insert only. An existing row (OFF or another user) stays as the shared answer. */
export async function writeBarcodeProduct(
  product: BarcodeCatalogProduct,
  contributorId?: string | null,
): Promise<void> {
  try {
    await prisma.barcodeProduct.create({
      data: {
        barcode: product.barcode,
        name: product.name.slice(0, 255),
        brand: product.brand?.slice(0, 120) || null,
        kcalPer100: product.kcalPer100,
        proteinPer100: product.proteinPer100 ?? null,
        fatPer100: product.fatPer100 ?? null,
        carbsPer100: product.carbsPer100 ?? null,
        packGrams: product.packGrams ?? null,
        imageUrl: product.imageUrl?.slice(0, 512) || null,
        source: product.source,
        userContributed: product.userContributed,
        contributorId: product.userContributed ? contributorId ?? null : null,
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) return;
    throw error;
  }
}

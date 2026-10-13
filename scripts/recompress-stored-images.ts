import { recompressStoredImages } from "../src/lib/upload.ts";

/** Walk /uploads and recompress oversized food images. Rare maintenance — not for deploy. */
async function main() {
  const recompressed = await recompressStoredImages();
  console.info(`Stored images recompressed: ${recompressed}`);
}

main().catch((error: unknown) => {
  console.error("Image recompress failed", error);
  process.exitCode = 1;
});

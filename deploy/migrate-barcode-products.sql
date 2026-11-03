-- Shared barcode product cache: Open Food Facts hits and user-contributed packs.
-- Lookup order in the app: this table, then Open Food Facts (world, then ru).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `BarcodeProduct` (
  `id`              VARCHAR(191) NOT NULL,
  `barcode`         VARCHAR(14)  NOT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `brand`           VARCHAR(120) NULL,
  `kcalPer100`      DOUBLE       NOT NULL,
  `proteinPer100`   DOUBLE       NULL,
  `fatPer100`       DOUBLE       NULL,
  `carbsPer100`     DOUBLE       NULL,
  `packGrams`       INT          NULL,
  `imageUrl`        VARCHAR(512) NULL,
  `source`          VARCHAR(32)  NOT NULL,
  `userContributed` BOOLEAN      NOT NULL DEFAULT false,
  `contributorId`   VARCHAR(191) NULL,
  `createdAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BarcodeProduct_barcode_key` (`barcode`),
  INDEX `BarcodeProduct_contributorId_idx` (`contributorId`),
  CONSTRAINT `BarcodeProduct_contributorId_fkey`
    FOREIGN KEY (`contributorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-barcode-products: ok' AS status;

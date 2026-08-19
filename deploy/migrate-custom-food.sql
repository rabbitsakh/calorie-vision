-- Личная база продуктов пользователя.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `CustomFood` (
  `id`           VARCHAR(191) NOT NULL,
  `userId`       VARCHAR(191) NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `calories`     INT          NOT NULL,
  `protein`      DOUBLE       NULL,
  `fat`          DOUBLE       NULL,
  `carbs`        DOUBLE       NULL,
  `portionGrams` INT          NULL,
  `useCount`     INT          NOT NULL DEFAULT 1,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CustomFood_userId_idx` (`userId`),
  CONSTRAINT `CustomFood_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-custom-food: ok' AS status;

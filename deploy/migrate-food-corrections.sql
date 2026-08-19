-- Память исправлений распознавания: что модель называла неверно → как поправил пользователь.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `FoodCorrection` (
  `id` VARCHAR(191) NOT NULL,
  `originalKey` VARCHAR(191) NOT NULL,
  `correctedName` VARCHAR(191) NOT NULL,
  `calories` INT NOT NULL,
  `protein` DOUBLE NULL,
  `fat` DOUBLE NULL,
  `carbs` DOUBLE NULL,
  `portionGrams` INT NULL,
  `useCount` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `FoodCorrection_originalKey_key`(`originalKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-food-corrections: ok' AS status;

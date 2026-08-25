-- Ручной учёт калорий тренировок (ExerciseEntry).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `ExerciseEntry` (
  `id`             VARCHAR(191) NOT NULL,
  `userId`         VARCHAR(191) NOT NULL,
  `date`           VARCHAR(10)  NOT NULL,
  `label`          VARCHAR(80)  NOT NULL,
  `caloriesBurned` INT          NOT NULL,
  `minutes`        INT          NULL,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ExerciseEntry_userId_date_idx` (`userId`, `date`),
  CONSTRAINT `ExerciseEntry_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-exercise-entry: ok' AS status;

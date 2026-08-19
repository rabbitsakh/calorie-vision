-- Заметки дневника с оценкой настроения.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `DiaryNote` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `date`      VARCHAR(10)  NOT NULL,
  `note`      VARCHAR(500) NOT NULL,
  `mood`      INT          NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DiaryNote_userId_date_key` (`userId`, `date`),
  INDEX `DiaryNote_userId_idx` (`userId`),
  CONSTRAINT `DiaryNote_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-diary-note: ok' AS status;

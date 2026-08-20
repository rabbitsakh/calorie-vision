-- Заморозка серии: один пропуск в неделю.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `StreakFreeze` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `date`      VARCHAR(10)  NOT NULL,
  `weekStart` VARCHAR(10)  NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StreakFreeze_userId_date_key` (`userId`, `date`),
  INDEX `StreakFreeze_userId_weekStart_idx` (`userId`, `weekStart`),
  CONSTRAINT `StreakFreeze_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-streak-freeze: ok' AS status;

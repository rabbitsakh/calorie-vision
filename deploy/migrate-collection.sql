-- Коллекция: пыль набора и просмотр «новое». Старые награды и дневник не меняются.
-- Деплой применяет файл сам: npm run db:migrate-sql, затем prisma db push.
-- Повторный прогон безопасен.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `UserCollectionDust` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `setKey`    VARCHAR(32)  NOT NULL,
  `amount`    INTEGER      NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserCollectionDust_userId_setKey_key` (`userId`, `setKey`),
  INDEX `UserCollectionDust_userId_idx` (`userId`),
  CONSTRAINT `UserCollectionDust_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `UserRewardSeen` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `rewardKey` VARCHAR(64)  NOT NULL,
  `seenAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserRewardSeen_userId_rewardKey_key` (`userId`, `rewardKey`),
  INDEX `UserRewardSeen_userId_idx` (`userId`),
  CONSTRAINT `UserRewardSeen_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-collection: ok' AS status;

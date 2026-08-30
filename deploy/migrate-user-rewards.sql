-- Сундуки / косметические награды (wave 1).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `UserReward` (
  `id`         VARCHAR(191) NOT NULL,
  `userId`     VARCHAR(191) NOT NULL,
  `rewardKey`  VARCHAR(64)  NOT NULL,
  `source`     VARCHAR(32)  NOT NULL,
  `sourceKey`  VARCHAR(96)  NOT NULL,
  `unlockedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserReward_userId_sourceKey_key` (`userId`, `sourceKey`),
  INDEX `UserReward_userId_idx` (`userId`),
  INDEX `UserReward_userId_rewardKey_idx` (`userId`, `rewardKey`),
  CONSTRAINT `UserReward_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-user-rewards: ok' AS status;

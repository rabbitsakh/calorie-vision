-- Достижения (badges).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `UserBadge` (
  `id`         VARCHAR(191) NOT NULL,
  `userId`     VARCHAR(191) NOT NULL,
  `badgeKey`   VARCHAR(64)  NOT NULL,
  `unlockedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserBadge_userId_badgeKey_key` (`userId`, `badgeKey`),
  INDEX `UserBadge_userId_idx` (`userId`),
  CONSTRAINT `UserBadge_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-user-badges: ok' AS status;

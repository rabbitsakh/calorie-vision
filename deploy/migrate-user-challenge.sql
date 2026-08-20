-- Недельные челленджи.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `UserChallenge` (
  `id`           VARCHAR(191) NOT NULL,
  `userId`       VARCHAR(191) NOT NULL,
  `challengeKey` VARCHAR(64)  NOT NULL,
  `weekStart`    VARCHAR(10)  NOT NULL,
  `progress`     INT          NOT NULL DEFAULT 0,
  `target`       INT          NOT NULL,
  `completedAt`  DATETIME(3)  NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserChallenge_userId_weekStart_key` (`userId`, `weekStart`),
  INDEX `UserChallenge_userId_idx` (`userId`),
  CONSTRAINT `UserChallenge_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-user-challenge: ok' AS status;

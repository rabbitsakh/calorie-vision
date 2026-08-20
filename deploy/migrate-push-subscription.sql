-- Push-уведомления PWA.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `PushSubscription` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `endpoint`  VARCHAR(512) NOT NULL,
  `p256dh`    VARCHAR(255) NOT NULL,
  `auth`      VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PushSubscription_userId_endpoint_key` (`userId`, `endpoint`(191)),
  INDEX `PushSubscription_userId_idx` (`userId`),
  CONSTRAINT `PushSubscription_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-push-subscription: ok' AS status;

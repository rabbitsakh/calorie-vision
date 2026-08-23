-- Dedup log for push reminder cron (one send per user/kind/day).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `PushReminderLog` (
  `id`     VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `kind`   VARCHAR(32)  NOT NULL,
  `date`   VARCHAR(10)  NOT NULL,
  `sentAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PushReminderLog_userId_kind_date_key` (`userId`, `kind`, `date`),
  INDEX `PushReminderLog_userId_date_idx` (`userId`, `date`),
  CONSTRAINT `PushReminderLog_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-push-reminder-log: ok' AS status;

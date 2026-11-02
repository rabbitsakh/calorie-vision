-- Product funnel events (signup, first photo, confirm, D1/D7, paywall).
-- userHash is a salted SHA-256, not a user id. No meal text or contact data.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `FunnelEvent` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(48) NOT NULL,
  `userHash` VARCHAR(64) NULL,
  `propsJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `FunnelEvent_name_createdAt_idx` (`name`, `createdAt`),
  INDEX `FunnelEvent_userHash_name_idx` (`userHash`, `name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-funnel-events: ok' AS status;

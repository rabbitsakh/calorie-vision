-- Recognition pass telemetry for admin latency / quality dashboard.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `RecognitionPassLog` (
  `id` VARCHAR(191) NOT NULL,
  `pass` VARCHAR(16) NOT NULL,
  `photoKind` VARCHAR(32) NULL,
  `retryReason` VARCHAR(32) NULL,
  `specialistPass` VARCHAR(16) NULL,
  `itemCount` INT NOT NULL DEFAULT 0,
  `calories` INT NOT NULL DEFAULT 0,
  `confidence` DOUBLE NOT NULL DEFAULT 0,
  `dishName` VARCHAR(80) NULL,
  `source` VARCHAR(64) NULL,
  `chatCalls` INT NULL,
  `latencyMs` INT NULL,
  `enrichmentTimedOut` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `RecognitionPassLog_createdAt_idx` (`createdAt`),
  INDEX `RecognitionPassLog_pass_idx` (`pass`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-recognition-telemetry: ok' AS status;

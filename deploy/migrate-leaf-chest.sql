-- Дневные листки и сундук. Только новые таблицы, дневник не меняется.
-- Деплой применяет файл сам: npm run db:migrate-sql (см. deploy/deploy.sh),
-- затем prisma db push. Повторный прогон безопасен.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `LeafSpark` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `dateKey`   VARCHAR(10)  NOT NULL,
  `food`      BOOLEAN      NOT NULL DEFAULT false,
  `workout`   BOOLEAN      NOT NULL DEFAULT false,
  `spare`     BOOLEAN      NOT NULL DEFAULT false,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `LeafSpark_userId_dateKey_key` (`userId`, `dateKey`),
  INDEX `LeafSpark_userId_idx` (`userId`),
  CONSTRAINT `LeafSpark_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LeafChest` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `seq`       INTEGER      NOT NULL,
  `rarity`    VARCHAR(16)  NOT NULL,
  `combo`     BOOLEAN      NOT NULL DEFAULT false,
  `rewardKey` VARCHAR(64)  NULL,
  `openedAt`  DATETIME(3)  NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `LeafChest_userId_seq_key` (`userId`, `seq`),
  INDEX `LeafChest_userId_idx` (`userId`),
  CONSTRAINT `LeafChest_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LeafChestLedger` (
  `userId`       VARCHAR(191) NOT NULL,
  `commonStreak` INTEGER      NOT NULL DEFAULT 0,
  `sinceGold`    INTEGER      NOT NULL DEFAULT 0,
  `spareLeaf`    BOOLEAN      NOT NULL DEFAULT false,
  `updatedAt`    DATETIME(3)  NOT NULL,
  PRIMARY KEY (`userId`),
  CONSTRAINT `LeafChestLedger_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-leaf-chest: ok' AS status;

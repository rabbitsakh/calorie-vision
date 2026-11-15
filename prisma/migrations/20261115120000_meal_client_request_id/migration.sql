-- Идемпотентность MealEntry. Старые строки остаются с NULL.
-- В MySQL несколько NULL в уникальном индексе допустимы.

ALTER TABLE `MealEntry` ADD COLUMN `clientRequestId` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `MealEntry_userId_clientRequestId_key` ON `MealEntry`(`userId`, `clientRequestId`);

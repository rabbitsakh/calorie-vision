-- Водный баланс и тип приёма пищи (завтрак/обед/ужин/перекус).

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;
DELIMITER //
CREATE PROCEDURE `_add_column_if_not_exists`(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_ddl);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL `_add_column_if_not_exists`('MealEntry', 'mealType', "ENUM('BREAKFAST','LUNCH','DINNER','SNACK') NULL");
CALL `_add_column_if_not_exists`('User', 'targetWeightKg', 'DOUBLE NULL');
CALL `_add_column_if_not_exists`('User', 'goalDeadline', 'VARCHAR(10) NULL');

CREATE TABLE IF NOT EXISTS `WaterEntry` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `date`      VARCHAR(10)  NOT NULL,
  `ml`        INT          NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `WaterEntry_userId_date_idx` (`userId`, `date`),
  CONSTRAINT `WaterEntry_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

SELECT 'migrate-water-mealtype: ok' AS status;

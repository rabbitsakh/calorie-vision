-- Идемпотентный ключ записи дневника. Только добавление колонки и индекса.
-- NULL у уже существующих строк: уникальный индекс MySQL их не сталкивает.

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

CALL `_add_column_if_not_exists`('MealEntry', 'clientRequestId', 'VARCHAR(64) NULL');
DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MealEntry'
    AND INDEX_NAME = 'MealEntry_userId_clientRequestId_key'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `MealEntry` ADD UNIQUE INDEX `MealEntry_userId_clientRequestId_key` (`userId`, `clientRequestId`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'migrate-meal-client-request-id: ok' AS status;

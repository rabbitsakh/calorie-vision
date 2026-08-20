-- Per-user food correction memory (legacy rows stay global with userId = '').

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

CALL `_add_column_if_not_exists`('FoodCorrection', 'userId', 'VARCHAR(191) NOT NULL DEFAULT \'\'');

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

-- Drop old unique on originalKey if present
SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'FoodCorrection'
    AND INDEX_NAME = 'FoodCorrection_originalKey_key'
);
SET @sql := IF(
  @idx_exists > 0,
  'ALTER TABLE `FoodCorrection` DROP INDEX `FoodCorrection_originalKey_key`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Composite unique (userId, originalKey)
SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'FoodCorrection'
    AND INDEX_NAME = 'FoodCorrection_userId_originalKey_key'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `FoodCorrection` ADD UNIQUE INDEX `FoodCorrection_userId_originalKey_key` (`userId`, `originalKey`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'FoodCorrection'
    AND INDEX_NAME = 'FoodCorrection_userId_idx'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `FoodCorrection_userId_idx` ON `FoodCorrection` (`userId`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'migrate-food-corrections-user: ok' AS status;

-- Метаданные распознавания на записях дневника (source / photoKind / barcode).

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

CALL `_add_column_if_not_exists`('MealEntry', 'recognitionSource', 'VARCHAR(64) NULL');
CALL `_add_column_if_not_exists`('MealEntry', 'photoKind', 'VARCHAR(32) NULL');
CALL `_add_column_if_not_exists`('MealEntry', 'barcode', 'VARCHAR(32) NULL');

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

-- Index for admin source breakdown (ignore if already present)
SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MealEntry'
    AND INDEX_NAME = 'MealEntry_recognitionSource_idx'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `MealEntry_recognitionSource_idx` ON `MealEntry` (`recognitionSource`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'migrate-recognition-metadata: ok' AS status;

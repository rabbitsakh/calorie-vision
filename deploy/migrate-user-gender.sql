-- Пол пользователя для расчёта нормы калорий.
-- MySQL не поддерживает ADD COLUMN IF NOT EXISTS — проверяем INFORMATION_SCHEMA.

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

CALL `_add_column_if_not_exists`('User', 'sex', 'ENUM(''FEMALE'', ''MALE'') NULL');
DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

SELECT 'migrate-user-gender: ok' AS status;

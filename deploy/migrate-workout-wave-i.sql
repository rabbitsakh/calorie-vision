-- Wave I: live session clock (start / pause / finish).

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

CALL `_add_column_if_not_exists`('WorkoutSession', 'startedAt', 'DATETIME(3) NULL');
CALL `_add_column_if_not_exists`('WorkoutSession', 'endedAt', 'DATETIME(3) NULL');
CALL `_add_column_if_not_exists`('WorkoutSession', 'pausedAt', 'DATETIME(3) NULL');
CALL `_add_column_if_not_exists`('WorkoutSession', 'pausedMs', 'INT NOT NULL DEFAULT 0');

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

SELECT 'migrate-workout-wave-i: ok' AS status;

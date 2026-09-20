-- Cardio exercise kind + distance/duration set fields.

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

CALL `_add_column_if_not_exists`('WorkoutExercise', 'kind', 'VARCHAR(16) NOT NULL DEFAULT ''strength''');
CALL `_add_column_if_not_exists`('WorkoutSet', 'distanceKm', 'DOUBLE NULL');
CALL `_add_column_if_not_exists`('WorkoutSet', 'durationSec', 'INT NULL');

-- Strength columns become nullable so cardio rows can omit them.
ALTER TABLE `WorkoutSet`
  MODIFY COLUMN `weightKg` DOUBLE NULL,
  MODIFY COLUMN `reps` INT NULL;

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

SELECT 'migrate-workout-cardio: ok' AS status;

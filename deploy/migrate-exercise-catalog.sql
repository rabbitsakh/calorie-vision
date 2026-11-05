-- Справочник упражнений и поля привязки. Только добавление, без переписывания истории.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `ExerciseCatalog` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `nameNorm` VARCHAR(120) NOT NULL,
  `tracking` VARCHAR(16) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `primaryMuscles` JSON NOT NULL,
  `secondaryMuscles` JSON NOT NULL,
  `equipment` VARCHAR(32) NOT NULL,
  `synonyms` JSON NOT NULL,
  `defaultRestSec` INT NOT NULL DEFAULT 90,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ExerciseCatalog_nameNorm_idx` (`nameNorm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CALL `_add_column_if_not_exists`('WorkoutExerciseLibrary', 'catalogId', 'VARCHAR(64) NULL');
CALL `_add_column_if_not_exists`('WorkoutExercise', 'catalogId', 'VARCHAR(64) NULL');
CALL `_add_column_if_not_exists`('WorkoutSession', 'endedBy', 'VARCHAR(16) NULL');

DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

SELECT 'migrate-exercise-catalog: ok' AS status;

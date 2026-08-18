-- ============================================================
-- Миграция: несколько замеров веса в день + часовой пояс
-- Запускать ВМЕСТО `prisma db push` если он падает с ошибкой
-- Duplicate foreign key constraint name 'MealEntry_userId_fkey'.
--
-- Использование на сервере:
--   mysql -u calorie -p calorie_vision < deploy/migrate-weight-timezone.sql
-- или через root:
--   mysql -u root -p calorie_vision < deploy/migrate-weight-timezone.sql
-- ============================================================

SET NAMES utf8mb4;

-- 1. Добавить timezone к пользователю (идемпотентно)
ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `timezone` VARCHAR(64) NULL;

-- 2. Добавить measuredAt к WeightEntry (идемпотентно)
ALTER TABLE `WeightEntry`
  ADD COLUMN IF NOT EXISTS `measuredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- 3. Заполнить measuredAt из createdAt для существующих записей
UPDATE `WeightEntry`
  SET `measuredAt` = `createdAt`
  WHERE `measuredAt` = '0001-01-01 00:00:00.000'
     OR `measuredAt` < '2000-01-01';

-- 4. Удалить старый уникальный индекс WeightEntry(userId, date) если есть
-- (идемпотентно через процедуру)
DROP PROCEDURE IF EXISTS `_drop_weight_unique_if_exists`;
DELIMITER //
CREATE PROCEDURE `_drop_weight_unique_if_exists`()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE  TABLE_SCHEMA = DATABASE()
      AND  TABLE_NAME   = 'WeightEntry'
      AND  CONSTRAINT_NAME = 'WeightEntry_userId_date_key'
      AND  CONSTRAINT_TYPE = 'UNIQUE'
  ) THEN
    ALTER TABLE `WeightEntry` DROP INDEX `WeightEntry_userId_date_key`;
  END IF;
END //
DELIMITER ;
CALL `_drop_weight_unique_if_exists`();
DROP PROCEDURE IF EXISTS `_drop_weight_unique_if_exists`;

-- 5. Создать индексы если их нет (MySQL игнорирует IF NOT EXISTS для INDEX)
DROP PROCEDURE IF EXISTS `_add_index_if_not_exists`;
DELIMITER //
CREATE PROCEDURE `_add_index_if_not_exists`(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_cols  VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   INFORMATION_SCHEMA.STATISTICS
    WHERE  TABLE_SCHEMA = DATABASE()
      AND  TABLE_NAME   = p_table
      AND  INDEX_NAME   = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL `_add_index_if_not_exists`('WeightEntry', 'WeightEntry_userId_date_idx', '`userId`, `date`');
CALL `_add_index_if_not_exists`('WeightEntry', 'WeightEntry_userId_measuredAt_idx', '`userId`, `measuredAt`');
DROP PROCEDURE IF EXISTS `_add_index_if_not_exists`;

SELECT 'Миграция выполнена успешно.' AS status;

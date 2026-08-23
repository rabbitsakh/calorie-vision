-- One streak freeze per user per calendar week (userId + weekStart).

SET NAMES utf8mb4;

-- Drop loose index if present so we can replace it with a unique key.
-- Keep any existing unique constraint name stable for deploys.
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'StreakFreeze'
    AND index_name = 'StreakFreeze_userId_weekStart_idx'
);
SET @sql := IF(
  @idx_exists > 0,
  'ALTER TABLE `StreakFreeze` DROP INDEX `StreakFreeze_userId_weekStart_idx`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @uniq_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'StreakFreeze'
    AND index_name = 'StreakFreeze_userId_weekStart_key'
);
SET @sql := IF(
  @uniq_exists = 0,
  'ALTER TABLE `StreakFreeze` ADD UNIQUE INDEX `StreakFreeze_userId_weekStart_key` (`userId`, `weekStart`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'migrate-streak-freeze-week: ok' AS status;

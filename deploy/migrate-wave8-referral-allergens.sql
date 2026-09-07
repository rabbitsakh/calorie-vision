-- Wave 8: referral attribution + allergen tags on User.

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

CALL `_add_column_if_not_exists`('User', 'referralCode', 'VARCHAR(16) NULL');
CALL `_add_column_if_not_exists`('User', 'referredByUserId', 'VARCHAR(191) NULL');
CALL `_add_column_if_not_exists`('User', 'referralClaimedAt', 'DATETIME(3) NULL');
CALL `_add_column_if_not_exists`('User', 'allergensJson', 'JSON NULL');
DROP PROCEDURE IF EXISTS `_add_column_if_not_exists`;

-- Unique index for ?ref= lookup (ignore if already present).
SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'User'
    AND INDEX_NAME = 'User_referralCode_key'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX `User_referralCode_key` ON `User`(`referralCode`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'migrate-wave8-referral-allergens: ok' AS status;

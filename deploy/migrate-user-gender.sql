-- Пол пользователя для расчёта нормы калорий.
-- Идемпотентно: колонка добавляется только если её ещё нет.

SET NAMES utf8mb4;

ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `sex` ENUM('FEMALE', 'MALE') NULL;

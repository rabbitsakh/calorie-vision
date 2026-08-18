-- Заготовки после сбоя входа через VK: имя есть, почты/телефона нет,
-- аккаунт провайдера не привязан, дневника нет.
-- MySQL допускает несколько NULL в UNIQUE(email), поэтому каждый повтор
-- создавал нового пользователя с тем же именем.

DELETE `User`
FROM `User`
LEFT JOIN `Account` ON `Account`.`userId` = `User`.`id`
LEFT JOIN `MealEntry` ON `MealEntry`.`userId` = `User`.`id`
LEFT JOIN `WeightEntry` ON `WeightEntry`.`userId` = `User`.`id`
LEFT JOIN `Session` ON `Session`.`userId` = `User`.`id`
WHERE `User`.`email` IS NULL
  AND `User`.`phone` IS NULL
  AND `Account`.`userId` IS NULL
  AND `MealEntry`.`userId` IS NULL
  AND `WeightEntry`.`userId` IS NULL
  AND `Session`.`userId` IS NULL;

SELECT 'migrate-orphan-oauth-users: ok' AS status;


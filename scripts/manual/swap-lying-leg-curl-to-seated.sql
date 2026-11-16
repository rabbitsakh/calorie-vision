-- Ручная замена «Сгибание ног лёжа» → «Сгибание ног сидя в тренажёре».
-- Деплой этот файл не применяет (не лежит в deploy/migrate-*.sql). Не запускать пачкой миграций.
--
-- Кого трогает: пользователей, у кого в шаблоне с «Ноги» в названии есть
-- сгибание ног лёжа (или уже сидя — чтобы дочистить тренировки) и разгибание ног.
-- Подходы (WorkoutSet) не переписываются: вес 90 кг остаётся на той же строке упражнения.
-- Имя и catalogId меняются и в прошлых тренировках этого движения, иначе прогрессия
-- ищет историю по новому id и не видит 90 кг. Следующий шаг считается как 90 × 1,05 = 94,5.
-- Повторный запуск ничего не меняет: условие смотрит только на старое имя.

-- Проверка до записи (раскомментировать и посмотреть):
-- SELECT r.userId, r.name AS routine, re.name AS exercise, re.supersetGroup
-- FROM WorkoutRoutine r
-- JOIN WorkoutRoutineExercise re ON re.routineId = r.id
-- WHERE r.name LIKE '%Ноги%'
--   AND (re.name LIKE 'Сгибание ног л%' OR re.name LIKE 'Разгибание ног%');

UPDATE `WorkoutRoutineExercise` re
INNER JOIN `WorkoutRoutine` r ON r.id = re.routineId
INNER JOIN (
  SELECT DISTINCT r2.userId AS userId
  FROM `WorkoutRoutine` r2
  INNER JOIN `WorkoutRoutineExercise` curl
    ON curl.routineId = r2.id
   AND REPLACE(curl.name, 'ё', 'е') IN (
     'Сгибание ног лежа',
     'Сгибание ног сидя в тренажере'
   )
  INNER JOIN `WorkoutRoutineExercise` ext
    ON ext.routineId = r2.id
   AND ext.name LIKE 'Разгибание ног%'
  WHERE r2.name LIKE '%Ноги%'
) u ON u.userId = r.userId
SET re.name = 'Сгибание ног сидя в тренажёре'
WHERE r.name LIKE '%Ноги%'
  AND REPLACE(re.name, 'ё', 'е') = 'Сгибание ног лежа';

UPDATE `WorkoutExercise` we
INNER JOIN `WorkoutSession` s ON s.id = we.sessionId
INNER JOIN (
  SELECT DISTINCT r2.userId AS userId
  FROM `WorkoutRoutine` r2
  INNER JOIN `WorkoutRoutineExercise` curl
    ON curl.routineId = r2.id
   AND REPLACE(curl.name, 'ё', 'е') IN (
     'Сгибание ног лежа',
     'Сгибание ног сидя в тренажере'
   )
  INNER JOIN `WorkoutRoutineExercise` ext
    ON ext.routineId = r2.id
   AND ext.name LIKE 'Разгибание ног%'
  WHERE r2.name LIKE '%Ноги%'
) u ON u.userId = s.userId
SET we.name = 'Сгибание ног сидя в тренажёре',
    we.catalogId = 'leg-curl-seat',
    we.updatedAt = CURRENT_TIMESTAMP(3)
WHERE REPLACE(we.name, 'ё', 'е') = 'Сгибание ног лежа'
  AND (we.catalogId IS NULL OR we.catalogId IN ('leg-curl', 'leg-curl-seat'));

UPDATE `WorkoutExerciseLibrary` lib
INNER JOIN (
  SELECT DISTINCT r2.userId AS userId
  FROM `WorkoutRoutine` r2
  INNER JOIN `WorkoutRoutineExercise` curl
    ON curl.routineId = r2.id
   AND REPLACE(curl.name, 'ё', 'е') IN (
     'Сгибание ног лежа',
     'Сгибание ног сидя в тренажере'
   )
  INNER JOIN `WorkoutRoutineExercise` ext
    ON ext.routineId = r2.id
   AND ext.name LIKE 'Разгибание ног%'
  WHERE r2.name LIKE '%Ноги%'
) u ON u.userId = lib.userId
SET lib.name = 'Сгибание ног сидя в тренажёре',
    lib.nameNorm = 'сгибание ног сидя в тренажере',
    lib.catalogId = 'leg-curl-seat',
    lib.updatedAt = CURRENT_TIMESTAMP(3)
WHERE REPLACE(lib.name, 'ё', 'е') = 'Сгибание ног лежа'
  AND NOT EXISTS (
    SELECT 1
    FROM (
      SELECT id, userId, nameNorm
      FROM `WorkoutExerciseLibrary`
    ) other
    WHERE other.userId = lib.userId
      AND other.nameNorm = 'сгибание ног сидя в тренажере'
      AND other.id <> lib.id
  );

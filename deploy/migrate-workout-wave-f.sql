-- Wave F: exercise library + routines (templates).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `WorkoutExerciseLibrary` (
  `id`                 VARCHAR(191) NOT NULL,
  `userId`             VARCHAR(191) NOT NULL,
  `name`               VARCHAR(120) NOT NULL,
  `nameNorm`           VARCHAR(120) NOT NULL,
  `kind`               VARCHAR(16)  NOT NULL DEFAULT 'strength',
  `defaultMuscleGroup` VARCHAR(32)  NULL,
  `useCount`           INT          NOT NULL DEFAULT 0,
  `lastUsedAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`          DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkoutExerciseLibrary_userId_nameNorm_key` (`userId`, `nameNorm`),
  INDEX `WorkoutExerciseLibrary_userId_lastUsedAt_idx` (`userId`, `lastUsedAt`),
  INDEX `WorkoutExerciseLibrary_userId_nameNorm_idx` (`userId`, `nameNorm`),
  CONSTRAINT `WorkoutExerciseLibrary_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WorkoutRoutine` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `name`      VARCHAR(120) NOT NULL,
  `note`      VARCHAR(200) NULL,
  `sortOrder` INT          NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `WorkoutRoutine_userId_sortOrder_idx` (`userId`, `sortOrder`),
  CONSTRAINT `WorkoutRoutine_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WorkoutRoutineMuscle` (
  `id`        VARCHAR(191) NOT NULL,
  `routineId` VARCHAR(191) NOT NULL,
  `groupKey`  VARCHAR(32)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkoutRoutineMuscle_routineId_groupKey_key` (`routineId`, `groupKey`),
  INDEX `WorkoutRoutineMuscle_groupKey_idx` (`groupKey`),
  CONSTRAINT `WorkoutRoutineMuscle_routineId_fkey`
    FOREIGN KEY (`routineId`) REFERENCES `WorkoutRoutine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WorkoutRoutineExercise` (
  `id`          VARCHAR(191) NOT NULL,
  `routineId`   VARCHAR(191) NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `kind`        VARCHAR(16)  NOT NULL DEFAULT 'strength',
  `muscleGroup` VARCHAR(32)  NULL,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  `plannedSets` JSON         NULL,
  PRIMARY KEY (`id`),
  INDEX `WorkoutRoutineExercise_routineId_sortOrder_idx` (`routineId`, `sortOrder`),
  CONSTRAINT `WorkoutRoutineExercise_routineId_fkey`
    FOREIGN KEY (`routineId`) REFERENCES `WorkoutRoutine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-workout-wave-f: ok' AS status;

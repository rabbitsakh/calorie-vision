-- Admin-only workouts: sessions, muscle groups, exercises, sets.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `WorkoutSession` (
  `id`           VARCHAR(191) NOT NULL,
  `userId`       VARCHAR(191) NOT NULL,
  `date`         VARCHAR(10)  NOT NULL,
  `note`         VARCHAR(200) NULL,
  `progressRate` DOUBLE       NOT NULL DEFAULT 0.05,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `WorkoutSession_userId_date_idx` (`userId`, `date`),
  INDEX `WorkoutSession_userId_createdAt_idx` (`userId`, `createdAt`),
  CONSTRAINT `WorkoutSession_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WorkoutSessionMuscle` (
  `id`        VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `groupKey`  VARCHAR(32)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkoutSessionMuscle_sessionId_groupKey_key` (`sessionId`, `groupKey`),
  INDEX `WorkoutSessionMuscle_groupKey_idx` (`groupKey`),
  CONSTRAINT `WorkoutSessionMuscle_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `WorkoutSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WorkoutExercise` (
  `id`          VARCHAR(191) NOT NULL,
  `sessionId`   VARCHAR(191) NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `muscleGroup` VARCHAR(32)  NULL,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `WorkoutExercise_sessionId_sortOrder_idx` (`sessionId`, `sortOrder`),
  CONSTRAINT `WorkoutExercise_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `WorkoutSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WorkoutSet` (
  `id`         VARCHAR(191) NOT NULL,
  `exerciseId` VARCHAR(191) NOT NULL,
  `weightKg`   DOUBLE       NOT NULL,
  `reps`       INT          NOT NULL,
  `sortOrder`  INT          NOT NULL DEFAULT 0,
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `WorkoutSet_exerciseId_sortOrder_idx` (`exerciseId`, `sortOrder`),
  CONSTRAINT `WorkoutSet_exerciseId_fkey`
    FOREIGN KEY (`exerciseId`) REFERENCES `WorkoutExercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT 'migrate-workouts: ok' AS status;

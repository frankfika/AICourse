-- CreateTable
CREATE TABLE `practice_projects` (
    `id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `project_url` VARCHAR(191) NOT NULL,
    `thumbnail_url` VARCHAR(191) NULL,
    `difficulty` ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate',
    `estimated_time` INTEGER NOT NULL DEFAULT 30,
    `tags` TEXT NULL,
    `project_type` ENUM('model_deployment', 'model_training', 'model_inference', 'api_integration', 'notebook', 'sandbox', 'repository', 'csghub_space') NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `requirements` TEXT NULL,
    `objectives` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `practice_completions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `status` ENUM('in_progress', 'completed', 'skipped') NOT NULL DEFAULT 'in_progress',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `submission_url` VARCHAR(191) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `practice_completions_user_id_project_id_key`(`user_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `practice_projects` ADD CONSTRAINT `practice_projects_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_completions` ADD CONSTRAINT `practice_completions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `practice_completions` ADD CONSTRAINT `practice_completions_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `practice_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

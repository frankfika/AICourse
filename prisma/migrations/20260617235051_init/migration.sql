-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'student', 'instructor') NOT NULL DEFAULT 'student',
    `avatar_url` VARCHAR(191) NULL,
    `password_reset_required` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_login_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `learning_points` TEXT NOT NULL,
    `instructor` VARCHAR(191) NOT NULL,
    `instructor_id` VARCHAR(191) NULL,
    `level` ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert') NOT NULL,
    `duration` VARCHAR(191) NOT NULL,
    `thumbnail` VARCHAR(191) NOT NULL,
    `tags` TEXT NOT NULL,
    `cost_type` ENUM('free', 'paid', 'charity') NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chapters` (
    `id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `order_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lessons` (
    `id` VARCHAR(191) NOT NULL,
    `chapter_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `video_url` VARCHAR(191) NULL,
    `video_duration` INTEGER NULL,
    `order_index` INTEGER NOT NULL,
    `is_preview` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resources` (
    `id` VARCHAR(191) NOT NULL,
    `lesson_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `type` ENUM('pdf', 'code', 'link', 'video', 'audio') NOT NULL,
    `is_locked` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nano_degrees` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `learning_points` TEXT NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT 'sparkles',
    `cost_type` ENUM('free', 'paid', 'charity') NOT NULL,
    `thumbnail` VARCHAR(191) NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `degree_courses` (
    `degree_id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`degree_id`, `course_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NULL,
    `degree_id` VARCHAR(191) NULL,
    `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `source` ENUM('direct', 'degree', 'hackathon', 'promotion') NOT NULL DEFAULT 'direct',

    UNIQUE INDEX `enrollments_user_id_course_id_key`(`user_id`, `course_id`),
    UNIQUE INDEX `enrollments_user_id_degree_id_key`(`user_id`, `degree_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('course', 'degree') NOT NULL,
    `course_id` VARCHAR(191) NULL,
    `degree_id` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CNY',
    `status` ENUM('pending', 'paid', 'failed', 'expired', 'refunded') NOT NULL DEFAULT 'pending',
    `payment_method` VARCHAR(191) NULL,
    `transaction_id` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hackathons` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `banner_url` VARCHAR(191) NULL,
    `status` ENUM('upcoming', 'active', 'judging', 'finished', 'cancelled') NOT NULL DEFAULT 'upcoming',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `register_deadline` DATETIME(3) NULL,
    `max_team_size` INTEGER NOT NULL DEFAULT 5,
    `min_team_size` INTEGER NOT NULL DEFAULT 1,
    `location` VARCHAR(191) NULL,
    `rules` TEXT NULL,
    `prizes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hackathon_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `hackathon_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` ENUM('registered', 'cancelled', 'checked_in') NOT NULL DEFAULT 'registered',
    `registered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `checked_in_at` DATETIME(3) NULL,

    UNIQUE INDEX `hackathon_registrations_hackathon_id_user_id_key`(`hackathon_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teams` (
    `id` VARCHAR(191) NOT NULL,
    `hackathon_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slogan` VARCHAR(191) NULL,
    `captain_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `id` VARCHAR(191) NOT NULL,
    `team_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `role` ENUM('captain', 'member') NOT NULL DEFAULT 'member',

    UNIQUE INDEX `team_members_team_id_user_id_key`(`team_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `judges` (
    `id` VARCHAR(191) NOT NULL,
    `hackathon_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `avatar_url` VARCHAR(191) NULL,
    `bio` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` VARCHAR(191) NOT NULL,
    `hackathon_id` VARCHAR(191) NOT NULL,
    `team_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `demo_url` VARCHAR(191) NULL,
    `repo_url` VARCHAR(191) NULL,
    `video_url` VARCHAR(191) NULL,
    `status` ENUM('draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected') NOT NULL DEFAULT 'draft',
    `score` DECIMAL(5, 2) NULL,
    `feedback` TEXT NULL,
    `submitted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `id` VARCHAR(191) NOT NULL,
    `hackathon_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `progress_records` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `lesson_id` VARCHAR(191) NOT NULL,
    `status` ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
    `completed_at` DATETIME(3) NULL,
    `last_position` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `progress_records_user_id_lesson_id_key`(`user_id`, `lesson_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chapters` ADD CONSTRAINT `chapters_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resources` ADD CONSTRAINT `resources_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `degree_courses` ADD CONSTRAINT `degree_courses_degree_id_fkey` FOREIGN KEY (`degree_id`) REFERENCES `nano_degrees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `degree_courses` ADD CONSTRAINT `degree_courses_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_degree_id_fkey` FOREIGN KEY (`degree_id`) REFERENCES `nano_degrees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_degree_id_fkey` FOREIGN KEY (`degree_id`) REFERENCES `nano_degrees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hackathon_registrations` ADD CONSTRAINT `hackathon_registrations_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hackathon_registrations` ADD CONSTRAINT `hackathon_registrations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `judges` ADD CONSTRAINT `judges_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_records` ADD CONSTRAINT `progress_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_records` ADD CONSTRAINT `progress_records_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_records` ADD CONSTRAINT `progress_records_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

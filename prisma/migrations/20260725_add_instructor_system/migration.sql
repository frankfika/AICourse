-- DropIndex
DROP INDEX `courses_instructor_id_idx` ON `courses`;

-- AlterTable
ALTER TABLE `courses` DROP COLUMN `instructor_id`;

-- CreateTable
CREATE TABLE `instructors` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `name_en` VARCHAR(191) NULL,
    `title` VARCHAR(120) NULL,
    `title_en` VARCHAR(120) NULL,
    `headline` VARCHAR(255) NULL,
    `headline_en` VARCHAR(255) NULL,
    `bio` TEXT NULL,
    `bio_en` TEXT NULL,
    `avatar_url` VARCHAR(191) NULL,
    `company` VARCHAR(120) NULL,
    `years_of_experience` INTEGER NULL,
    `linkedin_url` VARCHAR(191) NULL,
    `github_url` VARCHAR(191) NULL,
    `twitter_url` VARCHAR(191) NULL,
    `website_url` VARCHAR(191) NULL,
    `contact_email` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instructors_slug_key`(`slug`),
    INDEX `instructors_published_at_order_index_idx`(`published_at`, `order_index`),
    INDEX `instructors_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_instructor_links` (
    `id` VARCHAR(191) NOT NULL,
    `course_id` VARCHAR(191) NOT NULL,
    `instructor_id` VARCHAR(191) NOT NULL,
    `role` ENUM('instructor', 'mentor') NOT NULL DEFAULT 'instructor',
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `course_instructor_links_instructor_id_role_idx`(`instructor_id`, `role`),
    INDEX `course_instructor_links_course_id_is_primary_idx`(`course_id`, `is_primary`),
    UNIQUE INDEX `course_instructor_links_course_id_instructor_id_role_key`(`course_id`, `instructor_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instructor_expertises` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `label_en` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `instructor_expertises_key_key`(`key`),
    INDEX `instructor_expertises_is_active_order_index_idx`(`is_active`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `instructor_expertise_links` (
    `instructor_id` VARCHAR(191) NOT NULL,
    `expertise_id` VARCHAR(191) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    INDEX `instructor_expertise_links_expertise_id_idx`(`expertise_id`),
    PRIMARY KEY (`instructor_id`, `expertise_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `course_instructor_links` ADD CONSTRAINT `course_instructor_links_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_instructor_links` ADD CONSTRAINT `course_instructor_links_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instructor_expertise_links` ADD CONSTRAINT `instructor_expertise_links_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `instructor_expertise_links` ADD CONSTRAINT `instructor_expertise_links_expertise_id_fkey` FOREIGN KEY (`expertise_id`) REFERENCES `instructor_expertises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


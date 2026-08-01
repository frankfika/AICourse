-- DropIndex
DROP INDEX `reviews_course_id_rating_idx` ON `reviews`;

-- AlterTable
ALTER TABLE `ai_usage` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `app_settings` MODIFY `scope` ENUM('global', 'page', 'user') NOT NULL DEFAULT 'global';

-- AlterTable
ALTER TABLE `badges` MODIFY `criteria_type` ENUM('course_completed', 'lessons_completed', 'streak_days', 'first_enrollment', 'practice_completed', 'points_reached', 'course_specific') NOT NULL;

-- AlterTable
ALTER TABLE `certificates` MODIFY `type` ENUM('course', 'degree', 'hackathon') NOT NULL;

-- AlterTable
ALTER TABLE `chat_messages` MODIFY `role` ENUM('user', 'assistant', 'system') NOT NULL;

-- AlterTable
ALTER TABLE `courses` DROP COLUMN `instructor_id`,
    ADD COLUMN `category_id` VARCHAR(191) NULL,
    ADD COLUMN `industry_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `date_format_templates` DROP PRIMARY KEY,
    MODIFY `scope` ENUM('global', 'locale', 'admin_users_list', 'common_date', 'dashboard_lesson_duration') NOT NULL,
    ADD PRIMARY KEY (`scope`, `locale`);

-- AlterTable
ALTER TABLE `enrollments` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `enterprise_inquiries` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `hackathon_registrations` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `hackathons` ADD COLUMN `registration_label` VARCHAR(191) NULL,
    ADD COLUMN `registration_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `hot_keywords` MODIFY `scope` ENUM('courses', 'home', 'search', 'all') NOT NULL DEFAULT 'courses';

-- AlterTable
ALTER TABLE `i18n_messages` MODIFY `category` ENUM('common', 'auth', 'course', 'hackathon', 'degree', 'enterprise', 'admin') NOT NULL DEFAULT 'common';

-- AlterTable
ALTER TABLE `judges` ADD COLUMN `order_index` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'judge';

-- AlterTable
ALTER TABLE `learning_events` MODIFY `event_type` ENUM('play', 'pause', 'seek', 'complete', 'replay', 'skip', 'note') NOT NULL;

-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('announcement', 'comment', 'hackathon', 'order') NOT NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    MODIFY `payment_method` ENUM('wechat', 'alipay', 'stripe') NULL;

-- AlterTable
ALTER TABLE `point_transactions` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    MODIFY `ref_type` ENUM('lesson', 'practice', 'badge', 'enrollment') NULL;

-- AlterTable
ALTER TABLE `practice_completions` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `quick_prompts` MODIFY `emoji` VARCHAR(191) NOT NULL DEFAULT '💡',
    MODIFY `scope` ENUM('lesson', 'course', 'degree', 'global') NOT NULL DEFAULT 'lesson';

-- AlterTable
ALTER TABLE `reviews` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `helpful` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `site_settings` MODIFY `scope` ENUM('global', 'page', 'user') NOT NULL DEFAULT 'global';

-- AlterTable
ALTER TABLE `submissions` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `sponsors` (
    `id` VARCHAR(191) NOT NULL,
    `hackathon_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logo_url` VARCHAR(191) NULL,
    `website_url` VARCHAR(191) NULL,
    `tier` VARCHAR(191) NOT NULL DEFAULT 'silver',
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sponsors_hackathon_id_tier_order_index_idx`(`hackathon_id`, `tier`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_configs` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `api_key_enc` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `base_url` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_configs_provider_key`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ai_usage_user_id_deleted_at_idx` ON `ai_usage`(`user_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `announcements_hackathon_id_is_pinned_created_at_idx` ON `announcements`(`hackathon_id`, `is_pinned`, `created_at`);

-- CreateIndex
CREATE INDEX `audit_logs_entity_entity_id_idx` ON `audit_logs`(`entity`, `entity_id`);

-- CreateIndex
CREATE INDEX `auth_providers_is_active_order_index_idx` ON `auth_providers`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `course_categories_is_active_order_index_idx` ON `course_categories`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `courses_status_created_at_idx` ON `courses`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `courses_cost_type_idx` ON `courses`(`cost_type`);

-- CreateIndex
CREATE INDEX `courses_course_type_idx` ON `courses`(`course_type`);

-- CreateIndex
CREATE INDEX `courses_level_idx` ON `courses`(`level`);

-- CreateIndex
CREATE INDEX `courses_created_at_idx` ON `courses`(`created_at`);

-- CreateIndex
CREATE INDEX `courses_industry_id_idx` ON `courses`(`industry_id`);

-- CreateIndex
CREATE INDEX `courses_category_id_idx` ON `courses`(`category_id`);

-- CreateIndex
CREATE INDEX `enrollments_user_id_deleted_at_idx` ON `enrollments`(`user_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `enrollments_course_id_deleted_at_idx` ON `enrollments`(`course_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `enterprise_inquiries_status_created_at_idx` ON `enterprise_inquiries`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `enterprise_inquiries_email_idx` ON `enterprise_inquiries`(`email`);

-- CreateIndex
CREATE INDEX `enterprise_inquiries_deleted_at_idx` ON `enterprise_inquiries`(`deleted_at`);

-- CreateIndex
CREATE UNIQUE INDEX `enterprise_methods_num_key` ON `enterprise_methods`(`num`);

-- CreateIndex
CREATE INDEX `enterprise_methods_is_active_order_index_idx` ON `enterprise_methods`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `footer_columns_is_active_order_index_idx` ON `footer_columns`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `hackathon_registrations_user_id_status_idx` ON `hackathon_registrations`(`user_id`, `status`);

-- CreateIndex
CREATE INDEX `hackathon_registrations_hackathon_id_status_idx` ON `hackathon_registrations`(`hackathon_id`, `status`);

-- CreateIndex
CREATE INDEX `hackathons_status_start_date_idx` ON `hackathons`(`status`, `start_date`);

-- CreateIndex
CREATE UNIQUE INDEX `hot_keywords_keyword_key` ON `hot_keywords`(`keyword`);

-- CreateIndex
CREATE INDEX `hot_keywords_scope_is_active_order_index_idx` ON `hot_keywords`(`scope`, `is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `industries_is_active_order_index_idx` ON `industries`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `judges_hackathon_id_order_index_idx` ON `judges`(`hackathon_id`, `order_index`);

-- CreateIndex
CREATE INDEX `orders_user_id_status_created_at_idx` ON `orders`(`user_id`, `status`, `created_at`);

-- CreateIndex
CREATE INDEX `orders_user_id_created_at_idx` ON `orders`(`user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `orders_status_paid_at_idx` ON `orders`(`status`, `paid_at`);

-- CreateIndex
CREATE INDEX `orders_transaction_id_idx` ON `orders`(`transaction_id`);

-- CreateIndex
CREATE INDEX `point_transactions_user_id_deleted_at_idx` ON `point_transactions`(`user_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `popular_searches_is_active_order_index_idx` ON `popular_searches`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `practice_completions_user_id_status_idx` ON `practice_completions`(`user_id`, `status`);

-- CreateIndex
CREATE INDEX `practice_completions_project_id_status_idx` ON `practice_completions`(`project_id`, `status`);

-- CreateIndex
CREATE INDEX `practice_projects_course_id_is_active_order_index_idx` ON `practice_projects`(`course_id`, `is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `progress_records_course_id_status_idx` ON `progress_records`(`course_id`, `status`);

-- CreateIndex
CREATE INDEX `progress_records_user_id_status_idx` ON `progress_records`(`user_id`, `status`);

-- CreateIndex
CREATE INDEX `progress_records_status_completed_at_idx` ON `progress_records`(`status`, `completed_at`);

-- CreateIndex
CREATE INDEX `quick_prompts_is_active_order_index_idx` ON `quick_prompts`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `quick_prompts_scope_is_active_order_index_idx` ON `quick_prompts`(`scope`, `is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `refresh_tokens_expires_at_idx` ON `refresh_tokens`(`expires_at`);

-- CreateIndex
CREATE INDEX `reviews_course_id_created_at_idx` ON `reviews`(`course_id`, `created_at`);

-- CreateIndex
CREATE INDEX `reviews_course_id_helpful_idx` ON `reviews`(`course_id`, `helpful`);

-- CreateIndex
CREATE INDEX `reviews_course_id_deleted_at_idx` ON `reviews`(`course_id`, `deleted_at`);

-- CreateIndex
CREATE INDEX `submissions_hackathon_id_status_idx` ON `submissions`(`hackathon_id`, `status`);

-- CreateIndex
CREATE INDEX `submissions_status_submitted_at_idx` ON `submissions`(`status`, `submitted_at`);

-- CreateIndex
CREATE INDEX `teams_captain_id_idx` ON `teams`(`captain_id`);

-- CreateIndex
CREATE INDEX `testimonials_is_active_order_index_idx` ON `testimonials`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `top_nav_items_is_active_order_index_idx` ON `top_nav_items`(`is_active`, `order_index`);

-- CreateIndex
CREATE INDEX `users_email_deleted_at_idx` ON `users`(`email`, `deleted_at`);

-- CreateIndex
CREATE INDEX `users_role_deleted_at_idx` ON `users`(`role`, `deleted_at`);

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_industry_id_fkey` FOREIGN KEY (`industry_id`) REFERENCES `industries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `course_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsors` ADD CONSTRAINT `sponsors_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `degree_courses` RENAME INDEX `degree_courses_course_id_fkey` TO `degree_courses_course_id_idx`;

-- RenameIndex
ALTER TABLE `hackathons` RENAME INDEX `hackathons_organizer_id_fkey` TO `hackathons_organizer_id_idx`;

-- RenameIndex
ALTER TABLE `progress_records` RENAME INDEX `progress_records_lesson_id_fkey` TO `progress_records_lesson_id_idx`;

-- RenameIndex
ALTER TABLE `submissions` RENAME INDEX `submissions_team_id_fkey` TO `submissions_team_id_idx`;

-- RenameIndex
ALTER TABLE `submissions` RENAME INDEX `submissions_user_id_fkey` TO `submissions_user_id_idx`;

-- RenameIndex
ALTER TABLE `teams` RENAME INDEX `teams_hackathon_id_fkey` TO `teams_hackathon_id_idx`;


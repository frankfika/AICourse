-- ============================================================================
-- AICourse Prisma schema translated to MySQL 8 DDL
-- Source: prisma/schema.prisma (1504 lines, 59 models, 35 enums)
-- Translation style: matches Prisma's own migration history exactly
--   - VARCHAR(191) for String (Prisma default, keeps utf8mb4 indexes under 3072B limit)
--   - DATETIME(3) for DateTime (millisecond precision)
--   - TEXT for @db.Text
--   - VARCHAR(n) for @db.VarChar(n)
--   - CHAR(n) for @db.Char(n)
--   - DECIMAL(p,s) for @db.Decimal(p,s)
--   - JSON for Json (MySQL 8 native JSON type, equivalent to Prisma's emit)
--   - ENUM('a','b',...) for enums (Prisma's existing production choice)
--   - BOOLEAN for Boolean
--   - INTEGER for Int
-- Index naming: <table>_<col1>_<col2>_idx
-- Unique naming: <table>_<col1>_<col2>_key
-- FK naming:    <table>_<col>_fkey
-- All tables: DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. users (User)
-- ============================================================================
CREATE TABLE `users` (
  `id`                    VARCHAR(191) NOT NULL,
  `email`                 VARCHAR(191) NOT NULL,
  `password_hash`         VARCHAR(191) NOT NULL,
  `name`                  VARCHAR(191) NOT NULL,
  `role`                  ENUM('admin', 'student', 'instructor') NOT NULL DEFAULT 'student',
  `avatar_url`            VARCHAR(191) NULL,
  `password_reset_required` BOOLEAN     NOT NULL DEFAULT false,
  `points`                INTEGER     NOT NULL DEFAULT 0,
  `level`                 INTEGER     NOT NULL DEFAULT 1,
  `deleted_at`            DATETIME(3) NULL,
  `created_at`            DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`            DATETIME(3) NOT NULL,
  `last_login_at`         DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `users_email_key`(`email`),
  INDEX `users_email_deleted_at_idx`(`email`, `deleted_at`),
  INDEX `users_role_deleted_at_idx`(`role`, `deleted_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 2. certificates (Certificate)
-- ============================================================================
CREATE TABLE `certificates` (
  `id`            VARCHAR(191) NOT NULL,
  `user_id`       VARCHAR(191) NOT NULL,
  `type`          ENUM('course', 'degree', 'hackathon') NOT NULL,
  `ref_id`        VARCHAR(191) NOT NULL,
  `title`         VARCHAR(191) NOT NULL,
  `description`   TEXT NULL,
  `serial_number` VARCHAR(191) NOT NULL,
  `issued_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at`  DATETIME(3) NOT NULL,
  `image_url`     VARCHAR(191) NULL,
  `verify_url`    VARCHAR(191) NULL,
  `metadata`      JSON NULL,
  `revoked_at`    DATETIME(3) NULL,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `certificates_serial_number_key`(`serial_number`),
  INDEX `certificates_user_id_type_idx`(`user_id`, `type`),
  INDEX `certificates_ref_id_type_idx`(`ref_id`, `type`),
  INDEX `certificates_serial_number_idx`(`serial_number`),
  CONSTRAINT `certificates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 3. refresh_tokens (RefreshToken)
-- ============================================================================
CREATE TABLE `refresh_tokens` (
  `id`         VARCHAR(191) NOT NULL,
  `token`      VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `refresh_tokens_token_key`(`token`),
  INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
  CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 4. password_reset_tokens (PasswordResetToken)
-- ============================================================================
CREATE TABLE `password_reset_tokens` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at`    DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
  INDEX `password_reset_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
  INDEX `password_reset_tokens_expires_at_used_at_idx`(`expires_at`, `used_at`),
  CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 5. user_provider_accounts (UserProviderAccount)
-- ============================================================================
CREATE TABLE `user_provider_accounts` (
  `id`              VARCHAR(191) NOT NULL,
  `user_id`         VARCHAR(191) NOT NULL,
  `provider`        VARCHAR(191) NOT NULL,
  `provider_user_id` VARCHAR(191) NOT NULL,
  `email`           VARCHAR(191) NULL,
  `display_name`    VARCHAR(191) NULL,
  `is_primary`      BOOLEAN NOT NULL DEFAULT false,
  `linked_at`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_used_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at`      DATETIME(3) NULL,
  `profile`         JSON NULL,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_provider_accounts_provider_provider_user_id_key`(`provider`, `provider_user_id`),
  INDEX `user_provider_accounts_user_id_idx`(`user_id`),
  INDEX `user_provider_accounts_user_id_deleted_at_idx`(`user_id`, `deleted_at`),
  CONSTRAINT `user_provider_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 6. courses (Course)
-- ============================================================================
CREATE TABLE `courses` (
  `id`              VARCHAR(191) NOT NULL,
  `title`           VARCHAR(191) NOT NULL,
  `description`     TEXT NOT NULL,
  `learning_points` TEXT NOT NULL,
  `instructor`      VARCHAR(191) NOT NULL,
  `level`           ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert') NOT NULL,
  `duration`        VARCHAR(191) NOT NULL,
  `thumbnail`       VARCHAR(191) NOT NULL,
  `tags`            TEXT NOT NULL,
  `cost_type`       ENUM('free', 'paid', 'charity') NOT NULL,
  `price`           DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `status`          ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  `course_type`     ENUM('own', 'partner', 'public', 'third_party') NOT NULL DEFAULT 'own',
  `external_url`    VARCHAR(191) NULL,
  `source_video_url` VARCHAR(191) NULL,
  `source_platform` VARCHAR(191) NULL,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  `industry_id`     VARCHAR(191) NULL,
  `category_id`     VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `courses_source_video_url_key`(`source_video_url`),
  INDEX `courses_status_created_at_idx`(`status`, `created_at`),
  INDEX `courses_cost_type_idx`(`cost_type`),
  INDEX `courses_course_type_idx`(`course_type`),
  INDEX `courses_level_idx`(`level`),
  INDEX `courses_created_at_idx`(`created_at`),
  INDEX `courses_industry_id_idx`(`industry_id`),
  INDEX `courses_category_id_idx`(`category_id`)
  -- FKs to industries / course_categories are added as ALTER TABLE at the end of file
  -- because those tables are created later in the DDL (forward reference)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 7. chapters (Chapter)
-- ============================================================================
CREATE TABLE `chapters` (
  `id`          VARCHAR(191) NOT NULL,
  `course_id`   VARCHAR(191) NOT NULL,
  `title`       VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `order_index` INTEGER NOT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at`  DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `chapters_course_id_deleted_at_idx`(`course_id`, `deleted_at`),
  CONSTRAINT `chapters_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 8. lessons (Lesson)
-- ============================================================================
CREATE TABLE `lessons` (
  `id`             VARCHAR(191) NOT NULL,
  `chapter_id`     VARCHAR(191) NOT NULL,
  `title`          VARCHAR(191) NOT NULL,
  `description`    TEXT NULL,
  `video_url`      VARCHAR(191) NULL,
  `video_duration` INTEGER NULL,
  `order_index`    INTEGER NOT NULL,
  `is_preview`     BOOLEAN NOT NULL DEFAULT false,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at`     DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `lessons_chapter_id_deleted_at_idx`(`chapter_id`, `deleted_at`),
  CONSTRAINT `lessons_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 9. resources (Resource)
-- ============================================================================
CREATE TABLE `resources` (
  `id`         VARCHAR(191) NOT NULL,
  `lesson_id`  VARCHAR(191) NOT NULL,
  `title`      VARCHAR(191) NOT NULL,
  `url`        VARCHAR(191) NOT NULL,
  `type`       ENUM('pdf', 'code', 'link', 'video', 'audio') NOT NULL,
  `is_locked`  BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `resources_lesson_id_deleted_at_idx`(`lesson_id`, `deleted_at`),
  CONSTRAINT `resources_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 10. instructors (Instructor)
-- ============================================================================
CREATE TABLE `instructors` (
  `id`                  VARCHAR(191) NOT NULL,
  `slug`                VARCHAR(191) NOT NULL,
  `name`                VARCHAR(191) NOT NULL,
  `name_en`             VARCHAR(191) NULL,
  `title`               VARCHAR(120) NULL,
  `title_en`            VARCHAR(120) NULL,
  `headline`            VARCHAR(255) NULL,
  `headline_en`         VARCHAR(255) NULL,
  `bio`                 TEXT NULL,
  `bio_en`              TEXT NULL,
  `avatar_url`          VARCHAR(191) NULL,
  `company`             VARCHAR(120) NULL,
  `years_of_experience` INTEGER NULL,
  `linkedin_url`        VARCHAR(191) NULL,
  `github_url`          VARCHAR(191) NULL,
  `twitter_url`         VARCHAR(191) NULL,
  `website_url`         VARCHAR(191) NULL,
  `contact_email`       VARCHAR(191) NULL,
  `notes`               TEXT NULL,
  `order_index`         INTEGER NOT NULL DEFAULT 0,
  `published_at`        DATETIME(3) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `instructors_slug_key`(`slug`),
  INDEX `instructors_published_at_order_index_idx`(`published_at`, `order_index`),
  INDEX `instructors_name_idx`(`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 11. course_instructor_links (CourseInstructorLink)
-- ============================================================================
CREATE TABLE `course_instructor_links` (
  `id`            VARCHAR(191) NOT NULL,
  `course_id`     VARCHAR(191) NOT NULL,
  `instructor_id` VARCHAR(191) NOT NULL,
  `role`          ENUM('instructor', 'mentor') NOT NULL DEFAULT 'instructor',
  `is_primary`    BOOLEAN NOT NULL DEFAULT false,
  `order_index`   INTEGER NOT NULL DEFAULT 0,
  `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `course_instructor_links_course_id_instructor_id_role_key`(`course_id`, `instructor_id`, `role`),
  INDEX `course_instructor_links_instructor_id_role_idx`(`instructor_id`, `role`),
  INDEX `course_instructor_links_course_id_is_primary_idx`(`course_id`, `is_primary`),
  CONSTRAINT `course_instructor_links_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `course_instructor_links_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 12. instructor_expertises (InstructorExpertise)
-- ============================================================================
CREATE TABLE `instructor_expertises` (
  `id`         VARCHAR(191) NOT NULL,
  `key`        VARCHAR(191) NOT NULL,
  `label`      VARCHAR(191) NOT NULL,
  `label_en`   VARCHAR(191) NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `instructor_expertises_key_key`(`key`),
  INDEX `instructor_expertises_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 13. instructor_expertise_links (InstructorExpertiseLink) — composite PK
-- ============================================================================
CREATE TABLE `instructor_expertise_links` (
  `instructor_id` VARCHAR(191) NOT NULL,
  `expertise_id`  VARCHAR(191) NOT NULL,
  `order_index`   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`instructor_id`, `expertise_id`),
  INDEX `instructor_expertise_links_expertise_id_idx`(`expertise_id`),
  CONSTRAINT `instructor_expertise_links_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `instructors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `instructor_expertise_links_expertise_id_fkey` FOREIGN KEY (`expertise_id`) REFERENCES `instructor_expertises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 14. nano_degrees (NanoDegree)
-- ============================================================================
CREATE TABLE `nano_degrees` (
  `id`              VARCHAR(191) NOT NULL,
  `title`           VARCHAR(191) NOT NULL,
  `description`     TEXT NOT NULL,
  `learning_points` TEXT NOT NULL,
  `price`           DECIMAL(10, 2) NOT NULL,
  `icon`            VARCHAR(191) NOT NULL DEFAULT 'sparkles',
  `cost_type`       ENUM('free', 'paid', 'charity') NOT NULL,
  `thumbnail`       VARCHAR(191) NULL,
  `status`          ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 15. degree_courses (DegreeCourse) — composite PK
-- ============================================================================
CREATE TABLE `degree_courses` (
  `degree_id`   VARCHAR(191) NOT NULL,
  `course_id`   VARCHAR(191) NOT NULL,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`degree_id`, `course_id`),
  INDEX `degree_courses_course_id_idx`(`course_id`),
  CONSTRAINT `degree_courses_degree_id_fkey` FOREIGN KEY (`degree_id`) REFERENCES `nano_degrees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `degree_courses_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 16. enrollments (Enrollment)
-- ============================================================================
CREATE TABLE `enrollments` (
  `id`          VARCHAR(191) NOT NULL,
  `user_id`     VARCHAR(191) NOT NULL,
  `course_id`   VARCHAR(191) NULL,
  `degree_id`   VARCHAR(191) NULL,
  `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at`  DATETIME(3) NULL,
  `source`      ENUM('direct', 'degree', 'hackathon', 'promotion', 'order') NOT NULL DEFAULT 'direct',
  `deleted_at`  DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `enrollments_user_id_course_id_key`(`user_id`, `course_id`),
  UNIQUE INDEX `enrollments_user_id_degree_id_key`(`user_id`, `degree_id`),
  INDEX `enrollments_user_id_deleted_at_idx`(`user_id`, `deleted_at`),
  INDEX `enrollments_course_id_deleted_at_idx`(`course_id`, `deleted_at`),
  CONSTRAINT `enrollments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `enrollments_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `enrollments_degree_id_fkey` FOREIGN KEY (`degree_id`) REFERENCES `nano_degrees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 17. orders (Order)
-- ============================================================================
CREATE TABLE `orders` (
  `id`              VARCHAR(191) NOT NULL,
  `user_id`         VARCHAR(191) NOT NULL,
  `type`            ENUM('course', 'degree') NOT NULL,
  `course_id`       VARCHAR(191) NULL,
  `degree_id`       VARCHAR(191) NULL,
  `amount`          DECIMAL(10, 2) NOT NULL,
  `currency`        VARCHAR(191) NOT NULL DEFAULT 'CNY',
  `status`          ENUM('pending', 'paid', 'failed', 'expired', 'refunded') NOT NULL DEFAULT 'pending',
  `payment_method`  ENUM('wechat', 'alipay', 'stripe') NULL,
  `transaction_id`  VARCHAR(191) NULL,
  `paid_at`         DATETIME(3) NULL,
  `deleted_at`      DATETIME(3) NULL,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `orders_user_id_status_created_at_idx`(`user_id`, `status`, `created_at`),
  INDEX `orders_user_id_created_at_idx`(`user_id`, `created_at`),
  INDEX `orders_status_paid_at_idx`(`status`, `paid_at`),
  INDEX `orders_transaction_id_idx`(`transaction_id`),
  CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `orders_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `orders_degree_id_fkey` FOREIGN KEY (`degree_id`) REFERENCES `nano_degrees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 18. hackathons (Hackathon)
-- ============================================================================
CREATE TABLE `hackathons` (
  `id`                     VARCHAR(191) NOT NULL,
  `title`                  VARCHAR(191) NOT NULL,
  `description`            TEXT NOT NULL,
  `banner_url`             VARCHAR(191) NULL,
  `status`                 ENUM('upcoming', 'active', 'judging', 'finished', 'cancelled') NOT NULL DEFAULT 'upcoming',
  `start_date`             DATETIME(3) NOT NULL,
  `end_date`               DATETIME(3) NOT NULL,
  `register_deadline`      DATETIME(3) NULL,
  `submission_deadline`    DATETIME(3) NULL,
  `max_team_size`          INTEGER NOT NULL DEFAULT 5,
  `min_team_size`          INTEGER NOT NULL DEFAULT 1,
  `location`               VARCHAR(191) NULL,
  `rules`                  TEXT NULL,
  `submission_requirements` TEXT NULL,
  `prizes`                 TEXT NULL,
  `registration_url`       VARCHAR(191) NULL,
  `registration_label`     VARCHAR(191) NULL,
  `organizer_id`           VARCHAR(191) NULL,
  `created_at`             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`             DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `hackathons_status_start_date_idx`(`status`, `start_date`),
  INDEX `hackathons_organizer_id_idx`(`organizer_id`),
  CONSTRAINT `hackathons_organizer_id_fkey` FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 19. hackathon_registrations (HackathonRegistration)
-- ============================================================================
CREATE TABLE `hackathon_registrations` (
  `id`            VARCHAR(191) NOT NULL,
  `hackathon_id`  VARCHAR(191) NOT NULL,
  `user_id`       VARCHAR(191) NOT NULL,
  `status`        ENUM('registered', 'cancelled', 'checked_in') NOT NULL DEFAULT 'registered',
  `registered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `checked_in_at` DATETIME(3) NULL,
  `deleted_at`    DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hackathon_registrations_hackathon_id_user_id_key`(`hackathon_id`, `user_id`),
  INDEX `hackathon_registrations_user_id_status_idx`(`user_id`, `status`),
  INDEX `hackathon_registrations_hackathon_id_status_idx`(`hackathon_id`, `status`),
  CONSTRAINT `hackathon_registrations_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hackathon_registrations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 20. teams (Team)
-- ============================================================================
CREATE TABLE `teams` (
  `id`          VARCHAR(191) NOT NULL,
  `hackathon_id` VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `slogan`      VARCHAR(191) NULL,
  `captain_id`  VARCHAR(191) NOT NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `teams_hackathon_id_idx`(`hackathon_id`),
  INDEX `teams_captain_id_idx`(`captain_id`),
  CONSTRAINT `teams_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 21. team_members (TeamMember)
-- ============================================================================
CREATE TABLE `team_members` (
  `id`     VARCHAR(191) NOT NULL,
  `team_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `role`   ENUM('captain', 'member') NOT NULL DEFAULT 'member',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `team_members_team_id_user_id_key`(`team_id`, `user_id`),
  CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 22. judges (Judge)
-- ============================================================================
CREATE TABLE `judges` (
  `id`          VARCHAR(191) NOT NULL,
  `hackathon_id` VARCHAR(191) NOT NULL,
  `user_id`     VARCHAR(191) NULL,
  `name`        VARCHAR(191) NOT NULL,
  `title`       VARCHAR(191) NULL,
  `avatar_url`  VARCHAR(191) NULL,
  `bio`         TEXT NULL,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  `role`        VARCHAR(191) NOT NULL DEFAULT 'judge',
  PRIMARY KEY (`id`),
  INDEX `judges_hackathon_id_order_index_idx`(`hackathon_id`, `order_index`),
  CONSTRAINT `judges_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 23. sponsors (Sponsor)
-- ============================================================================
CREATE TABLE `sponsors` (
  `id`          VARCHAR(191) NOT NULL,
  `hackathon_id` VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `logo_url`    VARCHAR(191) NULL,
  `website_url` VARCHAR(191) NULL,
  `tier`        VARCHAR(191) NOT NULL DEFAULT 'silver',
  `order_index` INTEGER NOT NULL DEFAULT 0,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `sponsors_hackathon_id_tier_order_index_idx`(`hackathon_id`, `tier`, `order_index`),
  CONSTRAINT `sponsors_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 24. submissions (Submission)
-- ============================================================================
CREATE TABLE `submissions` (
  `id`          VARCHAR(191) NOT NULL,
  `hackathon_id` VARCHAR(191) NOT NULL,
  `team_id`     VARCHAR(191) NULL,
  `user_id`     VARCHAR(191) NULL,
  `title`       VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `demo_url`    VARCHAR(191) NULL,
  `repo_url`    VARCHAR(191) NULL,
  `video_url`   VARCHAR(191) NULL,
  `status`      ENUM('draft', 'submitted', 'under_review', 'shortlisted', 'winner', 'rejected') NOT NULL DEFAULT 'draft',
  `score`       DECIMAL(5, 2) NULL,
  `feedback`    TEXT NULL,
  `submitted_at` DATETIME(3) NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  `deleted_at`  DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `submissions_hackathon_id_status_idx`(`hackathon_id`, `status`),
  INDEX `submissions_user_id_idx`(`user_id`),
  INDEX `submissions_team_id_idx`(`team_id`),
  INDEX `submissions_status_submitted_at_idx`(`status`, `submitted_at`),
  CONSTRAINT `submissions_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `submissions_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `submissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 25. announcements (Announcement)
-- ============================================================================
CREATE TABLE `announcements` (
  `id`          VARCHAR(191) NOT NULL,
  `hackathon_id` VARCHAR(191) NOT NULL,
  `title`       VARCHAR(191) NOT NULL,
  `content`     TEXT NOT NULL,
  `is_pinned`   BOOLEAN NOT NULL DEFAULT false,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `announcements_hackathon_id_is_pinned_created_at_idx`(`hackathon_id`, `is_pinned`, `created_at`),
  CONSTRAINT `announcements_hackathon_id_fkey` FOREIGN KEY (`hackathon_id`) REFERENCES `hackathons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 26. progress_records (ProgressRecord)
-- ============================================================================
CREATE TABLE `progress_records` (
  `id`            VARCHAR(191) NOT NULL,
  `user_id`       VARCHAR(191) NOT NULL,
  `course_id`     VARCHAR(191) NOT NULL,
  `lesson_id`     VARCHAR(191) NOT NULL,
  `status`        ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  `completed_at`  DATETIME(3) NULL,
  `last_position` INTEGER NULL,
  `updated_at`    DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `progress_records_user_id_lesson_id_key`(`user_id`, `lesson_id`),
  INDEX `progress_records_course_id_status_idx`(`course_id`, `status`),
  INDEX `progress_records_lesson_id_idx`(`lesson_id`),
  INDEX `progress_records_user_id_status_idx`(`user_id`, `status`),
  INDEX `progress_records_status_completed_at_idx`(`status`, `completed_at`),
  CONSTRAINT `progress_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `progress_records_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `progress_records_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 27. audit_logs (AuditLog)
-- ============================================================================
CREATE TABLE `audit_logs` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NULL,
  `action`     VARCHAR(191) NOT NULL,
  `entity`     VARCHAR(191) NOT NULL,
  `entity_id`  VARCHAR(191) NULL,
  `details`    TEXT NULL,
  `ip_address` VARCHAR(191) NULL,
  `user_agent` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
  INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
  INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
  CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 28. practice_projects (PracticeProject)
-- ============================================================================
CREATE TABLE `practice_projects` (
  `id`             VARCHAR(191) NOT NULL,
  `course_id`      VARCHAR(191) NOT NULL,
  `title`          VARCHAR(191) NOT NULL,
  `description`    TEXT NOT NULL,
  `project_url`    VARCHAR(191) NOT NULL,
  `thumbnail_url`  VARCHAR(191) NULL,
  `difficulty`     ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate',
  `estimated_time` INTEGER NOT NULL DEFAULT 30,
  `tags`           TEXT NULL,
  `project_type`   ENUM('model_deployment', 'model_training', 'model_inference', 'api_integration', 'notebook', 'sandbox', 'repository', 'csghub_space') NOT NULL,
  `order_index`    INTEGER NOT NULL DEFAULT 0,
  `requirements`   TEXT NULL,
  `objectives`     TEXT NULL,
  `is_active`      BOOLEAN NOT NULL DEFAULT true,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `practice_projects_course_id_is_active_order_index_idx`(`course_id`, `is_active`, `order_index`),
  CONSTRAINT `practice_projects_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 29. practice_completions (PracticeCompletion)
-- ============================================================================
CREATE TABLE `practice_completions` (
  `id`             VARCHAR(191) NOT NULL,
  `user_id`        VARCHAR(191) NOT NULL,
  `project_id`     VARCHAR(191) NOT NULL,
  `status`         ENUM('in_progress', 'completed', 'skipped') NOT NULL DEFAULT 'in_progress',
  `started_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at`   DATETIME(3) NULL,
  `submission_url` VARCHAR(191) NULL,
  `notes`          TEXT NULL,
  `deleted_at`     DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `practice_completions_user_id_project_id_key`(`user_id`, `project_id`),
  INDEX `practice_completions_user_id_status_idx`(`user_id`, `status`),
  INDEX `practice_completions_project_id_status_idx`(`project_id`, `status`),
  CONSTRAINT `practice_completions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `practice_completions_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `practice_projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 30. badges (Badge)
-- ============================================================================
CREATE TABLE `badges` (
  `id`             VARCHAR(191) NOT NULL,
  `code`           VARCHAR(191) NOT NULL,
  `name`           VARCHAR(191) NOT NULL,
  `description`    TEXT NOT NULL,
  `icon`           VARCHAR(191) NOT NULL DEFAULT 'award',
  `category`       VARCHAR(191) NOT NULL DEFAULT 'general',
  `criteria_type`  ENUM('course_completed', 'lessons_completed', 'streak_days', 'first_enrollment', 'practice_completed', 'points_reached', 'course_specific') NOT NULL,
  `criteria_value` INTEGER NOT NULL DEFAULT 1,
  `criteria_json`  JSON NULL,
  `points`         INTEGER NOT NULL DEFAULT 0,
  `is_active`      BOOLEAN NOT NULL DEFAULT true,
  `order_index`    INTEGER NOT NULL DEFAULT 0,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `badges_code_key`(`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 31. user_badges (UserBadge)
-- ============================================================================
CREATE TABLE `user_badges` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `badge_id`   VARCHAR(191) NOT NULL,
  `unlocked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_badges_user_id_badge_id_key`(`user_id`, `badge_id`),
  INDEX `user_badges_user_id_idx`(`user_id`),
  CONSTRAINT `user_badges_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_badges_badge_id_fkey` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 32. enterprise_inquiries (EnterpriseInquiry)
-- ============================================================================
CREATE TABLE `enterprise_inquiries` (
  `id`          VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,
  `email`       VARCHAR(191) NOT NULL,
  `company`     VARCHAR(191) NOT NULL,
  `team_size`   VARCHAR(191) NOT NULL,
  `phone`       VARCHAR(191) NULL,
  `topic`       VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status`      ENUM('pending', 'contacted', 'qualified', 'closed', 'archived') NOT NULL DEFAULT 'pending',
  `deleted_at`  DATETIME(3) NULL,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `enterprise_inquiries_status_created_at_idx`(`status`, `created_at`),
  INDEX `enterprise_inquiries_email_idx`(`email`),
  INDEX `enterprise_inquiries_deleted_at_idx`(`deleted_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 33. point_transactions (PointTransaction)
-- ============================================================================
CREATE TABLE `point_transactions` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `amount`     INTEGER NOT NULL,
  `reason`     VARCHAR(191) NOT NULL,
  `ref_type`   ENUM('lesson', 'practice', 'badge', 'enrollment') NULL,
  `ref_id`     VARCHAR(191) NULL,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `point_transactions_user_id_ref_type_ref_id_key`(`user_id`, `ref_type`, `ref_id`),
  INDEX `point_transactions_user_id_created_at_idx`(`user_id`, `created_at`),
  INDEX `point_transactions_user_id_deleted_at_idx`(`user_id`, `deleted_at`),
  CONSTRAINT `point_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 34. reviews (Review)
-- ============================================================================
CREATE TABLE `reviews` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `course_id`  VARCHAR(191) NOT NULL,
  `rating`     INTEGER NOT NULL,
  `content`    TEXT NOT NULL,
  `helpful`    INTEGER NOT NULL DEFAULT 0,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `reviews_user_id_course_id_key`(`user_id`, `course_id`),
  INDEX `reviews_course_id_created_at_idx`(`course_id`, `created_at`),
  INDEX `reviews_course_id_helpful_idx`(`course_id`, `helpful`),
  INDEX `reviews_course_id_deleted_at_idx`(`course_id`, `deleted_at`),
  CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `reviews_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 35. review_helpful_votes (ReviewHelpful) — composite PK
-- ============================================================================
CREATE TABLE `review_helpful_votes` (
  `review_id`  VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`review_id`, `user_id`),
  INDEX `review_helpful_votes_user_id_created_at_idx`(`user_id`, `created_at`),
  CONSTRAINT `review_helpful_votes_review_id_fkey` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `review_helpful_votes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 36. notes (Note)
-- ============================================================================
CREATE TABLE `notes` (
  `id`           VARCHAR(191) NOT NULL,
  `user_id`      VARCHAR(191) NOT NULL,
  `lesson_id`    VARCHAR(191) NOT NULL,
  `content`      TEXT NOT NULL,
  `position_sec` INTEGER NULL,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`   DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `notes_user_id_lesson_id_position_sec_idx`(`user_id`, `lesson_id`, `position_sec`),
  CONSTRAINT `notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `notes_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 37. notifications (Notification)
-- ============================================================================
CREATE TABLE `notifications` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `type`       ENUM('announcement', 'comment', 'hackathon', 'order') NOT NULL,
  `title`      VARCHAR(191) NOT NULL,
  `body`       TEXT NOT NULL,
  `link_url`   VARCHAR(191) NULL,
  `is_read`    BOOLEAN NOT NULL DEFAULT false,
  `read_at`    DATETIME(3) NULL,
  `deleted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `notifications_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at`),
  INDEX `notifications_user_id_deleted_at_created_at_idx`(`user_id`, `deleted_at`, `created_at`),
  CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 38. chat_sessions (ChatSession)
-- ============================================================================
CREATE TABLE `chat_sessions` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `lesson_id`  VARCHAR(191) NULL,
  `title`      VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `chat_sessions_user_id_lesson_id_idx`(`user_id`, `lesson_id`),
  INDEX `chat_sessions_user_id_updated_at_idx`(`user_id`, `updated_at`),
  CONSTRAINT `chat_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chat_sessions_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 39. chat_messages (ChatMessage)
-- ============================================================================
CREATE TABLE `chat_messages` (
  `id`         VARCHAR(191) NOT NULL,
  `session_id` VARCHAR(191) NOT NULL,
  `role`       ENUM('user', 'assistant', 'system') NOT NULL,
  `content`    TEXT NOT NULL,
  `tokens`     INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `chat_messages_session_id_created_at_idx`(`session_id`, `created_at`),
  CONSTRAINT `chat_messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 40. learning_events (LearningEvent)
-- ============================================================================
CREATE TABLE `learning_events` (
  `id`           VARCHAR(191) NOT NULL,
  `user_id`      VARCHAR(191) NOT NULL,
  `lesson_id`    VARCHAR(191) NULL,
  `event_type`   ENUM('play', 'pause', 'seek', 'complete', 'replay', 'skip', 'note') NOT NULL,
  `position_sec` INTEGER NULL,
  `duration_ms`  INTEGER NULL,
  `metadata`     JSON NULL,
  `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `learning_events_user_id_created_at_idx`(`user_id`, `created_at`),
  INDEX `learning_events_lesson_id_event_type_idx`(`lesson_id`, `event_type`),
  CONSTRAINT `learning_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `learning_events_lesson_id_fkey` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 41. ai_usage (AiUsage)
-- ============================================================================
CREATE TABLE `ai_usage` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `feature`    VARCHAR(191) NOT NULL,
  `tokens_in`  INTEGER NOT NULL DEFAULT 0,
  `tokens_out` INTEGER NOT NULL DEFAULT 0,
  `cost`       DECIMAL(10, 4) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `ai_usage_user_id_created_at_idx`(`user_id`, `created_at`),
  INDEX `ai_usage_feature_created_at_idx`(`feature`, `created_at`),
  INDEX `ai_usage_user_id_deleted_at_idx`(`user_id`, `deleted_at`),
  CONSTRAINT `ai_usage_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 42. ai_configs (AiConfig)
-- ============================================================================
CREATE TABLE `ai_configs` (
  `id`         VARCHAR(191) NOT NULL,
  `provider`   VARCHAR(191) NOT NULL,
  `api_key_enc` TEXT NOT NULL,
  `model`      VARCHAR(191) NOT NULL,
  `base_url`   VARCHAR(191) NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ai_configs_provider_key`(`provider`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 43. user_ai_provider_configs (UserAiProviderConfig)
-- ============================================================================
CREATE TABLE `user_ai_provider_configs` (
  `id`         VARCHAR(191) NOT NULL,
  `user_id`    VARCHAR(191) NOT NULL,
  `provider`   VARCHAR(191) NOT NULL,
  `api_key_enc` TEXT NOT NULL,
  `model`      VARCHAR(191) NOT NULL,
  `base_url`   VARCHAR(191) NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_ai_provider_configs_user_id_provider_key`(`user_id`, `provider`),
  INDEX `user_ai_provider_configs_user_id_is_active_idx`(`user_id`, `is_active`),
  CONSTRAINT `user_ai_provider_configs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 44. app_settings (AppSetting) — String @id (key)
-- ============================================================================
CREATE TABLE `app_settings` (
  `key`         VARCHAR(191) NOT NULL,
  `value_json`  JSON NOT NULL,
  `scope`       ENUM('global', 'page', 'user') NOT NULL DEFAULT 'global',
  `description` TEXT NULL,
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 45. enum_translations (EnumTranslation) — composite PK
-- ============================================================================
CREATE TABLE `enum_translations` (
  `enum_type`   VARCHAR(191) NOT NULL,
  `enum_value`  VARCHAR(191) NOT NULL,
  `locale`      VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
  `label`       VARCHAR(191) NOT NULL,
  `color_class` VARCHAR(191) NULL,
  `icon`        VARCHAR(191) NULL,
  `sort_order`  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`enum_type`, `enum_value`, `locale`),
  INDEX `enum_translations_enum_type_locale_idx`(`enum_type`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 46. date_format_templates (DateFormatTemplate) — composite PK
-- ============================================================================
CREATE TABLE `date_format_templates` (
  `scope`    ENUM('global', 'locale', 'admin_users_list', 'common_date', 'dashboard_lesson_duration') NOT NULL,
  `locale`   VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
  `template` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`scope`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 47. site_settings (SiteSetting) — String @id (key)
-- ============================================================================
CREATE TABLE `site_settings` (
  `key`         VARCHAR(191) NOT NULL,
  `value`       JSON NOT NULL,
  `scope`       ENUM('global', 'page', 'user') NOT NULL DEFAULT 'global',
  `description` TEXT NULL,
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 48. page_settings (PageSetting) — composite PK
-- ============================================================================
CREATE TABLE `page_settings` (
  `page`        VARCHAR(191) NOT NULL,
  `key`         VARCHAR(191) NOT NULL,
  `value`       JSON NOT NULL,
  `description` TEXT NULL,
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`page`, `key`),
  INDEX `page_settings_page_idx`(`page`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 49. industries (Industry)
-- ============================================================================
CREATE TABLE `industries` (
  `id`          VARCHAR(191) NOT NULL,
  `key`         VARCHAR(191) NOT NULL,
  `label`       VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `icon`        VARCHAR(191) NULL,
  `methodology` JSON NULL,
  `is_active`   BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `industries_key_key`(`key`),
  INDEX `industries_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 50. enterprise_methods (EnterpriseMethod)
-- ============================================================================
CREATE TABLE `enterprise_methods` (
  `id`         VARCHAR(191) NOT NULL,
  `num`        VARCHAR(191) NOT NULL,
  `title`      VARCHAR(191) NOT NULL,
  `desc`       TEXT NOT NULL,
  `bullets`    JSON NOT NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `enterprise_methods_num_key`(`num`),
  INDEX `enterprise_methods_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 51. testimonials (Testimonial)
-- ============================================================================
CREATE TABLE `testimonials` (
  `id`         VARCHAR(191) NOT NULL,
  `name`       VARCHAR(191) NOT NULL,
  `title`      VARCHAR(191) NOT NULL,
  `quote`      TEXT NOT NULL,
  `avatar`     VARCHAR(191) NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `testimonials_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 52. quick_prompts (QuickPrompt)
-- ============================================================================
CREATE TABLE `quick_prompts` (
  `id`          VARCHAR(191) NOT NULL,
  `emoji`       VARCHAR(191) NOT NULL DEFAULT '💡',
  `label`       VARCHAR(191) NOT NULL,
  `prompt_text` TEXT NOT NULL,
  `scope`       ENUM('lesson', 'course', 'degree', 'global') NOT NULL DEFAULT 'lesson',
  `is_active`   BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `quick_prompts_is_active_order_index_idx`(`is_active`, `order_index`),
  INDEX `quick_prompts_scope_is_active_order_index_idx`(`scope`, `is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 53. course_categories (CourseCategory)
-- ============================================================================
CREATE TABLE `course_categories` (
  `id`         VARCHAR(191) NOT NULL,
  `key`        VARCHAR(191) NOT NULL,
  `label`      VARCHAR(191) NOT NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `course_categories_key_key`(`key`),
  INDEX `course_categories_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 54. popular_searches (PopularSearch)
-- ============================================================================
CREATE TABLE `popular_searches` (
  `id`         VARCHAR(191) NOT NULL,
  `keyword`    VARCHAR(191) NOT NULL,
  `click_count` INTEGER NOT NULL DEFAULT 0,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `popular_searches_keyword_key`(`keyword`),
  INDEX `popular_searches_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 55. hot_keywords (HotKeyword)
-- ============================================================================
CREATE TABLE `hot_keywords` (
  `id`         VARCHAR(191) NOT NULL,
  `keyword`    VARCHAR(191) NOT NULL,
  `scope`      ENUM('courses', 'home', 'search', 'all') NOT NULL DEFAULT 'courses',
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `hot_keywords_keyword_key`(`keyword`),
  INDEX `hot_keywords_scope_is_active_order_index_idx`(`scope`, `is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 56. auth_providers (AuthProvider) — String @id (no default; provided)
-- ============================================================================
CREATE TABLE `auth_providers` (
  `id`         VARCHAR(191) NOT NULL,
  `label`      VARCHAR(191) NOT NULL,
  `icon`       VARCHAR(191) NOT NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT false,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  `config`     JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `auth_providers_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 57. top_nav_items (TopNavItem)
-- ============================================================================
CREATE TABLE `top_nav_items` (
  `id`         VARCHAR(191) NOT NULL,
  `label`      VARCHAR(191) NOT NULL,
  `path`       VARCHAR(191) NOT NULL,
  `icon`       VARCHAR(191) NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `top_nav_items_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 58. footer_columns (FooterColumn)
-- ============================================================================
CREATE TABLE `footer_columns` (
  `id`         VARCHAR(191) NOT NULL,
  `title`      VARCHAR(191) NOT NULL,
  `links`      JSON NOT NULL,
  `is_active`  BOOLEAN NOT NULL DEFAULT true,
  `order_index` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `footer_columns_is_active_order_index_idx`(`is_active`, `order_index`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 59. i18n_messages (I18nMessage) — composite PK
-- ============================================================================
CREATE TABLE `i18n_messages` (
  `key`      VARCHAR(255) NOT NULL,
  `locale`   VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
  `value`    TEXT NOT NULL,
  `category` ENUM('common', 'auth', 'course', 'hackathon', 'degree', 'enterprise', 'admin') NOT NULL DEFAULT 'common',
  PRIMARY KEY (`key`, `locale`),
  INDEX `i18n_messages_category_idx`(`category`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 60. url_imports (T22 — URL-based course import task tracking)
-- ============================================================================
-- Tracks each URL-import request submitted by an admin. T22.1 extends
-- the table with the columns needed for real metadata extraction
-- (YouTube oEmbed / Bilibili view API) + Gemini course-draft generation:
--   title / author / thumbnail_url / duration_seconds / extracted_json
--   + the 'fetched' / 'imported' status enum values.
-- ON DELETE SET NULL on requested_by so the import record survives
-- user soft-delete (audit trail).
CREATE TABLE `url_imports` (
  `id`             VARCHAR(191) NOT NULL,
  `url`            VARCHAR(2048) NOT NULL,
  `platform`       ENUM('youtube', 'bilibili', 'unknown') NOT NULL DEFAULT 'unknown',
  `status`         ENUM('pending', 'fetched', 'imported', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `requested_by`   VARCHAR(191) NULL,
  `result_course_id` VARCHAR(191) NULL,
  `error_message`  TEXT NULL,
  `title`          VARCHAR(500) NULL,
  `author`         VARCHAR(255) NULL,
  `thumbnail_url`  VARCHAR(2048) NULL,
  `duration_seconds` INT NULL,
  -- T22.1: stores the raw upstream JSON (YouTube oEmbed or Bilibili
  -- view API response). Kept as TEXT rather than JSON to dodge
  -- MySQL's strict JSON-null handling in the Go driver (sqlc maps
  -- JSON columns to json.RawMessage, which doesn't Scan NULL cleanly).
  `extracted_json` TEXT NULL,
  `fetched_at`     DATETIME(3) NULL,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `url_imports_status_created_at_idx`(`status`, `created_at`),
  INDEX `url_imports_requested_by_idx`(`requested_by`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- Deferred FK constraints (added after referenced tables exist)
-- ============================================================================
ALTER TABLE `courses`
  ADD CONSTRAINT `courses_industry_id_fkey`
    FOREIGN KEY (`industry_id`) REFERENCES `industries`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `courses_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `course_categories`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- url_imports.requested_by → users.id (SET NULL on user delete, keep audit row)
ALTER TABLE `url_imports`
  ADD CONSTRAINT `url_imports_requested_by_fkey`
    FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `url_imports_result_course_id_fkey`
    FOREIGN KEY (`result_course_id`) REFERENCES `courses`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

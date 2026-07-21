-- CreateTable
CREATE TABLE `app_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value_json` JSON NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'global',
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enum_translations` (
    `enum_type` VARCHAR(191) NOT NULL,
    `enum_value` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `label` VARCHAR(191) NOT NULL,
    `color_class` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `enum_translations_enum_type_locale_idx`(`enum_type`, `locale`),
    PRIMARY KEY (`enum_type`, `enum_value`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `date_format_templates` (
    `scope` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `template` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`scope`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'global',
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_settings` (
    `page` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `page_settings_page_idx`(`page`),
    PRIMARY KEY (`page`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `industries` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(191) NULL,
    `methodology` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `industries_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprise_methods` (
    `id` VARCHAR(191) NOT NULL,
    `num` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `desc` TEXT NOT NULL,
    `bullets` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `quote` TEXT NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quick_prompts` (
    `id` VARCHAR(191) NOT NULL,
    `emoji` VARCHAR(191) NOT NULL DEFAULT '💡',
    `label` VARCHAR(191) NOT NULL,
    `prompt_text` TEXT NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'lesson',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_categories` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `course_categories_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `popular_searches` (
    `id` VARCHAR(191) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `click_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `popular_searches_keyword_key`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hot_keywords` (
    `id` VARCHAR(191) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'courses',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_providers` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `top_nav_items` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `footer_columns` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `links` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `i18n_messages` (
    `key` VARCHAR(255) NOT NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'zh-CN',
    `value` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'common',

    INDEX `i18n_messages_category_idx`(`category`),
    PRIMARY KEY (`key`, `locale`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


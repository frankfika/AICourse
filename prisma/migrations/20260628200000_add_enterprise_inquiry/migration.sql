-- CreateTable
CREATE TABLE `enterprise_inquiries` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `company` VARCHAR(191) NOT NULL,
  `teamSize` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `topic` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('pending', 'contacted', 'qualified', 'closed', 'archived') NOT NULL DEFAULT 'pending',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

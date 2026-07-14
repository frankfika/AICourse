-- CreateTable
CREATE TABLE `certificates` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `ref_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `serial_number` VARCHAR(191) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NOT NULL,
    `image_url` VARCHAR(191) NULL,
    `verify_url` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `certificates_serial_number_key`(`serial_number`),
    INDEX `certificates_user_id_type_idx`(`user_id`, `type`),
    INDEX `certificates_ref_id_type_idx`(`ref_id`, `type`),
    INDEX `certificates_serial_number_idx`(`serial_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `review_helpful_votes` (
  `review_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`review_id`, `user_id`),
  INDEX `review_helpful_votes_user_id_created_at_idx` (`user_id`, `created_at`),
  CONSTRAINT `review_helpful_votes_review_id_fkey`
    FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `review_helpful_votes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notes` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `lesson_id` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `position_sec` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `notes_user_id_lesson_id_position_sec_idx`
    (`user_id`, `lesson_id`, `position_sec`),
  CONSTRAINT `notes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `notes_lesson_id_fkey`
    FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `hackathons` ADD COLUMN `organizer_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `hackathons` ADD CONSTRAINT `hackathons_organizer_id_fkey` FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


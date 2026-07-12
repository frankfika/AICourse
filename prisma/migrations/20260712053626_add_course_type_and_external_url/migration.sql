/*
  Warnings:

  - You are about to alter the column `source_video_url` on the `courses` table. The data in that column could be lost. The data in that column will be cast from `VarChar(500)` to `VarChar(191)`.
  - You are about to drop the column `teamSize` on the `enterprise_inquiries` table. All the data in the column will be lost.
  - Added the required column `team_size` to the `enterprise_inquiries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `courses` ADD COLUMN `course_type` ENUM('own', 'partner', 'public', 'third_party') NOT NULL DEFAULT 'own',
    ADD COLUMN `external_url` VARCHAR(191) NULL,
    MODIFY `source_video_url` VARCHAR(191) NULL,
    MODIFY `source_platform` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `enterprise_inquiries` DROP COLUMN `teamSize`,
    ADD COLUMN `team_size` VARCHAR(191) NOT NULL;

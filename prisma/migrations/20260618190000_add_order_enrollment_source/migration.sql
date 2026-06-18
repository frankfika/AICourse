-- AlterEnum
ALTER TABLE `enrollments` MODIFY `source` ENUM('direct', 'degree', 'hackathon', 'promotion', 'order') NOT NULL DEFAULT 'direct';
ALTER TABLE `hackathons`
  ADD COLUMN `submission_deadline` DATETIME(3) NULL,
  ADD COLUMN `submission_requirements` TEXT NULL;

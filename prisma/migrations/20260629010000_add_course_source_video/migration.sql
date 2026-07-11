-- Add sourceVideoUrl and sourcePlatform columns for the URL import feature.
ALTER TABLE `courses`
  ADD COLUMN `source_video_url` VARCHAR(500) NULL,
  ADD COLUMN `source_platform`  VARCHAR(20)  NULL,
  ADD UNIQUE INDEX `courses_source_video_url_key` (`source_video_url`);
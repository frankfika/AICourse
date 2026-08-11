-- name: UploadSetLessonVideo :execrows
UPDATE lessons SET video_url = ? WHERE id = ? AND deleted_at IS NULL;

-- name: UploadSetResourceUrl :execrows
UPDATE resources SET url = ? WHERE id = ? AND deleted_at IS NULL;

-- name: UploadSetCourseThumbnail :execrows
UPDATE courses SET thumbnail = ? WHERE id = ?;

-- name: UploadSetDegreeThumbnail :execrows
UPDATE nano_degrees SET thumbnail = ? WHERE id = ?;

-- name: UploadSetHackathonBanner :execrows
UPDATE hackathons SET banner_url = ? WHERE id = ?;

-- name: UploadSetJudgeAvatar :execrows
UPDATE judges SET avatar_url = ? WHERE id = ?;

-- name: UploadSetSponsorLogo :execrows
UPDATE sponsors SET logo_url = ? WHERE id = ?;

-- name: UploadSetSubmissionVideo :execrows
UPDATE submissions SET video_url = ? WHERE id = ? AND deleted_at IS NULL;

-- name: UploadSetUserAvatar :execrows
UPDATE users SET avatar_url = ? WHERE id = ? AND deleted_at IS NULL;

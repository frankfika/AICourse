// Package uploads — scope configuration. Mirrors
// apps/api/src/modules/uploads/uploads.config.ts.
//
// 9 scopes cover 4 entity groups:
//  1. 课程内容 (admin):  lesson-video / resource / course-thumbnail
//  2. 学位 (admin):       degree-thumbnail
//  3. 黑客松 (admin / participant): hackathon-banner / hackathon-judge-avatar /
//     hackathon-sponsor-logo / submission-video
//  4. 用户 (self / admin): user-avatar
//
// Adding a new scope: add a row to UPLOAD_SCOPES + extend the writeback
// switch in uploads.go + (optional) extend the sign-existence check.
package uploads

// UploadScope is the public enum of allowed upload scopes.
type UploadScope string

const (
	ScopeLessonVideo          UploadScope = "lesson-video"
	ScopeResource             UploadScope = "resource"
	ScopeCourseThumbnail      UploadScope = "course-thumbnail"
	ScopeDegreeThumbnail      UploadScope = "degree-thumbnail"
	ScopeHackathonBanner      UploadScope = "hackathon-banner"
	ScopeHackathonJudgeAvatar UploadScope = "hackathon-judge-avatar"
	ScopeHackathonSponsorLogo UploadScope = "hackathon-sponsor-logo"
	ScopeSubmissionVideo      UploadScope = "submission-video"
	ScopeUserAvatar           UploadScope = "user-avatar"
)

// IsValid returns true if the scope is a known scope.
func (s UploadScope) IsValid() bool {
	switch s {
	case ScopeLessonVideo, ScopeResource, ScopeCourseThumbnail, ScopeDegreeThumbnail,
		ScopeHackathonBanner, ScopeHackathonJudgeAvatar, ScopeHackathonSponsorLogo,
		ScopeSubmissionVideo, ScopeUserAvatar:
		return true
	}
	return false
}

// ScopeConfig is the static config for a single upload scope.
type ScopeConfig struct {
	KeyPrefix     string
	AllowedRoles  []string // "admin" | "student" | "instructor"
	MaxSizeMB     int32
	AllowedMime   []string
	PresignTTLSec int32
	PublicRead    bool
	Description   string
}

// UPLOAD_SCOPES — port of apps/api/src/modules/uploads/uploads.config.ts UPLOAD_SCOPES.
// 1:1 with the NestJS table.
var UPLOAD_SCOPES = map[UploadScope]ScopeConfig{
	ScopeLessonVideo: {
		KeyPrefix:     "lessons/videos",
		AllowedRoles:  []string{"admin"},
		MaxSizeMB:     500,
		AllowedMime:   []string{"video/mp4", "video/webm", "video/quicktime", "video/x-matroska"},
		PresignTTLSec: 15 * 60,
		PublicRead:    true,
		Description:   "课时视频 (mp4/webm/mov/mkv, max 500MB)",
	},
	ScopeResource: {
		KeyPrefix:    "lessons/resources",
		AllowedRoles: []string{"admin"},
		MaxSizeMB:    100,
		AllowedMime: []string{
			"application/pdf",
			"application/zip",
			"application/x-tar",
			"application/gzip",
			"video/mp4",
			"audio/mpeg",
			"audio/wav",
			"text/plain",
			"text/markdown",
		},
		PresignTTLSec: 15 * 60,
		PublicRead:    true,
		Description:   "课时资源 (pdf/zip/视频/音频, max 100MB)",
	},
	ScopeCourseThumbnail: {
		KeyPrefix:     "courses/thumbnails",
		AllowedRoles:  []string{"admin"},
		MaxSizeMB:     5,
		AllowedMime:   []string{"image/jpeg", "image/png", "image/webp"},
		PresignTTLSec: 10 * 60,
		PublicRead:    true,
		Description:   "课程封面 (jpg/png/webp, max 5MB)",
	},
	ScopeDegreeThumbnail: {
		KeyPrefix:     "degrees/thumbnails",
		AllowedRoles:  []string{"admin"},
		MaxSizeMB:     5,
		AllowedMime:   []string{"image/jpeg", "image/png", "image/webp"},
		PresignTTLSec: 10 * 60,
		PublicRead:    true,
		Description:   "学位封面 (jpg/png/webp, max 5MB)",
	},
	ScopeHackathonBanner: {
		KeyPrefix:     "hackathons/banners",
		AllowedRoles:  []string{"admin"},
		MaxSizeMB:     8,
		AllowedMime:   []string{"image/jpeg", "image/png", "image/webp"},
		PresignTTLSec: 10 * 60,
		PublicRead:    true,
		Description:   "黑客松 banner (jpg/png/webp, max 8MB)",
	},
	ScopeHackathonJudgeAvatar: {
		KeyPrefix:     "hackathons/judges/avatars",
		AllowedRoles:  []string{"admin"},
		MaxSizeMB:     3,
		AllowedMime:   []string{"image/jpeg", "image/png", "image/webp"},
		PresignTTLSec: 10 * 60,
		PublicRead:    true,
		Description:   "评委头像 (jpg/png/webp, max 3MB)",
	},
	ScopeHackathonSponsorLogo: {
		KeyPrefix:     "hackathons/sponsors/logos",
		AllowedRoles:  []string{"admin"},
		MaxSizeMB:     3,
		AllowedMime:   []string{"image/jpeg", "image/png", "image/webp"},
		PresignTTLSec: 10 * 60,
		PublicRead:    true,
		Description:   "赞助商 logo (jpg/png/webp, max 3MB)",
	},
	ScopeSubmissionVideo: {
		KeyPrefix:     "hackathons/submissions/videos",
		AllowedRoles:  []string{"student", "admin", "instructor"},
		MaxSizeMB:     200,
		AllowedMime:   []string{"video/mp4", "video/webm", "video/quicktime"},
		PresignTTLSec: 15 * 60,
		PublicRead:    true,
		Description:   "黑客松作品 demo 视频 (team member 可传, max 200MB)",
	},
	ScopeUserAvatar: {
		KeyPrefix:     "users/avatars",
		AllowedRoles:  []string{"student", "admin", "instructor"},
		MaxSizeMB:     2,
		AllowedMime:   []string{"image/jpeg", "image/png", "image/webp"},
		PresignTTLSec: 10 * 60,
		PublicRead:    true,
		Description:   "用户头像 (jpg/png/webp, max 2MB)",
	},
}

// GetScope returns the scope config or false.
func GetScope(s UploadScope) (ScopeConfig, bool) {
	cfg, ok := UPLOAD_SCOPES[s]
	return cfg, ok
}

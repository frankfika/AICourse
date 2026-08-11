// Package uploads — sign + complete service. Mirrors
// apps/api/src/modules/uploads/uploads.service.ts.
//
// Phase 2 T16-3. 2 endpoints:
//
//	POST /uploads/sign     auth
//	POST /uploads/complete auth
//
// sign flow:
//  1. validate scope + role + mime + size
//  2. (optional) validate refId exists
//  3. generate key = `<keyPrefix>/<userId>/<ts>-<rand><ext>`
//  4. call storage.presignUpload
//
// complete flow:
//  1. validate scope + role
//  2. validate key starts with `<keyPrefix>/<userId>/`
//  3. headObject (must exist + pass mime/size re-check)
//  4. (optional) writeback publicUrl to entity column
//
// See apps/api/src/modules/uploads/uploads.service.ts for the canonical
// reference; this is a 1:1 port.
package uploads

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
)

// Repo is the uploads data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// Service is the uploads business logic.
type Service struct {
	repo    *Repo
	storage Storage
	log     *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, storage Storage, log *zap.Logger) *Service {
	return &Service{repo: repo, storage: storage, log: log}
}

// SignInput is the public shape of the /uploads/sign request body.
type SignInput struct {
	Scope    string
	Filename string
	MimeType string
	Size     int64
	RefID    string // optional
}

// SignOutput is the response from sign.
type SignOutput struct {
	UploadURL string `json:"uploadUrl"`
	PublicURL string `json:"publicUrl"`
	Key       string `json:"key"`
	ExpiresIn int32  `json:"expiresIn"`
	Scope     string `json:"scope"`
}

// Sign generates a presigned upload URL.
func (s *Service) Sign(ctx context.Context, userID, userRole string, in SignInput) (SignOutput, error) {
	scope := UploadScope(in.Scope)
	if !scope.IsValid() {
		return SignOutput{}, errs.BadRequest("Unknown upload scope: " + in.Scope)
	}
	cfg := UPLOAD_SCOPES[scope]

	// Role check
	if !roleAllowed(cfg.AllowedRoles, userRole) {
		return SignOutput{}, errs.Forbidden(fmt.Sprintf("Role %s 不允许上传 %s (需要: %v)", userRole, in.Scope, cfg.AllowedRoles))
	}
	// Mime check
	if !mimeAllowed(cfg.AllowedMime, in.MimeType) {
		return SignOutput{}, errs.BadRequest(fmt.Sprintf("%s 不接受 %s (允许: %v)", in.Scope, in.MimeType, cfg.AllowedMime))
	}
	// Size check
	maxBytes := int64(cfg.MaxSizeMB) * 1024 * 1024
	if in.Size > maxBytes {
		return SignOutput{}, errs.BadRequest(fmt.Sprintf("%s 文件 %d 字节超过上限 %dMB", in.Scope, in.Size, cfg.MaxSizeMB))
	}
	// refId check (fail-fast)
	if in.RefID != "" {
		if err := s.validateRefIDForSign(ctx, scope, in.RefID, userID, userRole); err != nil {
			return SignOutput{}, err
		}
	}

	key := generateKey(cfg.KeyPrefix, userID, in.Filename)
	presign, err := s.storage.PresignUpload(ctx, key, in.MimeType, in.Size, cfg.PresignTTLSec)
	if err != nil {
		return SignOutput{}, errs.Internal("presign upload", err)
	}
	s.log.Info("upload sign",
		zap.String("userId", userID),
		zap.String("scope", in.Scope),
		zap.String("key", key),
		zap.Int64("size", in.Size),
	)
	return SignOutput{
		UploadURL: presign.UploadURL,
		PublicURL: presign.PublicURL,
		Key:       key,
		ExpiresIn: presign.ExpiresIn,
		Scope:     in.Scope,
	}, nil
}

// CompleteInput is the public shape of the /uploads/complete request body.
type CompleteInput struct {
	Scope string
	Key   string
	RefID string // optional
}

// CompleteOutput is the response from complete.
type CompleteOutput struct {
	URL         string `json:"url"`
	PublicURL   string `json:"publicUrl"`
	Key         string `json:"key"`
	WrittenBack bool   `json:"writtenBack"`
}

// Complete confirms an upload and (optionally) writes the publicUrl
// to the target entity column.
func (s *Service) Complete(ctx context.Context, userID, userRole string, in CompleteInput) (CompleteOutput, error) {
	scope := UploadScope(in.Scope)
	if !scope.IsValid() {
		return CompleteOutput{}, errs.BadRequest("Unknown upload scope: " + in.Scope)
	}
	cfg := UPLOAD_SCOPES[scope]

	// Key ownership check
	if !strings.HasPrefix(in.Key, cfg.KeyPrefix+"/"+userID+"/") {
		return CompleteOutput{}, errs.Forbidden("该上传 key 不属于当前用户")
	}
	// Role check (mirror sign)
	if !roleAllowed(cfg.AllowedRoles, userRole) {
		return CompleteOutput{}, errs.Forbidden(fmt.Sprintf("Role %s 不允许 %s (需要: %v)", userRole, in.Scope, cfg.AllowedRoles))
	}
	// headObject — confirm PUT actually happened
	meta, err := s.storage.HeadObject(ctx, in.Key)
	if err != nil {
		if errors.Is(err, ErrObjectNotFound) {
			return CompleteOutput{}, errs.NotFound("上传 object 不存在: " + in.Key + " (前端可能未完成 PUT)")
		}
		return CompleteOutput{}, errs.Internal("head object", err)
	}
	// Re-validate object meta vs scope limits
	if meta.Size <= 0 {
		_ = s.storage.DeleteObject(ctx, in.Key)
		return CompleteOutput{}, errs.BadRequest("上传文件为空")
	}
	if meta.Size > int64(cfg.MaxSizeMB)*1024*1024 {
		_ = s.storage.DeleteObject(ctx, in.Key)
		return CompleteOutput{}, errs.BadRequest(fmt.Sprintf("%s 实际文件 %d 字节超过上限 %dMB", in.Scope, meta.Size, cfg.MaxSizeMB))
	}
	actualCT := strings.ToLower(strings.SplitN(meta.ContentType, ";", 2)[0])
	if !mimeAllowed(cfg.AllowedMime, actualCT) {
		_ = s.storage.DeleteObject(ctx, in.Key)
		return CompleteOutput{}, errs.BadRequest(fmt.Sprintf("%s 实际文件类型 %s 不被允许", in.Scope, meta.ContentType))
	}

	publicURL := s.storage.GetPublicUrlBase() + "/" + in.Key

	// Writeback
	writtenBack := false
	if in.RefID != "" {
		ok, err := s.routeWriteback(ctx, scope, in.RefID, publicURL, userID, userRole)
		if err != nil {
			return CompleteOutput{}, err
		}
		if !ok {
			return CompleteOutput{}, errs.NotFound(fmt.Sprintf("%s 目标 refId=%s 不存在或无权修改", in.Scope, in.RefID))
		}
		writtenBack = true
	}

	s.log.Info("upload complete",
		zap.String("userId", userID),
		zap.String("scope", in.Scope),
		zap.String("key", in.Key),
		zap.Int64("size", meta.Size),
		zap.Bool("writtenBack", writtenBack),
	)
	return CompleteOutput{
		URL:         publicURL,
		PublicURL:   publicURL,
		Key:         in.Key,
		WrittenBack: writtenBack,
	}, nil
}

// validateRefIDForSign checks that refId exists + user has access.
// Mirrors apps/api/src/modules/uploads/uploads.service.ts:107.
func (s *Service) validateRefIDForSign(ctx context.Context, scope UploadScope, refID, userID, userRole string) error {
	isAdmin := userRole == "admin"
	switch scope {
	case ScopeLessonVideo:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 lesson 视频")
		}
		return s.lessonExists(ctx, refID)
	case ScopeResource:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 resource")
		}
		return s.lessonExists(ctx, refID)
	case ScopeCourseThumbnail:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 course 封面")
		}
		return s.courseExists(ctx, refID)
	case ScopeDegreeThumbnail:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 degree 封面")
		}
		return s.degreeExists(ctx, refID)
	case ScopeHackathonBanner:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 hackathon banner")
		}
		return s.hackathonExists(ctx, refID)
	case ScopeHackathonJudgeAvatar:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 judge avatar")
		}
		return s.judgeExists(ctx, refID)
	case ScopeHackathonSponsorLogo:
		if !isAdmin {
			return errs.Forbidden("仅 admin 可上传 sponsor logo")
		}
		return s.sponsorExists(ctx, refID)
	case ScopeSubmissionVideo:
		return s.submissionOwnedBy(ctx, refID, userID, isAdmin)
	case ScopeUserAvatar:
		if !isAdmin && refID != userID {
			return errs.Forbidden("只能改自己的头像")
		}
		return s.userExists(ctx, refID)
	}
	return errs.BadRequest("Unknown scope: " + string(scope))
}

// routeWriteback updates the target entity's URL column. Returns
// true if the row was updated, false if not found / no permission.
// Mirrors apps/api/src/modules/uploads/uploads.service.ts:281.
func (s *Service) routeWriteback(ctx context.Context, scope UploadScope, refID, publicURL, userID, userRole string) (bool, error) {
	isAdmin := userRole == "admin"
	var affected int64
	var err error
	switch scope {
	case ScopeLessonVideo:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetLessonVideo(ctx, db.UploadSetLessonVideoParams{
			VideoUrl: sql.NullString{String: publicURL, Valid: true},
			ID:       refID,
		})
	case ScopeResource:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetResourceUrl(ctx, db.UploadSetResourceUrlParams{
			Url: publicURL,
			ID:  refID,
		})
	case ScopeCourseThumbnail:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetCourseThumbnail(ctx, db.UploadSetCourseThumbnailParams{
			Thumbnail: publicURL,
			ID:        refID,
		})
	case ScopeDegreeThumbnail:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetDegreeThumbnail(ctx, db.UploadSetDegreeThumbnailParams{
			Thumbnail: sql.NullString{String: publicURL, Valid: true},
			ID:        refID,
		})
	case ScopeHackathonBanner:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetHackathonBanner(ctx, db.UploadSetHackathonBannerParams{
			BannerUrl: sql.NullString{String: publicURL, Valid: true},
			ID:        refID,
		})
	case ScopeHackathonJudgeAvatar:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetJudgeAvatar(ctx, db.UploadSetJudgeAvatarParams{
			AvatarUrl: sql.NullString{String: publicURL, Valid: true},
			ID:        refID,
		})
	case ScopeHackathonSponsorLogo:
		if !isAdmin {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetSponsorLogo(ctx, db.UploadSetSponsorLogoParams{
			LogoUrl: sql.NullString{String: publicURL, Valid: true},
			ID:      refID,
		})
	case ScopeSubmissionVideo:
		// owner check first
		if err2 := s.submissionOwnedBy(ctx, refID, userID, isAdmin); err2 != nil {
			return false, err2
		}
		affected, err = s.repo.q.UploadSetSubmissionVideo(ctx, db.UploadSetSubmissionVideoParams{
			VideoUrl: sql.NullString{String: publicURL, Valid: true},
			ID:       refID,
		})
	case ScopeUserAvatar:
		if !isAdmin && refID != userID {
			return false, nil
		}
		affected, err = s.repo.q.UploadSetUserAvatar(ctx, db.UploadSetUserAvatarParams{
			AvatarUrl: sql.NullString{String: publicURL, Valid: true},
			ID:        refID,
		})
	default:
		return false, nil
	}
	if err != nil {
		s.log.Warn("writeback failed",
			zap.String("scope", string(scope)),
			zap.String("refId", refID),
			zap.Error(err))
		return false, nil
	}
	return affected > 0, nil
}

// ============ existence checks ============
// Each is a single COUNT query (cheaper than SELECT + scan). All
// return errs.NotFound when the entity doesn't exist (or is soft-deleted).

func (s *Service) lessonExists(ctx context.Context, id string) error {
	var n int64
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM lessons WHERE id = ? AND deleted_at IS NULL`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check lesson", err)
	}
	if n == 0 {
		return errs.NotFound("Lesson " + id + " 不存在")
	}
	return nil
}

func (s *Service) courseExists(ctx context.Context, id string) error {
	var n int64
	// courses has NO deleted_at column (only lessons, resources, submissions
	// use soft-delete in the upload-targeted entity set).
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM courses WHERE id = ?`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check course", err)
	}
	if n == 0 {
		return errs.NotFound("Course " + id + " 不存在")
	}
	return nil
}

func (s *Service) degreeExists(ctx context.Context, id string) error {
	var n int64
	// nano_degrees has NO deleted_at column.
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM nano_degrees WHERE id = ?`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check degree", err)
	}
	if n == 0 {
		return errs.NotFound("Degree " + id + " 不存在")
	}
	return nil
}

func (s *Service) hackathonExists(ctx context.Context, id string) error {
	var n int64
	// hackathons has NO deleted_at column.
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM hackathons WHERE id = ?`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check hackathon", err)
	}
	if n == 0 {
		return errs.NotFound("Hackathon " + id + " 不存在")
	}
	return nil
}

func (s *Service) judgeExists(ctx context.Context, id string) error {
	var n int64
	// judges has NO deleted_at column.
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM judges WHERE id = ?`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check judge", err)
	}
	if n == 0 {
		return errs.NotFound("Judge " + id + " 不存在")
	}
	return nil
}

func (s *Service) sponsorExists(ctx context.Context, id string) error {
	var n int64
	// sponsors has NO deleted_at column.
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM sponsors WHERE id = ?`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check sponsor", err)
	}
	if n == 0 {
		return errs.NotFound("Sponsor " + id + " 不存在")
	}
	return nil
}

func (s *Service) userExists(ctx context.Context, id string) error {
	var n int64
	err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE id = ? AND deleted_at IS NULL`, id).Scan(&n)
	if err != nil {
		return errs.Internal("check user", err)
	}
	if n == 0 {
		return errs.NotFound("User " + id + " 不存在")
	}
	return nil
}

// submissionOwnedBy returns nil if the submission exists AND the user
// owns it (or is admin / team member). Returns errs.NotFound otherwise.
// Mirrors the NestJS findOwnedSubmission.
func (s *Service) submissionOwnedBy(ctx context.Context, subID, userID string, isAdmin bool) error {
	var n int64
	if isAdmin {
		err := s.repo.conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM submissions WHERE id = ? AND deleted_at IS NULL`, subID).Scan(&n)
		if err != nil {
			return errs.Internal("check submission", err)
		}
	} else {
		err := s.repo.conn.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM submissions s
			WHERE s.id = ? AND s.deleted_at IS NULL
			  AND (s.user_id = ?
			       OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = s.team_id AND tm.user_id = ?))
		`, subID, userID, userID).Scan(&n)
		if err != nil {
			return errs.Internal("check submission", err)
		}
	}
	if n == 0 {
		return errs.NotFound("Submission " + subID + " 不存在")
	}
	return nil
}

// ============ helpers ============

func roleAllowed(allowed []string, role string) bool {
	for _, r := range allowed {
		if r == role {
			return true
		}
	}
	return false
}

func mimeAllowed(allowed []string, mime string) bool {
	for _, m := range allowed {
		if m == mime {
			return true
		}
	}
	return false
}

func generateKey(prefix, userID, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if len(ext) > 8 {
		ext = ext[:8]
	}
	// Cap to safe chars; reject anything that doesn't match /^[.a-z0-9]+$/
	if !safeExt(ext) {
		ext = ""
	}
	ts := time.Now().UnixMilli()
	rnd := randomHex(6)
	return fmt.Sprintf("%s/%s/%d-%s%s", prefix, userID, ts, rnd, ext)
}

func safeExt(ext string) bool {
	if ext == "" {
		return true
	}
	if ext[0] != '.' {
		return false
	}
	for _, c := range ext[1:] {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	return true
}

func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "fallback"
	}
	return hex.EncodeToString(b)
}

// Package users — service layer.
//
// Phase 2 T11: business logic for the /users/* and /auth/identities/*
// routes. Mirrors apps/api/src/modules/users/users.service.ts 1:1 so the
// NestJS contract is preserved end-to-end.
//
// Service responsibilities:
//   - Field-level authorization (self vs admin)
//   - bcrypt for password ops
//   - Soft-delete / restore semantics
//   - Last-admin / last-primary guards
//   - Audit log writes
//   - DB-level rollups for the admin detail drawer
package users

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/mail"
	"regexp"
	"strings"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// Service is the users business logic. It holds the repo and the bcrypt
// cost (12, matching NestJS).
type Service struct {
	repo *Repo
	log  *zap.Logger
	// bcryptCost is configurable so tests can drop it to 4 to keep
	// hashing latency low; production stays at 12.
	bcryptCost int
}

// NewService builds a Service. The default bcrypt cost is 12; pass 0 to
// get 12. Tests can use a lower value to speed up suites.
func NewService(repo *Repo, log *zap.Logger, bcryptCost int) *Service {
	if bcryptCost <= 0 {
		bcryptCost = 12
	}
	return &Service{repo: repo, log: log, bcryptCost: bcryptCost}
}

// ListParams mirrors the NestJS controller's query-string inputs.
type ListParams struct {
	Role   string // "admin" | "student" | "instructor" | ""
	Search string
	Page   int
	Limit  int
	Status string // "active" | "disabled" | "all"
}

// List returns paginated users. Role/status/search validation lives here.
func (s *Service) List(ctx context.Context, p ListParams) (ListResult, error) {
	if p.Status == "" {
		p.Status = "active"
	}
	switch p.Status {
	case "active", "disabled", "all":
	default:
		return ListResult{}, errs.BadRequest("status must be one of active|disabled|all")
	}
	if p.Role != "" {
		switch p.Role {
		case "admin", "student", "instructor":
		default:
			return ListResult{}, errs.BadRequest("role must be one of admin|student|instructor")
		}
	}
	return s.repo.List(ctx, ListFilter{
		Role: p.Role, Search: p.Search, Status: p.Status,
		Page: p.Page, Limit: p.Limit,
	})
}

// Get returns a single user (active or deleted) without joined detail.
func (s *Service) Get(ctx context.Context, id string) (db.User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return db.User{}, errs.NotFound("User not found")
		}
		return db.User{}, errs.Internal("get user", err)
	}
	return u, nil
}

// GetDetail returns the user + joined admin drawer data. Used by
// GET /users/:id (admin) and GET /users/me would 404 if the user
// doesn't exist (NestJS: 404 if not found).
func (s *Service) GetDetail(ctx context.Context, id string) (Detail, error) {
	d, err := s.repo.FindOneDetail(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return Detail{}, errs.NotFound("User not found")
		}
		return Detail{}, errs.Internal("get user detail", err)
	}
	return d, nil
}

// CreateInput is the create-user payload. Mirrors CreateUserDto.
type CreateInput struct {
	Email    string
	Password string
	Name     string
	Role     string // "admin" | "student" | "instructor"
}

// Create inserts a new user with the supplied role. Returns the public
// user shape (no passwordHash).
func (s *Service) Create(ctx context.Context, in CreateInput) (db.User, error) {
	if err := validateEmail(in.Email); err != nil {
		return db.User{}, err
	}
	if err := validateName(in.Name); err != nil {
		return db.User{}, err
	}
	if err := validateRole(in.Role); err != nil {
		return db.User{}, err
	}
	if err := validatePassword(in.Password); err != nil {
		return db.User{}, err
	}
	if _, err := s.repo.GetByEmail(ctx, in.Email); err == nil {
		return db.User{}, errs.Conflict("Email already registered")
	} else if err != ErrNotFound {
		return db.User{}, errs.Internal("check email", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), s.bcryptCost)
	if err != nil {
		return db.User{}, errs.Internal("hash password", err)
	}
	u, err := s.repo.Create(ctx, in.Email, string(hash), in.Name, db.UsersRole(in.Role))
	if err != nil {
		return db.User{}, errs.Internal("create user", err)
	}
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: u.ID, Action: "USER_CREATE", Entity: "user", EntityID: u.ID,
	})
	return u, nil
}

// UpdateInput is the patch-user payload. Role may be empty (caller
// decides based on authorization).
type UpdateInput struct {
	Name      *string
	AvatarURL *string
	Role      *string
}

// UpdateContext carries the acting user's id + role.
type UpdateContext struct {
	ActorUserID string
	IsAdmin     bool
}

// Update applies a partial update. Self vs admin rules:
//   - Non-admin can only update themselves; can only change name/avatarUrl.
//   - Admin can update anyone and may change role.
//
// Mirrors users.controller.ts:89-109 and users.service.ts:192-226.
func (s *Service) Update(ctx context.Context, id string, in UpdateInput, uc UpdateContext) (db.User, error) {
	if !uc.IsAdmin && uc.ActorUserID != id {
		return db.User{}, errs.Forbidden("只能修改自己的账号")
	}
	if in.Role != nil && !uc.IsAdmin {
		return db.User{}, errs.Forbidden("只有管理员可以修改角色")
	}
	if in.Role != nil {
		if err := validateRole(*in.Role); err != nil {
			return db.User{}, err
		}
	}
	if in.Name != nil {
		if err := validateName(*in.Name); err != nil {
			return db.User{}, err
		}
	}
	if in.AvatarURL != nil {
		if err := validateAvatarURL(*in.AvatarURL); err != nil {
			return db.User{}, err
		}
	}
	// Ensure target user exists and is not soft-deleted.
	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return db.User{}, errs.NotFound("User not found")
		}
		return db.User{}, errs.Internal("lookup user", err)
	}
	if before.DeletedAt.Valid {
		return db.User{}, errs.NotFound("User not found or deleted")
	}

	// Build the patch.
	patch := UpdatePatch{
		Name:      before.Name,
		AvatarUrl: before.AvatarUrl,
		Role:      before.Role,
	}
	if in.Name != nil {
		patch.Name = *in.Name
	}
	if in.AvatarURL != nil {
		patch.AvatarUrl = sql.NullString{String: *in.AvatarURL, Valid: true}
	}
	if in.Role != nil {
		patch.Role = db.UsersRole(*in.Role)
	}
	if err := s.repo.Update(ctx, id, patch); err != nil {
		return db.User{}, errs.Internal("update user", err)
	}
	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return db.User{}, errs.Internal("reload user", err)
	}
	// Best-effort audit with before/after JSON.
	details := auditDetails(before, after)
	_ = s.writeAudit(ctx, AuditEntry{
		UserID:   uc.ActorUserID,
		Action:   "USER_UPDATE",
		Entity:   "user",
		EntityID: id,
		Details:  details,
	})
	return after, nil
}

// ChangePasswordInput is the self-service change-password payload.
type ChangePasswordInput struct {
	CurrentPassword string
	NewPassword     string
}

// ChangePassword verifies the current password, writes the new one, and
// revokes all refresh tokens (force logout everywhere). Mirrors
// users.service.ts:228-256.
func (s *Service) ChangePassword(ctx context.Context, userID string, in ChangePasswordInput) error {
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("User not found")
		}
		return errs.Internal("lookup user", err)
	}
	if u.DeletedAt.Valid {
		return errs.NotFound("User not found")
	}
	if u.PasswordHash == "" {
		return errs.Unauthorized("当前密码不正确")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.CurrentPassword)); err != nil {
		return errs.Unauthorized("当前密码不正确")
	}
	if in.CurrentPassword == in.NewPassword {
		return errs.BadRequest("新密码不能与当前密码相同")
	}
	if err := validatePassword(in.NewPassword); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), s.bcryptCost)
	if err != nil {
		return errs.Internal("hash password", err)
	}
	if err := s.repo.UpdatePassword(ctx, userID, string(hash), false); err != nil {
		return errs.Internal("update password", err)
	}
	// Revoke all refresh tokens — force re-login on other devices.
	_ = s.revokeAllRefreshTokens(ctx, userID)
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: userID, Action: "USER_PASSWORD_CHANGE", Entity: "user", EntityID: userID,
	})
	return nil
}

// ResetPassword generates a one-time temporary password and revokes the
// user's sessions. The plaintext is returned exactly once to the caller
// (NestJS: same contract). The hash is what's stored.
func (s *Service) ResetPassword(ctx context.Context, userID, actorUserID string) (string, error) {
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		if err == ErrNotFound {
			return "", errs.NotFound("User not found")
		}
		return "", errs.Internal("lookup user", err)
	}
	if u.DeletedAt.Valid {
		return "", errs.NotFound("User not found")
	}
	temporary, err := generateTemporaryPassword()
	if err != nil {
		return "", errs.Internal("generate password", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(temporary), s.bcryptCost)
	if err != nil {
		return "", errs.Internal("hash password", err)
	}
	if err := s.repo.UpdatePassword(ctx, userID, string(hash), true); err != nil {
		return "", errs.Internal("update password", err)
	}
	_ = s.revokeAllRefreshTokens(ctx, userID)
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: actorUserID, Action: "USER_PASSWORD_RESET", Entity: "user", EntityID: userID,
	})
	return temporary, nil
}

// Disable soft-deletes a user. Refuses if:
//   - the actor is the target (can't lock yourself out)
//   - target is the last active admin
//
// Mirrors users.service.ts:284-317.
func (s *Service) Disable(ctx context.Context, id, actorUserID string) error {
	if id == actorUserID {
		return errs.Forbidden("不能停用当前登录账号")
	}
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("User not found or already disabled")
		}
		return errs.Internal("lookup user", err)
	}
	if u.DeletedAt.Valid {
		return errs.NotFound("User not found or already disabled")
	}
	if u.Role == db.UsersRoleAdmin {
		count, err := s.repo.CountActiveAdmins(ctx)
		if err != nil {
			return errs.Internal("count admins", err)
		}
		if count <= 1 {
			return errs.BadRequest("不能停用最后一个管理员账号")
		}
	}
	if err := s.repo.SoftDelete(ctx, id); err != nil {
		return errs.Internal("soft delete", err)
	}
	_ = s.revokeAllRefreshTokens(ctx, id)
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: actorUserID, Action: "USER_DISABLE", Entity: "user", EntityID: id,
	})
	return nil
}

// Restore re-activates a soft-deleted user.
func (s *Service) Restore(ctx context.Context, id, actorUserID string) (db.User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if err == ErrNotFound {
			return db.User{}, errs.NotFound("User not found or already active")
		}
		return db.User{}, errs.Internal("lookup user", err)
	}
	if !u.DeletedAt.Valid {
		return db.User{}, errs.NotFound("User not found or already active")
	}
	if err := s.repo.Restore(ctx, id); err != nil {
		return db.User{}, errs.Internal("restore user", err)
	}
	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return db.User{}, errs.Internal("reload user", err)
	}
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: actorUserID, Action: "USER_RESTORE", Entity: "user", EntityID: id,
	})
	return after, nil
}

// GrantCourseAccess upserts enrollments for the given course IDs.
func (s *Service) GrantCourseAccess(ctx context.Context, userID string, courseIDs []string, actorUserID string) (int, error) {
	if len(courseIDs) == 0 {
		return 0, errs.BadRequest("courseIds is required")
	}
	for _, id := range courseIDs {
		if !isUUID(id) {
			return 0, errs.BadRequest("courseIds must be UUIDs")
		}
	}
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		if err == ErrNotFound {
			return 0, errs.NotFound("User not found")
		}
		return 0, errs.Internal("lookup user", err)
	}
	if u.DeletedAt.Valid {
		return 0, errs.NotFound("User not found")
	}
	n, err := s.repo.GrantCourseAccess(ctx, userID, courseIDs)
	if err != nil {
		return 0, errs.Internal("grant course access", err)
	}
	details, _ := json.Marshal(map[string]any{"courseIds": courseIDs})
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: actorUserID, Action: "USER_GRANT_COURSE", Entity: "user", EntityID: userID,
		Details: string(details),
	})
	return n, nil
}

// GrantDegreeAccess upserts degree enrollments.
func (s *Service) GrantDegreeAccess(ctx context.Context, userID string, degreeIDs []string, actorUserID string) (int, error) {
	if len(degreeIDs) == 0 {
		return 0, errs.BadRequest("degreeIds is required")
	}
	for _, id := range degreeIDs {
		if !isUUID(id) {
			return 0, errs.BadRequest("degreeIds must be UUIDs")
		}
	}
	u, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		if err == ErrNotFound {
			return 0, errs.NotFound("User not found")
		}
		return 0, errs.Internal("lookup user", err)
	}
	if u.DeletedAt.Valid {
		return 0, errs.NotFound("User not found")
	}
	n, err := s.repo.GrantDegreeAccess(ctx, userID, degreeIDs)
	if err != nil {
		return 0, errs.Internal("grant degree access", err)
	}
	details, _ := json.Marshal(map[string]any{"degreeIds": degreeIDs})
	_ = s.writeAudit(ctx, AuditEntry{
		UserID: actorUserID, Action: "USER_GRANT_DEGREE", Entity: "user", EntityID: userID,
		Details: string(details),
	})
	return n, nil
}

// ListIdentities returns the active provider bindings for a user. Used
// by GET /auth/identities.
func (s *Service) ListIdentities(ctx context.Context, userID string) ([]db.UserProviderAccount, error) {
	rows, err := s.repo.q.ListProviderAccountsByUser(ctx, userID)
	if err != nil {
		return nil, errs.Internal("list identities", err)
	}
	return rows, nil
}

// UnlinkIdentity removes a provider binding. Refuses if it's the last
// active primary provider for the user.
func (s *Service) UnlinkIdentity(ctx context.Context, userID, identityID string) error {
	pa, err := s.repo.GetProviderAccountByID(ctx, identityID)
	if err != nil {
		if err == ErrNotFound {
			return errs.NotFound("Identity not found")
		}
		return errs.Internal("lookup identity", err)
	}
	if pa.UserID != userID {
		return errs.Forbidden("Cannot unlink another user's identity")
	}
	if pa.DeletedAt.Valid {
		return errs.NotFound("Identity not found")
	}
	if pa.IsPrimary {
		count, err := s.repo.CountActivePrimaryProviders(ctx, userID)
		if err != nil {
			return errs.Internal("count primaries", err)
		}
		if count <= 1 {
			return errs.BadRequest("Cannot unlink the last primary identity")
		}
	}
	if err := s.repo.SoftDeleteProviderAccount(ctx, identityID); err != nil {
		return errs.Internal("soft delete identity", err)
	}
	return nil
}

// writeAudit is a best-effort wrapper that logs (never returns) failures.
// Audit log writes shouldn't break user-facing actions.
func (s *Service) writeAudit(ctx context.Context, e AuditEntry) error {
	if err := s.repo.WriteAuditLog(ctx, e); err != nil {
		s.log.Warn("audit log write failed", zap.String("action", e.Action), zap.Error(err))
		return err
	}
	return nil
}

// revokeAllRefreshTokens wipes the user's refresh tokens via the auth
// repo's exposed method. We do the cross-package call through the
// users.repo's conn to avoid a circular import; sqlc's underlying
// *sql.DB is the same instance.
func (s *Service) revokeAllRefreshTokens(ctx context.Context, userID string) error {
	_, err := s.repo.conn.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = ?`, userID)
	if err != nil {
		s.log.Warn("revoke refresh tokens failed", zap.String("userID", userID), zap.Error(err))
		return err
	}
	return nil
}

// ============ validators ============

var (
	// 12+ chars, with at least one lower, one upper, one digit, one symbol.
	passwordRe = regexp.MustCompile(`^[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~` + "`" + `]{12,128}$`)
	// NestJS uses (?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]) which is the
	// same intent: lower + upper + digit + symbol, length 12+.
	strongPwdRe = regexp.MustCompile(`^.{12,}$`)
	hasLower    = regexp.MustCompile(`[a-z]`)
	hasUpper    = regexp.MustCompile(`[A-Z]`)
	hasDigit    = regexp.MustCompile(`\d`)
	hasSymbol   = regexp.MustCompile(`[^A-Za-z0-9]`)
	uuidRe      = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

func validateEmail(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return errs.BadRequest("email is required")
	}
	if _, err := mail.ParseAddress(s); err != nil {
		return errs.BadRequest("email is invalid")
	}
	return nil
}

func validateName(s string) error {
	s = strings.TrimSpace(s)
	if s == "" {
		return errs.BadRequest("name is required")
	}
	if len(s) > 191 {
		return errs.BadRequest("name too long")
	}
	return nil
}

func validateRole(r string) error {
	switch r {
	case "admin", "student", "instructor":
		return nil
	case "":
		return errs.BadRequest("role is required")
	default:
		return errs.BadRequest("role must be one of admin|student|instructor")
	}
}

func validatePassword(p string) error {
	if !strongPwdRe.MatchString(p) {
		return errs.BadRequest("密码至少 12 位")
	}
	if !hasLower.MatchString(p) {
		return errs.BadRequest("密码必须包含小写字母")
	}
	if !hasUpper.MatchString(p) {
		return errs.BadRequest("密码必须包含大写字母")
	}
	if !hasDigit.MatchString(p) {
		return errs.BadRequest("密码必须包含数字")
	}
	if !hasSymbol.MatchString(p) {
		return errs.BadRequest("密码必须包含符号")
	}
	return nil
}

// validateAvatarURL is the SafeUrl decorator equivalent: only http/https
// schemes are allowed, max 500 chars.
func validateAvatarURL(s string) error {
	if s == "" {
		return nil // cleared is allowed
	}
	if len(s) > 500 {
		return errs.BadRequest("avatarUrl too long")
	}
	low := strings.ToLower(s)
	if !strings.HasPrefix(low, "http://") && !strings.HasPrefix(low, "https://") {
		return errs.BadRequest("avatarUrl must be http(s)://")
	}
	return nil
}

func isUUID(s string) bool {
	return uuidRe.MatchString(s)
}

// generateTemporaryPassword returns a 16-byte random password. Format
// matches NestJS: "A!a1" + 12 base64url chars from crypto/rand.
func generateTemporaryPassword() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "A!a1" + base64.RawURLEncoding.EncodeToString(b), nil
}

// auditDetails builds a JSON blob for the audit log. Used by Update
// to record before/after; other actions store a details object too.
func auditDetails(before, after db.User) string {
	out := map[string]any{
		"before": userAuditView(before),
		"after":  userAuditView(after),
	}
	b, _ := json.Marshal(out)
	return string(b)
}

func userAuditView(u db.User) map[string]any {
	return map[string]any{
		"id":        u.ID,
		"email":     u.Email,
		"name":      u.Name,
		"role":      string(u.Role),
		"avatarUrl": u.AvatarUrl.String,
		"deletedAt": u.DeletedAt.Time,
	}
}

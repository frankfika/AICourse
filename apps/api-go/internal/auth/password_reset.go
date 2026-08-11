package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

const passwordResetTTL = 30 * time.Minute

var ErrInvalidPasswordResetToken = errors.New("auth: password reset token invalid or expired")

// PasswordResetNotifier delivers the plaintext reset token. Implementations
// must never persist or log it. Enabled controls the public capability flag.
type PasswordResetNotifier interface {
	Enabled() bool
	SendPasswordReset(ctx context.Context, to, token, idempotencyKey string) error
}

type disabledPasswordResetNotifier struct{}

func (disabledPasswordResetNotifier) Enabled() bool { return false }
func (disabledPasswordResetNotifier) SendPasswordReset(context.Context, string, string, string) error {
	return errors.New("password reset notifier is disabled")
}

// ResendPasswordResetNotifier sends password-reset email through Resend.
type ResendPasswordResetNotifier struct {
	apiKey    string
	from      string
	publicURL string
	client    *http.Client
}

func NewResendPasswordResetNotifier(apiKey, from, publicURL string, client *http.Client) PasswordResetNotifier {
	apiKey, from, publicURL = strings.TrimSpace(apiKey), strings.TrimSpace(from), strings.TrimRight(strings.TrimSpace(publicURL), "/")
	if apiKey == "" || from == "" || publicURL == "" {
		return disabledPasswordResetNotifier{}
	}
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &ResendPasswordResetNotifier{apiKey: apiKey, from: from, publicURL: publicURL, client: client}
}

func (n *ResendPasswordResetNotifier) Enabled() bool { return true }

func (n *ResendPasswordResetNotifier) SendPasswordReset(ctx context.Context, to, token, idempotencyKey string) error {
	resetURL := n.publicURL + "/auth/reset?token=" + url.QueryEscape(token)
	payload := map[string]any{
		"from": n.from, "to": []string{to}, "subject": "重置你的 AI Academy 密码",
		"text": "请在 30 分钟内打开以下链接重置密码：\n\n" + resetURL + "\n\n如果不是你发起的请求，请忽略本邮件。",
		"html": `<p>请在 30 分钟内点击下方链接重置密码：</p><p><a href="` + html.EscapeString(resetURL) + `">重置密码</a></p><p>如果不是你发起的请求，请忽略本邮件。</p>`,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode resend payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+n.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "password-reset-"+idempotencyKey)
	req.Header.Set("User-Agent", "AI-Academy/1.0")
	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("send reset email: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("resend returned status %d", resp.StatusCode)
	}
	return nil
}

type PasswordResetService struct {
	repo       PasswordResetStore
	notifier   PasswordResetNotifier
	bcryptCost int
	now        func() time.Time
	log        *zap.Logger
}

// PasswordResetStore keeps the reset workflow testable without a database and
// documents the atomic operations required from the repository.
type PasswordResetStore interface {
	GetUserByEmail(ctx context.Context, email string) (db.User, error)
	ReplacePasswordResetToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (string, error)
	DeletePasswordResetToken(ctx context.Context, id string) error
	ValidatePasswordResetToken(ctx context.Context, tokenHash string, now time.Time) error
	ConsumePasswordReset(ctx context.Context, tokenHash, passwordHash string, now time.Time) (string, error)
	WritePasswordResetAudit(ctx context.Context, userID, action string)
}

func NewPasswordResetService(repo PasswordResetStore, notifier PasswordResetNotifier, bcryptCost int, log *zap.Logger) *PasswordResetService {
	if notifier == nil {
		notifier = disabledPasswordResetNotifier{}
	}
	if bcryptCost < bcrypt.MinCost || bcryptCost > bcrypt.MaxCost {
		bcryptCost = 12
	}
	if log == nil {
		log = zap.NewNop()
	}
	return &PasswordResetService{repo: repo, notifier: notifier, bcryptCost: bcryptCost, now: time.Now, log: log}
}

func (s *PasswordResetService) Capability() bool { return s.notifier.Enabled() }

// Request returns an indistinguishable accepted result for missing,
// OAuth-only, successful-delivery, and failed-delivery accounts. A globally
// disabled capability is the only public 503 case and is exposed separately.
func (s *PasswordResetService) Request(ctx context.Context, emailInput string) error {
	if !s.notifier.Enabled() {
		return errs.ServiceUnavailable("自助邮件重置尚未配置，请联系平台管理员")
	}
	email := strings.ToLower(strings.TrimSpace(emailInput))
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil
		}
		return errs.Internal("lookup password reset user", err)
	}
	if user.PasswordHash == "" {
		return nil
	}
	token, err := generatePasswordResetToken()
	if err != nil {
		return errs.Internal("generate password reset token", err)
	}
	recordID, err := s.repo.ReplacePasswordResetToken(ctx, user.ID, hashPasswordResetToken(token), s.now().UTC().Add(passwordResetTTL))
	if err != nil {
		return errs.Internal("create password reset token", err)
	}
	if err := s.notifier.SendPasswordReset(ctx, user.Email, token, recordID); err != nil {
		if deleteErr := s.repo.DeletePasswordResetToken(ctx, recordID); deleteErr != nil {
			s.log.Error("failed to invalidate undelivered password reset token", zap.String("user_id", user.ID), zap.String("token_id", recordID), zap.Error(deleteErr))
		}
		s.log.Error("password reset email delivery failed", zap.String("user_id", user.ID), zap.Error(err))
		// Keep the public response indistinguishable from an unknown or
		// OAuth-only account. Returning 503 only for an existing local account
		// turns a mail-provider outage into a reliable account oracle.
		return nil
	}
	s.repo.WritePasswordResetAudit(ctx, user.ID, "USER_PASSWORD_RESET_REQUEST")
	return nil
}

func (s *PasswordResetService) Confirm(ctx context.Context, token, newPassword string) error {
	if len(token) < 32 || len(token) > 256 {
		return errs.Unauthorized("重置链接无效或已过期")
	}
	if !ValidatePasswordPublic(newPassword) {
		return errs.BadRequest("Password must be 12-128 characters and include uppercase, lowercase, number and symbol")
	}
	now := s.now().UTC()
	tokenHash := hashPasswordResetToken(token)
	// Reject random tokens before the deliberately expensive bcrypt operation.
	// ConsumePasswordReset repeats this validation under FOR UPDATE, so this
	// optimization does not weaken one-shot or concurrent-consume guarantees.
	if err := s.repo.ValidatePasswordResetToken(ctx, tokenHash, now); err != nil {
		if errors.Is(err, ErrInvalidPasswordResetToken) {
			return errs.Unauthorized("重置链接无效或已过期")
		}
		return errs.Internal("validate password reset token", err)
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), s.bcryptCost)
	if err != nil {
		return errs.Internal("hash new password", err)
	}
	userID, err := s.repo.ConsumePasswordReset(ctx, tokenHash, string(passwordHash), now)
	if err != nil {
		if errors.Is(err, ErrInvalidPasswordResetToken) {
			return errs.Unauthorized("重置链接无效或已过期")
		}
		return errs.Internal("confirm password reset", err)
	}
	s.repo.WritePasswordResetAudit(ctx, userID, "USER_PASSWORD_RESET_CONFIRM")
	return nil
}

func generatePasswordResetToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashPasswordResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (r *AuthRepo) ReplacePasswordResetToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (string, error) {
	tx, err := r.conn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback() //nolint:errcheck
	// Serialize concurrent requests for one user. Without this lock, two
	// transactions can both observe no token, then insert two live reset links.
	var lockedUserID string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE id = ? FOR UPDATE`, userID).Scan(&lockedUserID); err != nil {
		return "", err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM password_reset_tokens WHERE user_id = ?`, userID); err != nil {
		return "", err
	}
	id := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`, id, userID, tokenHash, expiresAt, time.Now().UTC()); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return id, nil
}

// ValidatePasswordResetToken performs the cheap, read-only rejection used
// before bcrypt. ConsumePasswordReset repeats all checks under a row lock.
func (r *AuthRepo) ValidatePasswordResetToken(ctx context.Context, tokenHash string, now time.Time) error {
	var id string
	err := r.conn.QueryRowContext(ctx, `SELECT pr.id FROM password_reset_tokens pr JOIN users u ON u.id = pr.user_id WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > ? AND u.deleted_at IS NULL LIMIT 1`, tokenHash, now).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidPasswordResetToken
	}
	return err
}

func (r *AuthRepo) DeletePasswordResetToken(ctx context.Context, id string) error {
	_, err := r.conn.ExecContext(ctx, `DELETE FROM password_reset_tokens WHERE id = ?`, id)
	return err
}

// ConsumePasswordReset atomically consumes a live token, changes the password,
// revokes every refresh session, and removes other reset tokens.
func (r *AuthRepo) ConsumePasswordReset(ctx context.Context, tokenHash, passwordHash string, now time.Time) (string, error) {
	tx, err := r.conn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback() //nolint:errcheck
	var id, userID string
	var expiresAt time.Time
	var usedAt, deletedAt sql.NullTime
	err = tx.QueryRowContext(ctx, `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.deleted_at FROM password_reset_tokens pr JOIN users u ON u.id = pr.user_id WHERE pr.token_hash = ? FOR UPDATE`, tokenHash).Scan(&id, &userID, &expiresAt, &usedAt, &deletedAt)
	if errors.Is(err, sql.ErrNoRows) || err == nil && (usedAt.Valid || !expiresAt.After(now) || deletedAt.Valid) {
		return "", ErrInvalidPasswordResetToken
	}
	if err != nil {
		return "", err
	}
	result, err := tx.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?`, now, id, now)
	if err != nil {
		return "", err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return "", err
	}
	if affected != 1 {
		return "", ErrInvalidPasswordResetToken
	}
	userResult, err := tx.ExecContext(ctx, `UPDATE users SET password_hash = ?, password_reset_required = false, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, passwordHash, now, userID)
	if err != nil {
		return "", err
	}
	userAffected, err := userResult.RowsAffected()
	if err != nil {
		return "", err
	}
	if userAffected != 1 {
		return "", ErrInvalidPasswordResetToken
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM refresh_tokens WHERE user_id = ?`, userID); err != nil {
		return "", err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM password_reset_tokens WHERE user_id = ? AND id <> ?`, userID, id); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return userID, nil
}

func (r *AuthRepo) WritePasswordResetAudit(ctx context.Context, userID, action string) {
	_, _ = r.conn.ExecContext(ctx, `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, created_at) VALUES (?, ?, ?, 'user', ?, ?)`, uuid.NewString(), userID, action, userID, time.Now().UTC())
}

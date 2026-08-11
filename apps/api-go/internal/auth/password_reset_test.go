package auth

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

type passwordResetStoreFake struct {
	user           db.User
	getErr         error
	validateErr    error
	deletedTokenID string
	consumeCalled  bool
}

func (f *passwordResetStoreFake) GetUserByEmail(context.Context, string) (db.User, error) {
	return f.user, f.getErr
}
func (f *passwordResetStoreFake) ReplacePasswordResetToken(context.Context, string, string, time.Time) (string, error) {
	return "reset-record", nil
}
func (f *passwordResetStoreFake) DeletePasswordResetToken(_ context.Context, id string) error {
	f.deletedTokenID = id
	return nil
}
func (f *passwordResetStoreFake) ValidatePasswordResetToken(context.Context, string, time.Time) error {
	return f.validateErr
}
func (f *passwordResetStoreFake) ConsumePasswordReset(context.Context, string, string, time.Time) (string, error) {
	f.consumeCalled = true
	return f.user.ID, nil
}
func (*passwordResetStoreFake) WritePasswordResetAudit(context.Context, string, string) {}

type failingPasswordResetNotifier struct{}

func (failingPasswordResetNotifier) Enabled() bool { return true }
func (failingPasswordResetNotifier) SendPasswordReset(context.Context, string, string, string) error {
	return errors.New("mail provider unavailable")
}

type passwordResetRoundTripper func(*http.Request) (*http.Response, error)

func (f passwordResetRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestPasswordResetDisabledCapabilityAndRequest(t *testing.T) {
	svc := NewPasswordResetService(nil, nil, 4, nil)
	require.False(t, svc.Capability())
	err := svc.Request(context.Background(), "user@example.test")
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
}

func TestPasswordResetConfirmValidatesBeforeDatabase(t *testing.T) {
	svc := NewPasswordResetService(nil, nil, 4, nil)
	err := svc.Confirm(context.Background(), "short", "GoodPass!1234")
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, http.StatusUnauthorized, appErr.StatusCode)

	err = svc.Confirm(context.Background(), strings.Repeat("a", 43), "weak-password")
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
}

func TestPasswordResetTokenIsRandomAndOnlyHashIsStable(t *testing.T) {
	one, err := generatePasswordResetToken()
	require.NoError(t, err)
	two, err := generatePasswordResetToken()
	require.NoError(t, err)
	require.Len(t, one, 43)
	require.NotEqual(t, one, two)
	require.Len(t, hashPasswordResetToken(one), 64)
	require.Equal(t, hashPasswordResetToken(one), hashPasswordResetToken(one))
	require.NotContains(t, hashPasswordResetToken(one), one)
}

func TestPasswordResetMailFailureDoesNotEnumerateExistingAccount(t *testing.T) {
	store := &passwordResetStoreFake{user: db.User{
		ID: "user-1", Email: "user@example.test", PasswordHash: "$2a$04$local-password",
	}}
	svc := NewPasswordResetService(store, failingPasswordResetNotifier{}, 4, nil)
	require.NoError(t, svc.Request(context.Background(), "user@example.test"))
	require.Equal(t, "reset-record", store.deletedTokenID, "undelivered token must be invalidated")

	missingStore := &passwordResetStoreFake{getErr: ErrNotFound}
	missingSvc := NewPasswordResetService(missingStore, failingPasswordResetNotifier{}, 4, nil)
	require.NoError(t, missingSvc.Request(context.Background(), "missing@example.test"))
}

func TestPasswordResetRejectsInvalidTokenBeforeBcryptAndConsume(t *testing.T) {
	store := &passwordResetStoreFake{validateErr: ErrInvalidPasswordResetToken}
	svc := NewPasswordResetService(store, failingPasswordResetNotifier{}, bcrypt.MaxCost, nil)
	err := svc.Confirm(context.Background(), strings.Repeat("a", 43), "GoodPass!1234")
	var appErr *errs.AppError
	require.ErrorAs(t, err, &appErr)
	require.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
	require.False(t, store.consumeCalled)
}

func TestResendPasswordResetNotifier(t *testing.T) {
	called := false
	client := &http.Client{Transport: passwordResetRoundTripper(func(req *http.Request) (*http.Response, error) {
		called = true
		require.Equal(t, "Bearer key", req.Header.Get("Authorization"))
		require.Equal(t, "password-reset-record-1", req.Header.Get("Idempotency-Key"))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.Contains(t, string(body), "token%2Bwith%2Fchars")
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{}`)), Header: make(http.Header)}, nil
	})}
	notifier := NewResendPasswordResetNotifier("key", "AI <noreply@example.test>", "https://app.example.test/", client)
	require.True(t, notifier.Enabled())
	require.NoError(t, notifier.SendPasswordReset(context.Background(), "user@example.test", "token+with/chars", "record-1"))
	require.True(t, called)
}

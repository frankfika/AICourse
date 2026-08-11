package uploads

import (
	"bytes"
	"context"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func putFromPresign(t *testing.T, storage *LocalFileStorage, result PresignResult, contentType string, body []byte) error {
	t.Helper()
	u, err := url.Parse(result.UploadURL)
	require.NoError(t, err)
	maxBytes, err := strconv.ParseInt(u.Query().Get("maxBytes"), 10, 64)
	require.NoError(t, err)
	expires, err := strconv.ParseInt(u.Query().Get("expires"), 10, 64)
	require.NoError(t, err)
	return storage.PutPresigned(context.Background(), result.Key, contentType, maxBytes, expires, u.Query().Get("signature"), bytes.NewReader(body))
}

func TestLocalPresignedPutHappyPathAndNoOverwrite(t *testing.T) {
	storage := NewLocalFileStorageWithUploadBase(t.TempDir(), "http://example.test/api/v1/uploads/files", "http://example.test/api/v1/uploads/_local_upload")
	body := []byte("signed local body")
	result, err := storage.PresignUpload(context.Background(), "users/avatars/u1/file.txt", "text/plain", int64(len(body)), 60)
	require.NoError(t, err)
	require.NoError(t, putFromPresign(t, storage, result, "text/plain; charset=utf-8", body))

	meta, err := storage.HeadObject(context.Background(), result.Key)
	require.NoError(t, err)
	assert.Equal(t, int64(len(body)), meta.Size)
	assert.Equal(t, "text/plain; charset=utf-8", meta.ContentType)
	assert.ErrorIs(t, putFromPresign(t, storage, result, "text/plain", body), ErrObjectAlreadyExists)
}

func TestLocalPresignedPutRejectsTamperExpiryAndOversize(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	root := t.TempDir()
	storage := NewLocalFileStorageWithUploadBase(root, "http://example.test/files", "http://example.test/_local_upload")
	storage.now = func() time.Time { return now }
	result, err := storage.PresignUpload(context.Background(), "courses/u1/file.png", "image/png", 4, 60)
	require.NoError(t, err)

	u, err := url.Parse(result.UploadURL)
	require.NoError(t, err)
	expires, _ := strconv.ParseInt(u.Query().Get("expires"), 10, 64)
	assert.ErrorIs(t, storage.PutPresigned(context.Background(), result.Key, "image/jpeg", 4, expires, u.Query().Get("signature"), bytes.NewReader([]byte("1234"))), ErrInvalidUploadSignature)
	assert.ErrorIs(t, storage.PutPresigned(context.Background(), "../escape", "image/png", 4, expires, u.Query().Get("signature"), bytes.NewReader([]byte("1234"))), ErrInvalidUploadSignature)
	assert.ErrorIs(t, putFromPresign(t, storage, result, "image/png", []byte("12345")), ErrUploadTooLarge)
	temps, err := filepath.Glob(filepath.Join(root, "courses/u1/.upload-*"))
	require.NoError(t, err)
	assert.Empty(t, temps, "failed uploads must remove temporary files")
	_, err = storage.HeadObject(context.Background(), result.Key)
	assert.ErrorIs(t, err, ErrObjectNotFound, "oversized temporary data must not be published")

	now = now.Add(61 * time.Second)
	assert.ErrorIs(t, putFromPresign(t, storage, result, "image/png", []byte("1234")), ErrUploadExpired)
}

func TestLocalPresignedPutRejectsNumericTamperAndSymlinkAfterPresign(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	storage := NewLocalFileStorageWithUploadBase(root, "http://example.test/files", "http://example.test/_local_upload")
	result, err := storage.PresignUpload(context.Background(), "nested/u1/file.txt", "text/plain", 4, 60)
	require.NoError(t, err)
	u, _ := url.Parse(result.UploadURL)
	expires, _ := strconv.ParseInt(u.Query().Get("expires"), 10, 64)
	assert.ErrorIs(t, storage.PutPresigned(context.Background(), result.Key, "text/plain", 5, expires, u.Query().Get("signature"), bytes.NewReader([]byte("1234"))), ErrInvalidUploadSignature)
	assert.ErrorIs(t, storage.PutPresigned(context.Background(), result.Key, "text/plain", 4, expires+1, u.Query().Get("signature"), bytes.NewReader([]byte("1234"))), ErrInvalidUploadSignature)

	require.NoError(t, os.Symlink(outside, filepath.Join(root, "nested")))
	err = putFromPresign(t, storage, result, "text/plain", []byte("1234"))
	assert.ErrorIs(t, err, ErrInvalidObjectKey)
	_, err = os.Stat(filepath.Join(outside, "u1/file.txt"))
	assert.ErrorIs(t, err, os.ErrNotExist)
}

func TestLocalPresignRejectsOverflowSizedInputs(t *testing.T) {
	storage := NewLocalFileStorageWithUploadBase(t.TempDir(), "http://example.test/files", "http://example.test/_local_upload")
	_, err := storage.PresignUpload(context.Background(), "users/u1/file.txt", "text/plain", int64(^uint64(0)>>1), 60)
	require.Error(t, err)
	_, err = storage.PresignUpload(context.Background(), "users/u1/file.txt", "text/plain", 1, maxLocalPresignTTL+1)
	require.Error(t, err)
}

func TestLocalPresignedPutRejectsActiveContentBeforePublicRead(t *testing.T) {
	storage := NewLocalFileStorageWithUploadBase(t.TempDir(), "http://example.test/files", "http://example.test/_local_upload")
	body := []byte("<!doctype html><script>alert(1)</script>")
	result, err := storage.PresignUpload(context.Background(), "users/avatars/u1/avatar.png", "image/png", int64(len(body)), 60)
	require.NoError(t, err)
	err = putFromPresign(t, storage, result, "image/png", body)
	assert.ErrorIs(t, err, ErrContentTypeMismatch)
	_, err = storage.HeadObject(context.Background(), result.Key)
	assert.ErrorIs(t, err, ErrObjectNotFound)
}

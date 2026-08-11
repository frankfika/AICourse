package uploads

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	ErrInvalidUploadSignature = errors.New("uploads: invalid local upload signature")
	ErrUploadExpired          = errors.New("uploads: local upload URL expired")
	ErrUploadTooLarge         = errors.New("uploads: local upload exceeds signed size")
	ErrObjectAlreadyExists    = errors.New("uploads: object already exists")
	ErrContentTypeMismatch    = errors.New("uploads: content type mismatch")
)

const (
	maxLocalUploadBytes = int64(500 * 1024 * 1024)
	maxLocalPresignTTL  = int32(60 * 60)
)

func NewLocalFileStorageWithUploadBase(rootDir, publicBase, uploadBase string) *LocalFileStorage {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		panic(fmt.Sprintf("uploads: generate local signing key: %v", err))
	}
	return &LocalFileStorage{
		RootDir:       rootDir,
		PublicBase:    strings.TrimRight(publicBase, "/"),
		UploadBaseURL: strings.TrimRight(uploadBase, "/"),
		signingKey:    secret,
		now:           time.Now,
	}
}

// PresignUpload returns an HMAC-authorized local PUT URL. The signature binds
// the generated key, normalized content type, declared size, and expiry.
func (s *LocalFileStorage) PresignUpload(_ context.Context, key, contentType string, maxBytes int64, expiresIn int32) (PresignResult, error) {
	if _, err := s.resolveObjectPath(key); err != nil {
		return PresignResult{}, err
	}
	if maxBytes <= 0 || maxBytes > maxLocalUploadBytes || expiresIn <= 0 || expiresIn > maxLocalPresignTTL {
		return PresignResult{}, errors.New("uploads: invalid local presign limits")
	}
	contentType = NormalizeContentType(contentType)
	expires := s.now().Add(time.Duration(expiresIn) * time.Second).Unix()
	query := url.Values{}
	query.Set("contentType", contentType)
	query.Set("maxBytes", fmt.Sprintf("%d", maxBytes))
	query.Set("expires", fmt.Sprintf("%d", expires))
	query.Set("signature", s.signUpload(key, contentType, maxBytes, expires))
	return PresignResult{
		UploadURL: s.UploadBaseURL + "/" + key + "?" + query.Encode(),
		PublicURL: s.PublicBase + "/" + key,
		Key:       key,
		ExpiresIn: expiresIn,
	}, nil
}

// PutPresigned atomically creates a signed local object. Existing objects are
// never overwritten; callers must request a fresh generated key.
func (s *LocalFileStorage) PutPresigned(_ context.Context, key, contentType string, maxBytes, expires int64, signature string, body io.Reader) error {
	contentType = NormalizeContentType(contentType)
	now := s.now().Unix()
	if expires < now {
		return ErrUploadExpired
	}
	if maxBytes <= 0 || maxBytes > maxLocalUploadBytes || expires > now+int64(maxLocalPresignTTL) {
		return ErrInvalidUploadSignature
	}
	provided, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil || !hmac.Equal(provided, s.signatureBytes(key, contentType, maxBytes, expires)) {
		return ErrInvalidUploadSignature
	}
	path, err := s.resolveObjectPath(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return fmt.Errorf("uploads: create local object directory: %w", err)
	}
	path, err = s.resolveObjectPath(key) // reject symlinks created meanwhile
	if err != nil {
		return err
	}
	if _, err := os.Lstat(path); err == nil {
		return ErrObjectAlreadyExists
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("uploads: inspect destination: %w", err)
	}

	tmp, err := os.CreateTemp(filepath.Dir(path), ".upload-*")
	if err != nil {
		return fmt.Errorf("uploads: create temporary object: %w", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	written, writeErr := io.Copy(tmp, io.LimitReader(body, maxBytes+1))
	if writeErr == nil && written > maxBytes {
		writeErr = ErrUploadTooLarge
	}
	if writeErr == nil {
		writeErr = tmp.Sync()
	}
	if closeErr := tmp.Close(); writeErr == nil {
		writeErr = closeErr
	}
	if writeErr != nil {
		return writeErr
	}
	detected, err := detectFileContentType(tmpName)
	if err != nil {
		return err
	}
	if !safeDetectedContentType(contentType, NormalizeContentType(detected)) {
		return fmt.Errorf("%w: declared %s, detected %s", ErrContentTypeMismatch, contentType, detected)
	}
	// Hard-linking the temp file is an atomic no-replace publish on the same
	// filesystem; unlike Rename it cannot overwrite an existing object.
	if err := os.Link(tmpName, path); err != nil {
		if errors.Is(err, os.ErrExist) {
			return ErrObjectAlreadyExists
		}
		return fmt.Errorf("uploads: publish local object: %w", err)
	}
	return nil
}

func (s *LocalFileStorage) OpenObject(ctx context.Context, key string) (*os.File, ObjectMeta, error) {
	meta, err := s.HeadObject(ctx, key)
	if err != nil {
		return nil, ObjectMeta{}, err
	}
	path, err := s.resolveObjectPath(key)
	if err != nil {
		return nil, ObjectMeta{}, err
	}
	f, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ObjectMeta{}, ErrObjectNotFound
	}
	if err != nil {
		return nil, ObjectMeta{}, fmt.Errorf("uploads: open local object: %w", err)
	}
	return f, meta, nil
}

func (s *LocalFileStorage) signUpload(key, contentType string, maxBytes, expires int64) string {
	return base64.RawURLEncoding.EncodeToString(s.signatureBytes(key, contentType, maxBytes, expires))
}

func (s *LocalFileStorage) signatureBytes(key, contentType string, maxBytes, expires int64) []byte {
	mac := hmac.New(sha256.New, s.signingKey)
	fmt.Fprintf(mac, "%s\n%s\n%d\n%d", key, contentType, maxBytes, expires)
	return mac.Sum(nil)
}

func NormalizeContentType(value string) string {
	return strings.ToLower(strings.TrimSpace(strings.SplitN(value, ";", 2)[0]))
}

func safeDetectedContentType(declared, detected string) bool {
	// Never publish browser-active content under a benign signed type. Public
	// reads are available before /complete, so validation must happen here.
	if strings.Contains(detected, "html") || strings.Contains(detected, "xml") || strings.Contains(detected, "javascript") {
		return false
	}
	if strings.HasPrefix(declared, "image/") {
		return declared == detected
	}
	if declared == "application/pdf" {
		return detected == declared
	}
	if declared == "text/plain" || declared == "text/markdown" {
		return detected == "text/plain"
	}
	// Go's 512-byte sniffer does not reliably identify every supported video,
	// archive, or audio codec. Those remain safe with attachment/nosniff reads.
	return true
}

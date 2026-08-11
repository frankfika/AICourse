// Package uploads — storage abstraction. Mirrors
// apps/api/src/modules/uploads/storage/storage.interface.ts.
//
// The Storage interface is intentionally tiny: presign, head, delete,
// public-url. Two impls ship today:
//
//  1. InMemoryStorage (default for dev / e2e tests):
//     - presign returns a synthetic uploadUrl that the test
//     can call TestSeed(key, body) to populate
//     - headObject reads from the in-process map
//     - getPublicUrlBase returns a configurable base
//
//  2. LocalFileStorage (production-like without S3):
//     - writes files under a configurable directory
//     - uploadUrl points at the same Fiber app's special
//     `/uploads/_local/<key>` route which writes the file
//     - headObject stats the file
//
// Real MinIO/S3 via aws-sdk-go-v2 is deferred (T16-3.1) — Frank's
// prod doesn't have S3 env wired up yet, and the API surface is
// identical, so swapping is a one-impl addition.
package uploads

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// PresignResult is the response from a successful presign call.
// Matches the JSON shape of apps/api/src/modules/uploads NestJS.
type PresignResult struct {
	UploadURL string `json:"uploadUrl"`
	PublicURL string `json:"publicUrl"`
	Key       string `json:"key"`
	ExpiresIn int32  `json:"expiresIn"`
}

// ObjectMeta is what HeadObject returns.
type ObjectMeta struct {
	Key         string
	Size        int64
	ContentType string
}

// ErrObjectNotFound is returned by HeadObject when the key doesn't exist.
var ErrObjectNotFound = errors.New("uploads: object not found")

// ErrInvalidObjectKey is returned when a local-storage key could address
// anything outside RootDir or traverse a symbolic link.
var ErrInvalidObjectKey = errors.New("uploads: invalid object key")

// Storage is the storage interface for the uploads module.
type Storage interface {
	// PresignUpload returns a (fake or real) uploadUrl that the
	// client uses to PUT the file body. The server doesn't see
	// the PUT in production (S3 handles it).
	PresignUpload(ctx context.Context, key, contentType string, maxBytes int64, expiresIn int32) (PresignResult, error)

	// HeadObject returns the object metadata. ErrObjectNotFound
	// if the key doesn't exist.
	HeadObject(ctx context.Context, key string) (ObjectMeta, error)

	// DeleteObject removes the object. Best-effort: errors are
	// logged but don't fail the request.
	DeleteObject(ctx context.Context, key string) error

	// GetPublicUrlBase returns the public URL prefix used to
	// build publicUrl on complete.
	GetPublicUrlBase() string
}

// =====================================================================
// InMemoryStorage — default for dev / e2e tests.
// =====================================================================

// InMemoryStorage is a thread-safe in-process blob store. Used for
// e2e tests where we don't want to wire a real S3 / local filesystem.
// The uploadUrl it returns is a fake URL — the test must call
// TestSeed(key, body) to make headObject find the data.
type InMemoryStorage struct {
	mu         sync.RWMutex
	blobs      map[string]memBlob
	publicBase string
}

type memBlob struct {
	contentType string
	body        []byte
}

// NewInMemoryStorage builds a new in-memory store. publicBase is
// what GetPublicUrlBase returns (e.g. "http://localhost:3000/static").
func NewInMemoryStorage(publicBase string) *InMemoryStorage {
	return &InMemoryStorage{
		blobs:      make(map[string]memBlob),
		publicBase: publicBase,
	}
}

// TestSeed stores a blob at key — for e2e tests simulating a browser PUT.
func (s *InMemoryStorage) TestSeed(key, contentType string, body []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.blobs[key] = memBlob{contentType: contentType, body: body}
}

// PresignUpload returns a fake uploadUrl. The test must TestSeed
// the key before calling complete.
func (s *InMemoryStorage) PresignUpload(_ context.Context, key, contentType string, _ int64, expiresIn int32) (PresignResult, error) {
	return PresignResult{
		UploadURL: s.publicBase + "/_test_upload/" + key,
		PublicURL: s.publicBase + "/" + key,
		Key:       key,
		ExpiresIn: expiresIn,
	}, nil
}

// HeadObject looks up the key in the in-memory map.
func (s *InMemoryStorage) HeadObject(_ context.Context, key string) (ObjectMeta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b, ok := s.blobs[key]
	if !ok {
		return ObjectMeta{}, ErrObjectNotFound
	}
	return ObjectMeta{
		Key:         key,
		Size:        int64(len(b.body)),
		ContentType: b.contentType,
	}, nil
}

// DeleteObject removes the key from the map.
func (s *InMemoryStorage) DeleteObject(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.blobs, key)
	return nil
}

// GetPublicUrlBase returns the configured public base.
func (s *InMemoryStorage) GetPublicUrlBase() string {
	return s.publicBase
}

// =====================================================================
// LocalFileStorage — files on local disk, suitable for dev / single-node prod.
// =====================================================================

// LocalFileStorage writes blobs under RootDir. The presigned uploadUrl
// points at the Fiber app's `/uploads/_local/<key>` route which writes
// the file to disk on PUT.
type LocalFileStorage struct {
	RootDir       string
	PublicBase    string
	UploadBaseURL string
	signingKey    []byte
	now           func() time.Time
}

// NewLocalFileStorage builds a local file store.
func NewLocalFileStorage(rootDir, publicBase string) *LocalFileStorage {
	uploadBase := strings.TrimSuffix(publicBase, "/files") + "/_local_upload"
	return NewLocalFileStorageWithUploadBase(rootDir, publicBase, uploadBase)
}

// HeadObject returns metadata for a regular file below RootDir.
func (s *LocalFileStorage) HeadObject(_ context.Context, key string) (ObjectMeta, error) {
	path, err := s.resolveObjectPath(key)
	if err != nil {
		return ObjectMeta{}, err
	}
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return ObjectMeta{}, ErrObjectNotFound
	}
	if err != nil {
		return ObjectMeta{}, fmt.Errorf("uploads: stat local object: %w", err)
	}
	if !info.Mode().IsRegular() {
		return ObjectMeta{}, ErrObjectNotFound
	}

	contentType, err := detectFileContentType(path)
	if err != nil {
		return ObjectMeta{}, err
	}
	return ObjectMeta{Key: key, Size: info.Size(), ContentType: contentType}, nil
}

// DeleteObject removes a regular file below RootDir. Missing objects are a
// successful no-op, matching object-storage delete semantics.
func (s *LocalFileStorage) DeleteObject(_ context.Context, key string) error {
	path, err := s.resolveObjectPath(key)
	if err != nil {
		return err
	}
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("uploads: inspect local object before delete: %w", err)
	}
	if !info.Mode().IsRegular() {
		return ErrInvalidObjectKey
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("uploads: delete local object: %w", err)
	}
	return nil
}

// GetPublicUrlBase returns the configured public base.
func (s *LocalFileStorage) GetPublicUrlBase() string {
	return s.PublicBase
}

// resolveObjectPath converts an object key to a local filename. Besides
// lexical traversal checks, every existing component is inspected with
// Lstat. Rejecting symlinks prevents a key below RootDir from escaping via a
// link to another directory and ensures DeleteObject never follows a link.
func (s *LocalFileStorage) resolveObjectPath(key string) (string, error) {
	if strings.TrimSpace(s.RootDir) == "" || key == "" || strings.ContainsRune(key, '\x00') || strings.Contains(key, `\`) || filepath.IsAbs(key) {
		return "", ErrInvalidObjectKey
	}
	for _, r := range key {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '/' || r == '-' || r == '_' || r == '.') {
			return "", ErrInvalidObjectKey
		}
	}
	clean := filepath.Clean(key)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", ErrInvalidObjectKey
	}

	root, err := filepath.Abs(s.RootDir)
	if err != nil {
		return "", fmt.Errorf("uploads: resolve local storage root: %w", err)
	}
	if resolved, evalErr := filepath.EvalSymlinks(root); evalErr == nil {
		root = resolved
	} else if !errors.Is(evalErr, os.ErrNotExist) {
		return "", fmt.Errorf("uploads: resolve local storage root: %w", evalErr)
	}

	path := filepath.Join(root, clean)
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", ErrInvalidObjectKey
	}

	current := root
	for _, component := range strings.Split(clean, string(filepath.Separator)) {
		current = filepath.Join(current, component)
		info, statErr := os.Lstat(current)
		if errors.Is(statErr, os.ErrNotExist) {
			break
		}
		if statErr != nil {
			return "", fmt.Errorf("uploads: inspect local object path: %w", statErr)
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", ErrInvalidObjectKey
		}
	}
	return path, nil
}

func detectFileContentType(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", ErrObjectNotFound
		}
		return "", fmt.Errorf("uploads: open local object: %w", err)
	}
	defer f.Close()

	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("uploads: read local object metadata: %w", err)
	}
	return http.DetectContentType(buf[:n]), nil
}

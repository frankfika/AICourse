package uploads

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestLocalFileStorageHeadObject(t *testing.T) {
	root := t.TempDir()
	key := "avatars/user/photo.png"
	path := filepath.Join(root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	body := []byte("\x89PNG\r\n\x1a\nfixture")
	if err := os.WriteFile(path, body, 0o600); err != nil {
		t.Fatal(err)
	}

	storage := NewLocalFileStorage(root, "http://localhost/uploads")
	meta, err := storage.HeadObject(context.Background(), key)
	if err != nil {
		t.Fatalf("HeadObject() error = %v", err)
	}
	if meta.Key != key || meta.Size != int64(len(body)) || meta.ContentType != "image/png" {
		t.Fatalf("HeadObject() = %#v", meta)
	}
}

func TestLocalFileStorageHeadObjectNotFound(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "http://localhost/uploads")
	_, err := storage.HeadObject(context.Background(), "missing/object.txt")
	if !errors.Is(err, ErrObjectNotFound) {
		t.Fatalf("HeadObject() error = %v, want ErrObjectNotFound", err)
	}
}

func TestLocalFileStorageRejectsUnsafeKeys(t *testing.T) {
	storage := NewLocalFileStorage(t.TempDir(), "http://localhost/uploads")
	keys := []string{
		"",
		"../outside.txt",
		"nested/../../outside.txt",
		filepath.Join(string(filepath.Separator), "absolute.txt"),
		`..\outside.txt`,
		"unsafe?query.txt",
		"unsafe#fragment.txt",
		"unsafe name.txt",
		"unsafe\nname.txt",
	}
	for _, key := range keys {
		t.Run(key, func(t *testing.T) {
			if _, err := storage.HeadObject(context.Background(), key); !errors.Is(err, ErrInvalidObjectKey) {
				t.Errorf("HeadObject(%q) error = %v, want ErrInvalidObjectKey", key, err)
			}
			if err := storage.DeleteObject(context.Background(), key); !errors.Is(err, ErrInvalidObjectKey) {
				t.Errorf("DeleteObject(%q) error = %v, want ErrInvalidObjectKey", key, err)
			}
		})
	}
}

func TestLocalFileStorageRejectsSymlinkEscape(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("creating symlinks requires additional privileges on Windows")
	}
	root := t.TempDir()
	outside := t.TempDir()
	outsideFile := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(outsideFile, []byte("do not touch"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Fatal(err)
	}

	storage := NewLocalFileStorage(root, "http://localhost/uploads")
	key := "escape/secret.txt"
	if _, err := storage.HeadObject(context.Background(), key); !errors.Is(err, ErrInvalidObjectKey) {
		t.Fatalf("HeadObject() error = %v, want ErrInvalidObjectKey", err)
	}
	if err := storage.DeleteObject(context.Background(), key); !errors.Is(err, ErrInvalidObjectKey) {
		t.Fatalf("DeleteObject() error = %v, want ErrInvalidObjectKey", err)
	}
	if _, err := os.Stat(outsideFile); err != nil {
		t.Fatalf("outside file was affected: %v", err)
	}
}

func TestLocalFileStorageDeleteObjectIsIdempotent(t *testing.T) {
	root := t.TempDir()
	key := "documents/report.txt"
	path := filepath.Join(root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("report"), 0o600); err != nil {
		t.Fatal(err)
	}

	storage := NewLocalFileStorage(root, "http://localhost/uploads")
	if err := storage.DeleteObject(context.Background(), key); err != nil {
		t.Fatalf("first DeleteObject() error = %v", err)
	}
	if err := storage.DeleteObject(context.Background(), key); err != nil {
		t.Fatalf("second DeleteObject() error = %v", err)
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("deleted file still exists or stat failed unexpectedly: %v", err)
	}
}

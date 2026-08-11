package handler

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	apimiddleware "github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/uploads"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestLocalUploadHandlerPutAndPublicRead(t *testing.T) {
	storage := uploads.NewLocalFileStorageWithUploadBase(t.TempDir(), "http://example.test/api/v1/uploads/files", "http://example.test/api/v1/uploads/_local_upload")
	h := NewUploadsHandler(nil, nil, zap.NewNop())
	app := fiber.New(fiber.Config{StreamRequestBody: true, BodyLimit: 1024, ErrorHandler: errs.Handler(zap.NewNop())})
	app.Use(requestid.New())
	app.Use(apimiddleware.LimitRequestBodyExceptLocalUpload(4))
	v1 := app.Group("/api/v1")
	h.MountLocal(v1, storage)
	app.Post("/json", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })
	jsonResp, err := app.Test(httptest.NewRequest(http.MethodPost, "/json", bytes.NewReader([]byte("12345"))))
	require.NoError(t, err)
	assert.Equal(t, http.StatusRequestEntityTooLarge, jsonResp.StatusCode)
	jsonResp.Body.Close()

	body := []byte("more than four bytes") // proves PUT bypasses the JSON-only 4-byte middleware limit
	presigned, err := storage.PresignUpload(context.Background(), "users/avatars/u1/file.txt", "text/plain", int64(len(body)), 60)
	require.NoError(t, err)
	u, err := url.Parse(presigned.UploadURL)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPut, u.RequestURI(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "text/plain")
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/uploads/files/"+presigned.Key, nil)
	getResp, err := app.Test(getReq)
	require.NoError(t, err)
	defer getResp.Body.Close()
	got, err := io.ReadAll(getResp.Body)
	require.NoError(t, err)
	assert.Equal(t, body, got)
	assert.Equal(t, "text/plain; charset=utf-8", getResp.Header.Get("Content-Type"))
	assert.Equal(t, "nosniff", getResp.Header.Get("X-Content-Type-Options"))
	assert.Equal(t, "attachment", getResp.Header.Get("Content-Disposition"))
}

func TestLocalUploadHandlerRejectsWrongContentType(t *testing.T) {
	storage := uploads.NewLocalFileStorageWithUploadBase(t.TempDir(), "http://example.test/api/v1/uploads/files", "http://example.test/api/v1/uploads/_local_upload")
	app := fiber.New(fiber.Config{StreamRequestBody: true, ErrorHandler: errs.Handler(zap.NewNop())})
	app.Use(requestid.New())
	NewUploadsHandler(nil, nil, zap.NewNop()).MountLocal(app.Group("/api/v1"), storage)
	presigned, err := storage.PresignUpload(context.Background(), "users/avatars/u1/file.png", "image/png", 4, 60)
	require.NoError(t, err)
	u, _ := url.Parse(presigned.UploadURL)
	req := httptest.NewRequest(http.MethodPut, u.RequestURI(), bytes.NewReader([]byte("1234")))
	req.Header.Set("Content-Type", "image/jpeg")
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

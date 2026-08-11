package handler

import (
	"testing"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

func TestCMSMountPublicDoesNotRequireTokenIssuer(t *testing.T) {
	app := fiber.New()
	v1 := app.Group("/api/v1")
	h := NewCMSHandler(nil, nil, zap.NewNop())
	h.MountPublic(v1)

	paths := make(map[string]bool)
	for _, route := range app.GetRoutes(true) {
		paths[route.Method+" "+route.Path] = true
	}
	if !paths["GET /api/v1/app-settings"] || !paths["GET /api/v1/i18n/messages"] {
		t.Fatalf("public CMS routes not mounted: %#v", paths)
	}
	if paths["GET /api/v1/admin/cms/app-settings"] {
		t.Fatal("MountPublic must not register admin CMS routes")
	}
}

func TestCMSMountAdminDoesNotDuplicatePublicRoutes(t *testing.T) {
	app := fiber.New()
	v1 := app.Group("/api/v1")
	h := NewCMSHandler(nil, nil, zap.NewNop())
	h.MountAdmin(v1)

	paths := make(map[string]int)
	for _, route := range app.GetRoutes(true) {
		paths[route.Method+" "+route.Path]++
	}
	if paths["GET /api/v1/admin/cms/app-settings"] != 1 {
		t.Fatalf("admin app-settings route count = %d, want 1", paths["GET /api/v1/admin/cms/app-settings"])
	}
	if paths["GET /api/v1/app-settings"] != 0 {
		t.Fatal("MountAdmin must not register public CMS routes")
	}
}

// Package handler — HTTP handlers for AI Academy Go API.
//
// Phase 0 scope: a single liveness handler that demonstrates the wiring
// between Fiber and the OpenAPI-generated `api/gen` package. The handler
// takes a generated response type (gen.HealthControllerLivenessV1OK —
// the canonical 200 response for GET /api/v1/health in the spec) and
// composes it with our runtime fields (env / version / request_id) so
// the JSON shape stays identical to the pre-migration /healthz payload.
//
// In Phase 1 this package will host handlers for /api/v1/{auth,courses,
// orders,...}; each will implement methods on a gen.Server type so the
// generated Handler interface is satisfied end-to-end.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/api/gen"
	"github.com/frankfika/ai-academy/api-go/internal/config"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// LivenessResponse is the JSON body of GET /healthz.
//
// We embed the OpenAPI-generated `HealthControllerLivenessV1OK` so the
// shape stays consistent with the spec for /api/v1/health. The current
// generated type is empty (the spec doesn't define a response body for
// the health endpoints) — we attach runtime fields on top of it. Once
// Phase 1 adds @ApiOkResponse decorators in the NestJS controllers, the
// generated type will gain fields; this struct picks them up via the
// embedded pointer automatically.
//
// JSON shape (must match pre-migration /healthz):
//
//	{
//	  "status": "ok",
//	  "env": "development",
//	  "version": "0.1.0",
//	  "request_id": "7796a26c-9aac-487c-822b-2f60c1e646e8"
//	}
type LivenessResponse struct {
	*gen.HealthControllerLivenessV1OK
	Status    string `json:"status"`
	Env       string `json:"env"`
	Version   string `json:"version"`
	RequestID string `json:"request_id"`
}

// Liveness returns a Fiber handler for GET /healthz.
//
// The handler:
//  1. Reads (or generates) a request_id from Fiber locals (set by the
//     requestid middleware registered in cmd/server/main.go).
//  2. Builds a LivenessResponse that embeds the OpenAPI-generated
//     HealthControllerLivenessV1OK type — this is the smoke test for
//     the gen package wiring.
//  3. Writes the same JSON shape the previous /healthz returned.
func Liveness(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// requestid middleware sets this. Generate one defensively in
		// case the middleware is not yet registered (unit tests).
		rid, _ := c.Locals("requestid").(string)
		if rid == "" {
			rid = uuid.NewString()
		}

		return c.JSON(LivenessResponse{
			HealthControllerLivenessV1OK: &gen.HealthControllerLivenessV1OK{},
			Status:                       "ok",
			Env:                          cfg.Env,
			Version:                      cfg.Version,
			RequestID:                    rid,
		})
	}
}

// Readiness returns a Fiber handler for GET /readyz. Phase 0 reports
// trivially ready; Phase 1 will probe MySQL/Redis/MinIO before returning
// 200.
func Readiness() fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ready"})
	}
}

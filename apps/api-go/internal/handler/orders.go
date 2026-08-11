// Package handler — Fiber HTTP handlers for the orders module.
//
// Phase 2 T13-2: ports the 5 endpoints of
// apps/api/src/modules/orders/orders.controller.ts.
//
// Routes:
//
//	GET    /orders/me                 list current user's orders
//	GET    /orders/:id                get one (ownership-checked)
//	POST   /orders                    create (free auto-enrolls, paid returns pending)
//	POST   /orders/:id/pay            dev-mode mock payment
//	POST   /orders/:id/cancel         cancel pending
//	POST   /orders/:id/refund         request refund (deferred to T15)
//
// All endpoints require auth. Payment endpoints (pay, refund) are
// dev-only — they 503 in production via cfg.Env check.
package handler

import (
	"github.com/frankfika/ai-academy/api-go/internal/auth"
	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/middleware"
	"github.com/frankfika/ai-academy/api-go/internal/orders"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// OrdersHandler bundles the service + JWT verifier + env flag.
type OrdersHandler struct {
	svc       *orders.Service
	tokens    auth.TokenIssuer
	env       string
	prodBlock bool
	log       *zap.Logger
}

// NewOrdersHandler builds a handler. env is used to gate pay/refund in
// production.
func NewOrdersHandler(svc *orders.Service, tokens auth.TokenIssuer, env string, log *zap.Logger) *OrdersHandler {
	return &OrdersHandler{svc: svc, tokens: tokens, env: env, prodBlock: env == "production", log: log}
}

// Mount registers all order routes.
func (h *OrdersHandler) Mount(router fiber.Router) {
	g := router.Group("/orders", middleware.RequireAuth(h.tokens))
	g.Get("/me", h.list)
	g.Get("/:id", h.get)
	g.Post("/", h.create)
	g.Post("/:id/pay", h.pay)
	g.Post("/:id/cancel", h.cancel)
	g.Post("/:id/refund", h.refund)
}

func (h *OrdersHandler) list(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	rows, err := h.svc.ListByUser(c.Context(), claims.UserID)
	if err != nil {
		return err
	}
	return c.JSON(rows)
}

func (h *OrdersHandler) get(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	row, err := h.svc.GetByID(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *OrdersHandler) create(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		Type          string `json:"type"`
		CourseID      string `json:"courseId"`
		DegreeID      string `json:"degreeId"`
		PaymentMethod string `json:"paymentMethod"`
	}
	if err := c.BodyParser(&body); err != nil {
		return errs.BadRequest("invalid request body")
	}
	res, err := h.svc.Create(c.Context(), claims.UserID, orders.APIInput{
		Type: body.Type, CourseID: body.CourseID, DegreeID: body.DegreeID,
		PaymentMethod: body.PaymentMethod,
	})
	if err != nil {
		return err
	}
	// NestJS: free → 201 with enrollment, paid → 201 with order.
	return c.Status(fiber.StatusCreated).JSON(res)
}

func (h *OrdersHandler) pay(c *fiber.Ctx) error {
	if h.prodBlock {
		return fiber.NewError(fiber.StatusServiceUnavailable,
			"支付通道尚未开放，请联系平台管理员")
	}
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	var body struct {
		PaymentMethod string `json:"paymentMethod"`
	}
	_ = c.BodyParser(&body) // body is optional in mock mode
	row, err := h.svc.MockPay(c.Context(), claims.UserID, c.Params("id"), body.PaymentMethod)
	if err != nil {
		return err
	}
	return c.JSON(row)
}

func (h *OrdersHandler) cancel(c *fiber.Ctx) error {
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	if err := h.svc.Cancel(c.Context(), claims.UserID, c.Params("id")); err != nil {
		return err
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (h *OrdersHandler) refund(c *fiber.Ctx) error {
	if h.prodBlock {
		return fiber.NewError(fiber.StatusServiceUnavailable,
			"支付通道尚未开放，请联系平台管理员")
	}
	claims := middleware.GetClaims(c)
	if claims == nil {
		return errs.Unauthorized("missing auth claims")
	}
	res, err := h.svc.RefundOrder(c.Context(), claims.UserID, c.Params("id"))
	if err != nil {
		return err
	}
	return c.JSON(res)
}

// Package chat — site-wide LLM chat / RAG endpoint. Mirrors
// apps/api/src/modules/chat/.
//
// Phase 2 T17. 5 endpoints (all require auth):
//
//	POST   /chat/sessions                  create general-scope session
//	GET    /chat/sessions                  list user's general sessions
//	GET    /chat/sessions/:id/messages     pull session messages (take 500)
//	POST   /chat/sessions/:id/messages     send a message (RAG + Gemini)
//	DELETE /chat/sessions/:id              hard-delete session
//
// Phase 2 T17 ships 4 of the 5 endpoints with full DB persistence.
// The send-message endpoint is wired with a "test mode" stub that
// returns a hardcoded assistant reply without calling Gemini. Real
// Gemini integration is a follow-up (T17.1) — needs Frank's
// GEMINI_API_KEY env and the RagService + GeminiService ports from
// apps/api/src/common/gemini.
package chat

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("chat: not found")

// Repo is the chat data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// Service is the chat business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// SessionSummary is the public shape of a chat session list row.
type SessionSummary struct {
	ID           string  `json:"id"`
	Title        *string `json:"title,omitempty"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
	MessageCount int32   `json:"messageCount"`
}

// MessageView is the public shape of a chat message.
type MessageView struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

// CreateSessionInput is the create payload.
type CreateSessionInput struct {
	Title string
}

// CreateSession creates a new general-scope chat session for the user.
func (s *Service) CreateSession(ctx context.Context, userID string, in CreateSessionInput) (string, *string, error) {
	now := time.Now().UTC()
	id := uuid.NewString()
	var titlePtr *string
	if t := in.Title; t != "" {
		titlePtr = &t
	}
	if _, err := s.repo.q.CreateChatSession(ctx, db.CreateChatSessionParams{
		ID:        id,
		UserID:    userID,
		LessonID:  sql.NullString{}, // general scope
		Title:     sql.NullString{String: in.Title, Valid: in.Title != ""},
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		return "", nil, errs.Internal("create chat session", err)
	}
	return id, titlePtr, nil
}

// ListSessions returns the user's general-scope chat sessions.
func (s *Service) ListSessions(ctx context.Context, userID string) ([]SessionSummary, error) {
	rows, err := s.repo.q.ListChatSessions(ctx, userID)
	if err != nil {
		return nil, errs.Internal("list chat sessions", err)
	}
	out := make([]SessionSummary, 0, len(rows))
	for _, r := range rows {
		out = append(out, SessionSummary{
			ID:           r.ID,
			Title:        nullableStringPtr(r.Title),
			CreatedAt:    r.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
			UpdatedAt:    r.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
			MessageCount: int32(r.MessageCount),
		})
	}
	return out, nil
}

// ListMessages returns all messages in a session (capped at 500).
func (s *Service) ListMessages(ctx context.Context, userID, sessionID string) ([]MessageView, error) {
	// Verify ownership first (defense in depth; the query also
	// filters on user_id but we want a clear 404 vs empty list).
	if _, err := s.requireOwnedSession(ctx, userID, sessionID); err != nil {
		return nil, err
	}
	rows, err := s.repo.q.ListChatMessages(ctx, sessionID)
	if err != nil {
		return nil, errs.Internal("list messages", err)
	}
	out := make([]MessageView, 0, len(rows))
	for _, r := range rows {
		out = append(out, MessageView{
			ID:        r.ID,
			Role:      string(r.Role),
			Content:   r.Content,
			CreatedAt: r.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		})
	}
	return out, nil
}

// DeleteSession hard-deletes a session (cascades to messages).
func (s *Service) DeleteSession(ctx context.Context, userID, sessionID string) error {
	// Verify ownership before delete (so we 404 instead of 0-rows-deleted)
	if _, err := s.requireOwnedSession(ctx, userID, sessionID); err != nil {
		return err
	}
	n, err := s.repo.q.DeleteChatSession(ctx, db.DeleteChatSessionParams{
		ID:     sessionID,
		UserID: userID,
	})
	if err != nil {
		return errs.Internal("delete chat session", err)
	}
	if n == 0 {
		return errs.NotFound("Chat session not found")
	}
	return nil
}

// SendMessageInput is the send-message payload.
type SendMessageInput struct {
	Content string
}

// AnswerResult is the response from sendMessage.
type AnswerResult struct {
	UserMsg      MessageView `json:"userMsg"`
	AssistantMsg MessageView `json:"assistantMsg"`
	Sources      []RagSource `json:"sources"`
}

// RagSource is a citation in the assistant's response.
type RagSource struct {
	Type string `json:"type"`
	ID   string `json:"id"`
	URL  string `json:"url"`
}

// SendMessage persists the user's message and returns a stub
// assistant reply. Real Gemini + RAG integration is T17.1.
//
// In dev/test, the assistant reply is a deterministic echo so
// e2e tests can verify the user-message persistence + 200 OK
// without needing a GEMINI_API_KEY.
func (s *Service) SendMessage(ctx context.Context, userID, sessionID string, in SendMessageInput) (AnswerResult, error) {
	if in.Content == "" {
		return AnswerResult{}, errs.BadRequest("content required")
	}
	// Verify ownership
	if _, err := s.requireOwnedSession(ctx, userID, sessionID); err != nil {
		return AnswerResult{}, err
	}
	now := time.Now().UTC()
	// Persist user message
	userMsgID := uuid.NewString()
	if _, err := s.repo.q.CreateChatMessage(ctx, db.CreateChatMessageParams{
		ID:        userMsgID,
		SessionID: sessionID,
		Role:      db.ChatMessagesRoleUser,
		Content:   in.Content,
		CreatedAt: now,
	}); err != nil {
		return AnswerResult{}, errs.Internal("save user message", err)
	}
	// Bump session updated_at
	if err := s.repo.q.TouchChatSession(ctx, db.TouchChatSessionParams{
		UpdatedAt: now,
		ID:        sessionID,
	}); err != nil {
		s.log.Warn("touch chat session failed", zap.Error(err))
	}
	// Stub assistant reply
	asstMsgID := uuid.NewString()
	asstContent := stubAssistantReply(in.Content)
	asstTime := time.Now().UTC()
	if _, err := s.repo.q.CreateChatMessage(ctx, db.CreateChatMessageParams{
		ID:        asstMsgID,
		SessionID: sessionID,
		Role:      db.ChatMessagesRoleAssistant,
		Content:   asstContent,
		CreatedAt: asstTime,
	}); err != nil {
		return AnswerResult{}, errs.Internal("save assistant message", err)
	}
	return AnswerResult{
		UserMsg: MessageView{
			ID:        userMsgID,
			Role:      "user",
			Content:   in.Content,
			CreatedAt: now.UTC().Format("2006-01-02T15:04:05.000Z"),
		},
		AssistantMsg: MessageView{
			ID:        asstMsgID,
			Role:      "assistant",
			Content:   asstContent,
			CreatedAt: asstTime.UTC().Format("2006-01-02T15:04:05.000Z"),
		},
		Sources: []RagSource{},
	}, nil
}

// requireOwnedSession returns ErrNotFound if the session doesn't
// belong to the user or doesn't exist.
func (s *Service) requireOwnedSession(ctx context.Context, userID, sessionID string) (db.ChatSession, error) {
	sess, err := s.repo.q.GetChatSession(ctx, db.GetChatSessionParams{
		ID:     sessionID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.ChatSession{}, errs.NotFound("Chat session not found")
		}
		return db.ChatSession{}, fmt.Errorf("chat: get session: %w", err)
	}
	return sess, nil
}

func nullableStringPtr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

// stubAssistantReply is a deterministic echo used in dev/test.
// Real Gemini integration (T17.1) will replace this with a call
// to the GeminiService + RagService.
func stubAssistantReply(userContent string) string {
	return "（测试模式 stub 回复）我已收到你的消息：「" + truncate(userContent, 100) + "」。正式 Gemini 集成在 T17.1 落地。"
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

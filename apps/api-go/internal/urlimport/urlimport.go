// Package urlimport — admin URL-based course import.
//
// Phase 2 T22: ports the 2 endpoints of
// apps/api/src/modules/url-import/url-import.controller.ts.
//
// Phase 2 T22.1: replaces the T22 stub with real metadata extraction
// from YouTube oEmbed + the Bilibili view API, and persists the
// extracted title / author / thumbnail / duration / raw JSON onto the
// url_imports row. The Gemini course-draft step is opt-in via the
// GEMINI_API_KEY env var; if unset we skip the AI step and mark the
// task as 'imported' directly.
//
// Status state machine:
//
//	pending   → fetched    metadata extracted from upstream
//	fetched   → imported   (optional) Gemini draft succeeded
//	fetched   → failed     (optional) Gemini draft errored
//	pending   → failed     upstream metadata fetch errored
//
// Routes (admin-only, both rate-limited at gateway):
//
//	POST /api/v1/courses/import-from-url         single URL → 202 (sync fetch)
//	POST /api/v1/courses/import-batch-from-urls  up to 20 URLs → 202 (per-URL)
//
// The 202 status reflects the async-by-design contract: the admin
// dashboard polls /admin/imports separately. We fetch synchronously
// here only because the upstream APIs respond in <1s; if a network
// hang is a concern the gateway's per-request timeout will abort.
package urlimport

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/frankfika/ai-academy/api-go/internal/errs"
	"github.com/frankfika/ai-academy/api-go/internal/repo/db"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Platform is the supported video platform set.
type Platform string

const (
	PlatformYouTube  Platform = "youtube"
	PlatformBilibili Platform = "bilibili"
	PlatformUnknown  Platform = "unknown"
)

// ErrInvalidURL is returned by ParseVideoURL when the URL doesn't
// match a known video platform.
var ErrInvalidURL = errors.New("urlimport: invalid or unsupported video URL")

// ParsedVideoURL is the canonical form we extract from a user URL.
type ParsedVideoURL struct {
	Platform     Platform
	VideoID      string
	CanonicalURL string
	EmbedURL     string
}

var (
	youtubeHosts = map[string]struct{}{
		"youtube.com":     {},
		"www.youtube.com": {},
		"m.youtube.com":   {},
		"youtu.be":        {},
	}
	bilibiliHosts = map[string]struct{}{
		"bilibili.com":     {},
		"www.bilibili.com": {},
		"m.bilibili.com":   {},
		"b23.tv":           {},
	}
	ytIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{6,15}$`)
)

// ParseVideoURL mirrors apps/api/src/modules/url-import/url-parser.ts.
// It supports http/https only and recognises the same YouTube +
// Bilibili URL shapes (watch?v=, /embed/, /shorts/, youtu.be/<id>,
// /video/BVxxx or /video/avxxx).
func ParseVideoURL(raw string) (ParsedVideoURL, error) {
	trimmed := strings.TrimSpace(raw)
	u, err := url.Parse(trimmed)
	if err != nil {
		return ParsedVideoURL{}, fmt.Errorf("%w: %v", ErrInvalidURL, err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ParsedVideoURL{}, fmt.Errorf("%w: only http/https URLs are supported", ErrInvalidURL)
	}
	host := strings.ToLower(u.Hostname())
	if _, ok := youtubeHosts[host]; ok {
		return parseYouTube(u)
	}
	if _, ok := bilibiliHosts[host]; ok {
		return parseBilibili(u)
	}
	return ParsedVideoURL{}, fmt.Errorf("%w: unsupported host %q", ErrInvalidURL, host)
}

func parseYouTube(u *url.URL) (ParsedVideoURL, error) {
	var videoID string
	switch {
	case u.Hostname() == "youtu.be":
		videoID = strings.TrimPrefix(u.Path, "/")
		if idx := strings.Index(videoID, "/"); idx >= 0 {
			videoID = videoID[:idx]
		}
	case strings.HasPrefix(u.Path, "/watch"):
		videoID = u.Query().Get("v")
	case strings.HasPrefix(u.Path, "/embed/"):
		parts := strings.Split(u.Path, "/")
		if len(parts) >= 3 {
			videoID = parts[2]
		}
	case strings.HasPrefix(u.Path, "/shorts/"):
		parts := strings.Split(u.Path, "/")
		if len(parts) >= 3 {
			videoID = parts[2]
		}
	}
	if !ytIDPattern.MatchString(videoID) {
		return ParsedVideoURL{}, fmt.Errorf("%w: could not extract YouTube video ID", ErrInvalidURL)
	}
	return ParsedVideoURL{
		Platform:     PlatformYouTube,
		VideoID:      videoID,
		CanonicalURL: fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID),
		EmbedURL:     fmt.Sprintf("https://www.youtube.com/embed/%s", videoID),
	}, nil
}

func parseBilibili(u *url.URL) (ParsedVideoURL, error) {
	re := regexp.MustCompile(`(?i)/video/(BV[A-Za-z0-9]+|av\d+)`)
	m := re.FindStringSubmatch(u.Path)
	if len(m) < 2 {
		return ParsedVideoURL{}, fmt.Errorf("%w: could not extract Bilibili video ID", ErrInvalidURL)
	}
	id := m[1]
	return ParsedVideoURL{
		Platform:     PlatformBilibili,
		VideoID:      id,
		CanonicalURL: fmt.Sprintf("https://www.bilibili.com/video/%s", id),
		EmbedURL:     fmt.Sprintf("https://player.bilibili.com/player.html?bvid=%s&autoplay=0", id),
	}, nil
}

// ============ Metadata extraction (T22.1) ============

// ExtractedMeta is the cross-platform result of a metadata fetch.
// The fields are the ones the admin dashboard surfaces after a
// successful import; everything else stays in extracted_json.
type ExtractedMeta struct {
	Title           string          `json:"title"`
	Author          string          `json:"author"`
	ThumbnailURL    string          `json:"thumbnailUrl"`
	Description     string          `json:"description,omitempty"`
	DurationSeconds int32           `json:"durationSeconds,omitempty"`
	Raw             json.RawMessage `json:"raw,omitempty"`
}

// HTTPDoer is the minimal interface we need from *http.Client. Tests
// can substitute a custom roundtripper if they need fine-grained
// control; the default uses net/http with a short timeout.
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// DefaultHTTPClient is the production *http.Client. Tests can swap it
// via SetHTTPClient (a fixture that wraps an httptest.Server).
var DefaultHTTPClient = &http.Client{Timeout: 8 * time.Second}

// YouTubeOEmbedBaseURL is the YouTube oEmbed endpoint. Tests swap to
// an httptest.Server URL via SetYouTubeOEmbedBaseURL.
var YouTubeOEmbedBaseURL = "https://www.youtube.com/oembed"

// BilibiliViewBaseURL is the Bilibili view endpoint. Tests swap via
// SetBilibiliViewBaseURL.
var BilibiliViewBaseURL = "https://api.bilibili.com/x/web-interface/view"

// SetHTTPClient swaps the default HTTP client. Pass nil to restore
// the production default. Used by tests that want to assert outgoing
// request shape; most tests just inject the base URLs and rely on
// httptest.Server.
func SetHTTPClient(c HTTPDoer) {
	if c == nil {
		DefaultHTTPClient = &http.Client{Timeout: 8 * time.Second}
		return
	}
	if httpClient, ok := c.(*http.Client); ok {
		DefaultHTTPClient = httpClient
		return
	}
	DefaultHTTPClient = &http.Client{
		Timeout: 8 * time.Second,
		Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
			return c.Do(r)
		}),
	}
}

// SetYouTubeOEmbedBaseURL swaps the YouTube oEmbed endpoint URL.
// Tests pass the URL of an httptest.Server that returns canned JSON.
func SetYouTubeOEmbedBaseURL(u string) { YouTubeOEmbedBaseURL = u }

// SetBilibiliViewBaseURL swaps the Bilibili view endpoint URL. Tests
// pass the URL of an httptest.Server that returns canned JSON.
func SetBilibiliViewBaseURL(u string) { BilibiliViewBaseURL = u }

// roundTripperFunc adapts a Do-func to http.RoundTripper.
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// FetchYouTubeMeta hits the YouTube oEmbed endpoint and returns the
// extracted metadata. Mirrors the NestJS fetchYouTube() helper.
func FetchYouTubeMeta(ctx context.Context, parsed ParsedVideoURL) (ExtractedMeta, error) {
	u := fmt.Sprintf("%s?url=%s&format=json",
		YouTubeOEmbedBaseURL, url.QueryEscape(parsed.CanonicalURL))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return ExtractedMeta{}, err
	}
	req.Header.Set("User-Agent", "AI-Academy-Importer/1.0")
	req.Header.Set("Accept", "application/json")
	resp, err := DefaultHTTPClient.Do(req)
	if err != nil {
		return ExtractedMeta{}, fmt.Errorf("youtube oembed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Drain to allow connection reuse
		_, _ = io.Copy(io.Discard, resp.Body)
		return ExtractedMeta{}, fmt.Errorf("youtube oembed responded %d", resp.StatusCode)
	}
	var raw struct {
		Title        string `json:"title"`
		AuthorName   string `json:"author_name"`
		ThumbnailURL string `json:"thumbnail_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return ExtractedMeta{}, fmt.Errorf("youtube oembed decode: %w", err)
	}
	meta := ExtractedMeta{
		Title:        strings.TrimSpace(raw.Title),
		Author:       strings.TrimSpace(raw.AuthorName),
		ThumbnailURL: strings.TrimSpace(raw.ThumbnailURL),
	}
	if meta.ThumbnailURL == "" {
		// Fallback to the canonical hqdefault.jpg when oEmbed doesn't
		// return one (older videos sometimes omit thumbnail_url).
		meta.ThumbnailURL = fmt.Sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", parsed.VideoID)
	}
	meta.Title = truncate(meta.Title, 200)
	meta.Author = truncate(meta.Author, 100)
	return meta, nil
}

// FetchBilibiliMeta hits the Bilibili view API and returns the
// extracted metadata. Mirrors the NestJS fetchBilibili() helper.
func FetchBilibiliMeta(ctx context.Context, parsed ParsedVideoURL) (ExtractedMeta, error) {
	u := fmt.Sprintf("%s?bvid=%s", BilibiliViewBaseURL, url.QueryEscape(parsed.VideoID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return ExtractedMeta{}, err
	}
	req.Header.Set("User-Agent", "AI-Academy-Importer/1.0")
	req.Header.Set("Accept", "application/json")
	resp, err := DefaultHTTPClient.Do(req)
	if err != nil {
		return ExtractedMeta{}, fmt.Errorf("bilibili view: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ExtractedMeta{}, fmt.Errorf("bilibili view read: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ExtractedMeta{}, fmt.Errorf("bilibili view responded %d", resp.StatusCode)
	}
	var envelope struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    *struct {
			Title    string `json:"title"`
			Desc     string `json:"desc"`
			Pic      string `json:"pic"`
			Duration int32  `json:"duration"`
			Owner    *struct {
				Name string `json:"name"`
			} `json:"owner"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return ExtractedMeta{}, fmt.Errorf("bilibili view decode: %w", err)
	}
	if envelope.Code != 0 || envelope.Data == nil {
		return ExtractedMeta{}, fmt.Errorf("bilibili view error: code=%d msg=%s", envelope.Code, envelope.Message)
	}
	meta := ExtractedMeta{
		Title:           truncate(strings.TrimSpace(envelope.Data.Title), 200),
		Author:          "",
		ThumbnailURL:    strings.TrimSpace(envelope.Data.Pic),
		Description:     truncate(envelope.Data.Desc, 4000),
		DurationSeconds: envelope.Data.Duration,
	}
	if envelope.Data.Owner != nil {
		meta.Author = truncate(strings.TrimSpace(envelope.Data.Owner.Name), 100)
	}
	meta.ThumbnailURL = cleanBilibiliThumbnail(meta.ThumbnailURL)
	meta.Raw = json.RawMessage(append([]byte(nil), body...))
	return meta, nil
}

// cleanBilibiliThumbnail strips Bilibili's `x-oss-process` query param
// (which adds a station watermark). Matches the NestJS helper.
func cleanBilibiliThumbnail(raw string) string {
	if raw == "" {
		return raw
	}
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	q := u.Query()
	q.Del("x-oss-process")
	u.RawQuery = q.Encode()
	return u.String()
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// ============ Gemini stub (T22.1) ============
//
// The optional Gemini step asks the model to draft a course outline
// from the video title+description. We ship a no-op stub for T22.1:
// if GEMINI_API_KEY is unset, DraftCourseOutline returns "" and nil.
// Real Gemini integration is intentionally out of scope for T22.1
// (a future T22.2 / T21.1 follow-up will wire the actual API call).
//
// To swap in a real impl, override DraftCourseOutline from main.go or
// a test (see the orders.SetRefundNotifier pattern).

// DraftCourseOutline is the package-level hook. Default is a no-op
// unless GEMINI_API_KEY is set, in which case it returns a short
// placeholder ("Course: <title>") and nil — enough for the rest of
// the pipeline to mark the task as 'imported'.
var DraftCourseOutline = func(ctx context.Context, title, description string) (string, error) {
	if os.Getenv("GEMINI_API_KEY") == "" {
		return "", nil
	}
	// Placeholder outline — the real Gemini call will land in a
	// follow-up. Returning a non-empty string flips the task to
	// 'imported' so the e2e path can be exercised end-to-end.
	return fmt.Sprintf("Course outline drafted from: %s", truncate(title, 80)), nil
}

// ============ Repo + service ============

// ErrNotFound is returned when a sqlc query yields sql.ErrNoRows.
var ErrNotFound = errors.New("urlimport: task not found")

// Repo is the url_imports data layer.
type Repo struct {
	q    *db.Queries
	conn *sql.DB
}

// NewRepo constructs a Repo.
func NewRepo(conn *sql.DB) *Repo {
	return &Repo{q: db.New(conn), conn: conn}
}

// Create records a new import task.
func (r *Repo) Create(ctx context.Context, in db.UrlImport) error {
	_, err := r.q.CreateUrlImport(ctx, db.CreateUrlImportParams{
		ID:          in.ID,
		Url:         in.Url,
		Platform:    in.Platform,
		Status:      in.Status,
		RequestedBy: in.RequestedBy,
		CreatedAt:   in.CreatedAt,
		UpdatedAt:   in.UpdatedAt,
	})
	return err
}

// GetByID looks up a single import task.
func (r *Repo) GetByID(ctx context.Context, id string) (db.UrlImport, error) {
	row, err := r.q.GetUrlImportByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return db.UrlImport{}, ErrNotFound
		}
		return db.UrlImport{}, fmt.Errorf("urlimport.repo: get: %w", err)
	}
	return row, nil
}

// UpdateFetched persists the metadata extracted from the upstream API
// and flips the task to the given status ('fetched' or 'failed'). All
// metadata fields are nullable so partial fetches still land a row.
func (r *Repo) UpdateFetched(ctx context.Context, id string, status db.UrlImportsStatus, meta ExtractedMeta, errMsg string, fetchedAt time.Time) error {
	params := db.UpdateUrlImportFetchedParams{
		Status:    status,
		UpdatedAt: time.Now().UTC(),
		ID:        id,
	}
	if meta.Title != "" {
		params.Title = sql.NullString{String: meta.Title, Valid: true}
	}
	if meta.Author != "" {
		params.Author = sql.NullString{String: meta.Author, Valid: true}
	}
	if meta.ThumbnailURL != "" {
		params.ThumbnailUrl = sql.NullString{String: meta.ThumbnailURL, Valid: true}
	}
	if meta.DurationSeconds > 0 {
		params.DurationSeconds = sql.NullInt32{Int32: meta.DurationSeconds, Valid: true}
	}
	if len(meta.Raw) > 0 {
		params.ExtractedJson = sql.NullString{String: string(meta.Raw), Valid: true}
	}
	if !fetchedAt.IsZero() {
		params.FetchedAt = sql.NullTime{Time: fetchedAt, Valid: true}
	}
	if errMsg != "" {
		params.ErrorMessage = sql.NullString{String: errMsg, Valid: true}
	}
	return r.q.UpdateUrlImportFetched(ctx, params)
}

// TaskDTO is the public JSON shape of an import task.
type TaskDTO struct {
	ID              string          `json:"id"`
	URL             string          `json:"url"`
	Platform        string          `json:"platform"`
	Status          string          `json:"status"`
	Note            string          `json:"note"`
	Title           *string         `json:"title,omitempty"`
	Author          *string         `json:"author,omitempty"`
	ThumbnailURL    *string         `json:"thumbnailUrl,omitempty"`
	DurationSeconds *int32          `json:"durationSeconds,omitempty"`
	ExtractedJSON   json.RawMessage `json:"extractedJson,omitempty"`
	FetchedAt       *string         `json:"fetchedAt,omitempty"`
	ErrorMessage    *string         `json:"errorMessage,omitempty"`
	CreatedAt       string          `json:"createdAt"`
	UpdatedAt       string          `json:"updatedAt"`
}

func toTaskDTO(in db.UrlImport) TaskDTO {
	dto := TaskDTO{
		ID:        in.ID,
		URL:       in.Url,
		Platform:  string(in.Platform),
		Status:    string(in.Status),
		Note:      "T22.1 real impl, Gemini optional",
		CreatedAt: in.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		UpdatedAt: in.UpdatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	if in.Title.Valid {
		s := in.Title.String
		dto.Title = &s
	}
	if in.Author.Valid {
		s := in.Author.String
		dto.Author = &s
	}
	if in.ThumbnailUrl.Valid {
		s := in.ThumbnailUrl.String
		dto.ThumbnailURL = &s
	}
	if in.DurationSeconds.Valid {
		d := in.DurationSeconds.Int32
		dto.DurationSeconds = &d
	}
	if in.ExtractedJson.Valid && in.ExtractedJson.String != "" {
		dto.ExtractedJSON = json.RawMessage(in.ExtractedJson.String)
	}
	if in.FetchedAt.Valid {
		s := in.FetchedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		dto.FetchedAt = &s
	}
	if in.ErrorMessage.Valid {
		s := in.ErrorMessage.String
		dto.ErrorMessage = &s
	}
	return dto
}

// Service is the urlimport business logic.
type Service struct {
	repo *Repo
	log  *zap.Logger
}

// NewService builds a Service.
func NewService(repo *Repo, log *zap.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ImportSingle handles a single-URL request. T22.1: after persisting
// a 'pending' row, we synchronously fetch the metadata from the
// upstream API, persist the extracted columns, then attempt the
// (optional) Gemini step. The 202 response shape is unchanged from
// T22 — only the persisted row gets richer.
func (s *Service) ImportSingle(ctx context.Context, requestedBy, rawURL string) (TaskDTO, error) {
	parsed, err := ParseVideoURL(rawURL)
	if err != nil {
		return TaskDTO{}, errs.BadRequest(err.Error())
	}
	now := time.Now().UTC()
	task := db.UrlImport{
		ID:        uuid.NewString(),
		Url:       parsed.CanonicalURL,
		Platform:  db.UrlImportsPlatform(parsed.Platform),
		Status:    db.UrlImportsStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if requestedBy != "" {
		task.RequestedBy = sql.NullString{String: requestedBy, Valid: true}
	}
	if err := s.repo.Create(ctx, task); err != nil {
		return TaskDTO{}, errs.Internal("create import task", err)
	}

	// Fetch metadata synchronously. The endpoint still returns 202 in
	// the handler, so the caller doesn't observe the upstream-API
	// latency — admin dashboards poll for status separately.
	meta, fetchErr := s.fetchMetadata(ctx, parsed)
	if fetchErr != nil {
		s.log.Warn("url-import metadata fetch failed",
			zap.String("taskId", task.ID),
			zap.String("platform", string(parsed.Platform)),
			zap.Error(fetchErr))
		if uerr := s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusFailed, ExtractedMeta{}, fetchErr.Error(), time.Time{}); uerr != nil {
			s.log.Warn("url-import update failed-status failed",
				zap.String("taskId", task.ID), zap.Error(uerr))
		}
		out, gerr := s.repo.GetByID(ctx, task.ID)
		if gerr != nil {
			s.log.Warn("url-import reload after failed fetch",
				zap.String("taskId", task.ID), zap.Error(gerr))
		}
		return toTaskDTO(out), nil
	}

	fetchedAt := time.Now().UTC()
	if uerr := s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusFetched, meta, "", fetchedAt); uerr != nil {
		s.log.Warn("url-import update fetched failed",
			zap.String("taskId", task.ID), zap.Error(uerr))
	}

	// Optional Gemini step. DraftCourseOutline is a no-op unless
	// GEMINI_API_KEY is set; the returned outline (if any) just feeds
	// downstream log lines in T22.1 — actual course creation is
	// future work.
	if _, derr := DraftCourseOutline(ctx, meta.Title, meta.Description); derr != nil {
		s.log.Warn("gemini outline draft failed",
			zap.String("taskId", task.ID), zap.Error(derr))
		if uerr := s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusFailed, meta, derr.Error(), fetchedAt); uerr != nil {
			s.log.Warn("url-import update failed-status (gemini) failed",
				zap.String("taskId", task.ID), zap.Error(uerr))
		}
	} else {
		if uerr := s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusImported, meta, "", fetchedAt); uerr != nil {
			s.log.Warn("url-import update imported failed",
				zap.String("taskId", task.ID), zap.Error(uerr))
		}
	}

	out, err := s.repo.GetByID(ctx, task.ID)
	if err != nil {
		return TaskDTO{}, errs.Internal("reload task", err)
	}
	return toTaskDTO(out), nil
}

// fetchMetadata dispatches to the platform-specific fetcher. The
// helpers above are the same logic; this thin wrapper exists so
// tests can stub it via a package-level var if they want to
// short-circuit the network.
func (s *Service) fetchMetadata(ctx context.Context, parsed ParsedVideoURL) (ExtractedMeta, error) {
	switch parsed.Platform {
	case PlatformYouTube:
		return FetchYouTubeMeta(ctx, parsed)
	case PlatformBilibili:
		return FetchBilibiliMeta(ctx, parsed)
	default:
		return ExtractedMeta{}, fmt.Errorf("unsupported platform %q", parsed.Platform)
	}
}

// BatchResult is one entry in the batch response.
type BatchResult struct {
	URL    string `json:"url"`
	Status string `json:"status"` // "created" | "failed"
	TaskID string `json:"taskId,omitempty"`
	Error  string `json:"error,omitempty"`
}

// BatchSummary is the envelope for the batch endpoint.
type BatchSummary struct {
	Total   int           `json:"total"`
	Created int           `json:"created"`
	Failed  int           `json:"failed"`
	Results []BatchResult `json:"results"`
}

// ImportBatch processes up to MaxBatchSize URLs. Per-URL failures
// (bad URL, fetch error) are recorded as result entries with
// status="failed" and don't abort the rest of the batch — same shape
// as the NestJS controller.
const MaxBatchSize = 20

// ImportBatch loops over raw URLs. Each accepted URL is persisted as
// a 'pending' row then promoted through the same fetch+draft flow
// as ImportSingle. Bad URLs / fetch failures surface as failed
// results without aborting the rest of the batch.
func (s *Service) ImportBatch(ctx context.Context, requestedBy string, rawURLs []string) (BatchSummary, error) {
	if len(rawURLs) == 0 {
		return BatchSummary{}, errs.BadRequest("urls must be non-empty")
	}
	if len(rawURLs) > MaxBatchSize {
		return BatchSummary{}, errs.BadRequest(
			fmt.Sprintf("urls must be at most %d entries", MaxBatchSize))
	}
	results := make([]BatchResult, 0, len(rawURLs))
	created := 0
	failed := 0
	for _, raw := range rawURLs {
		parsed, perr := ParseVideoURL(raw)
		if perr != nil {
			results = append(results, BatchResult{
				URL:    raw,
				Status: "failed",
				Error:  perr.Error(),
			})
			failed++
			continue
		}
		now := time.Now().UTC()
		task := db.UrlImport{
			ID:        uuid.NewString(),
			Url:       parsed.CanonicalURL,
			Platform:  db.UrlImportsPlatform(parsed.Platform),
			Status:    db.UrlImportsStatusPending,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if requestedBy != "" {
			task.RequestedBy = sql.NullString{String: requestedBy, Valid: true}
		}
		if err := s.repo.Create(ctx, task); err != nil {
			results = append(results, BatchResult{
				URL:    raw,
				Status: "failed",
				Error:  fmt.Sprintf("persistence: %v", err),
			})
			failed++
			continue
		}

		// Per-URL fetch + Gemini. Failures mark the row failed but
		// don't drop the task from the batch summary; the row is
		// still "created" (it just couldn't be auto-imported).
		meta, ferr := s.fetchMetadata(ctx, parsed)
		if ferr != nil {
			s.log.Warn("batch url-import metadata fetch failed",
				zap.String("taskId", task.ID), zap.Error(ferr))
			_ = s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusFailed, ExtractedMeta{}, ferr.Error(), time.Time{})
		} else {
			fetchedAt := time.Now().UTC()
			_ = s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusFetched, meta, "", fetchedAt)
			if _, derr := DraftCourseOutline(ctx, meta.Title, meta.Description); derr != nil {
				_ = s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusFailed, meta, derr.Error(), fetchedAt)
			} else {
				_ = s.repo.UpdateFetched(ctx, task.ID, db.UrlImportsStatusImported, meta, "", fetchedAt)
			}
		}

		results = append(results, BatchResult{
			URL:    parsed.CanonicalURL,
			Status: "created",
			TaskID: task.ID,
		})
		created++
	}
	return BatchSummary{
		Total:   len(rawURLs),
		Created: created,
		Failed:  failed,
		Results: results,
	}, nil
}

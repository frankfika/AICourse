// Package e2e — sitemap.xml end-to-end test.
//
// Phase 2 T23: covers the public /sitemap.xml endpoint from
// apps/api/src/modules/cms/sitemap.controller.ts.
//
// Sitemap is public (no auth) and returns application/xml. It lists
// all published courses / degrees / hackathons + a small set of
// static pages (home, courses, degrees, hackathons, enterprise,
// search). The /sitemap.xml path is mounted at the project root, not
// under /api/v1.
//
// We use the shared setupCMSEnv helper (in cms_test.go) so each test
// spins up an independent dockertest MySQL container. This matches
// the convention in every other T11–T22 module's e2e files.
package e2e

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestSitemap_NoAuth_200 — sitemap is public; the handler must
// return 200 without a Bearer token.
func TestSitemap_NoAuth_200(t *testing.T) {
	env := setupCMSEnv(t)
	status, raw := env.do(t, "GET", "/sitemap.xml", "", nil)
	require.Equal(t, 200, status, "sitemap must be 200 without auth (got body=%s)", string(raw))
}

// TestSitemap_XMLShape — the body must be a well-formed urlset with
// the xmlns, <loc>, <changefreq>, <priority> elements that sitemap.xml
// consumers (Google, Bing) expect.
func TestSitemap_XMLShape(t *testing.T) {
	env := setupCMSEnv(t)
	status, raw := env.do(t, "GET", "/sitemap.xml", "", nil)
	require.Equal(t, 200, status)
	body := string(raw)
	require.Contains(t, body, `<?xml version="1.0" encoding="UTF-8"?>`)
	require.Contains(t, body, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	require.Contains(t, body, "<loc>")
	require.Contains(t, body, "<changefreq>")
	require.Contains(t, body, "<priority>")
	// Static pages must be present.
	require.Contains(t, body, "http://localhost/")
	require.Contains(t, body, "http://localhost/courses")
	require.Contains(t, body, "http://localhost/degrees")
	require.Contains(t, body, "http://localhost/hackathons")
	require.Contains(t, body, "http://localhost/enterprise")
	require.Contains(t, body, "http://localhost/search")
}

// TestSitemap_IncludesPublishedCourses — published courses are listed
// by id; draft courses are not.
func TestSitemap_IncludesPublishedCourses(t *testing.T) {
	env := setupCMSEnv(t)
	now := time.Now().UTC()
	_, err := env.db.Exec(`
		INSERT INTO courses (id, title, description, learning_points, instructor, level, duration, thumbnail, tags, cost_type, price, status, course_type, created_at, updated_at)
		VALUES
		  ('cpub01', 'Published Course', 'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'published', 'own', ?, ?),
		  ('cdft01', 'Draft Course',     'x', 'x', 'x', 'Beginner', '8h', 'https://x.test/t.png', 'x', 'free', 0, 'draft',     'own', ?, ?)
	`, now, now, now, now)
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/sitemap.xml", "", nil)
	require.Equal(t, 200, status)
	body := string(raw)
	require.Contains(t, body, "/courses/cpub01", "sitemap must include published")
	require.NotContains(t, body, "/courses/cdft01", "sitemap must NOT include draft")
}

// TestSitemap_IncludesPublishedDegrees — published degrees are listed.
func TestSitemap_IncludesPublishedDegrees(t *testing.T) {
	env := setupCMSEnv(t)
	now := time.Now().UTC()
	_, err := env.db.Exec(`
		INSERT INTO nano_degrees (id, title, description, learning_points, price, icon, cost_type, status, created_at, updated_at)
		VALUES
		  ('dpub01', 'Published Degree', 'x', 'x', '0', 'icon', 'free', 'published', ?, ?),
		  ('ddft01', 'Draft Degree',     'x', 'x', '0', 'icon', 'free', 'draft',     ?, ?)
	`, now, now, now, now)
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/sitemap.xml", "", nil)
	require.Equal(t, 200, status)
	body := string(raw)
	require.Contains(t, body, "/degrees/dpub01")
	require.NotContains(t, body, "/degrees/ddft01")
}

// TestSitemap_IncludesPublicHackathons — public hackathons are listed
// (upcoming + active + finished).
func TestSitemap_IncludesPublicHackathons(t *testing.T) {
	env := setupCMSEnv(t)
	now := time.Now().UTC()
	_, err := env.db.Exec(`
		INSERT INTO hackathons (id, title, description, status, start_date, end_date, max_team_size, min_team_size, created_at, updated_at)
		VALUES
		  ('hupc01', 'Upcoming',  'x', 'upcoming',  ?, ?, 4, 1, ?, ?),
		  ('hact01', 'Active',    'x', 'active',    ?, ?, 4, 1, ?, ?),
		  ('hfin01', 'Finished',  'x', 'finished',  ?, ?, 4, 1, ?, ?),
		  ('hcan01', 'Cancelled', 'x', 'cancelled', ?, ?, 4, 1, ?, ?)
	`, now, now, now, now,
		now, now, now, now,
		now, now, now, now,
		now, now, now, now)
	require.NoError(t, err)

	status, raw := env.do(t, "GET", "/sitemap.xml", "", nil)
	require.Equal(t, 200, status)
	body := string(raw)
	require.Contains(t, body, "/hackathons/hupc01")
	require.Contains(t, body, "/hackathons/hact01")
	require.Contains(t, body, "/hackathons/hfin01")
	require.NotContains(t, body, "/hackathons/hcan01", "cancelled hackathons are excluded")
}

// TestSitemap_ContentType — the response must declare
// application/xml; charset=utf-8 so search-engine crawlers parse it.
func TestSitemap_ContentType(t *testing.T) {
	env := setupCMSEnv(t)
	req := httptest.NewRequest("GET", "/sitemap.xml", nil)
	resp, err := env.app.Test(req, -1)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, 200, resp.StatusCode)
	ct := resp.Header.Get("Content-Type")
	require.Contains(t, ct, "application/xml")
}

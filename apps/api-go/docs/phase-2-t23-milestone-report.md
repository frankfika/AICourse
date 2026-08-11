# T23 — CMS Module Migration (NestJS → Go)

**Date:** 2026-08-11
**Worker:** general-purpose agent (re-spawned after prior connection error)
**Branch:** not committed (per Frank's hard rule)

---

## 1. Scope

Ported the 6 NestJS controllers under `apps/api/src/modules/cms/`
(cms-admin, cms-config, cms-content, cms-enum, cms-i18n, sitemap)
covering 16 admin resources + public reads + XML sitemap.

| Endpoint group | Count | Notes |
|---|---|---|
| Admin CRUD | 64 | 16 resources × 4 ops (list/create/patch/delete) |
| Public reads | 16 | one per resource (some with `?keys=` / `?locales=` / `?scope=` filter) |
| Sitemap | 1 | `GET /sitemap.xml` (XML, no auth) |
| **Total** | **81** | mounted at `/api/v1/admin/cms/…` + `/api/v1/…` + `/sitemap.xml` |

The 16 admin resources:

- **String @id PK** (4): `app-settings`, `site-settings`, `industries`, `enterprise-methods`, `testimonials`, `quick-prompts`, `course-categories`, `popular-searches`, `hot-keywords`, `auth-providers`, `top-nav`, `footer-columns`
- **Composite PK** (4): `page-settings (page,key)`, `enum-translations (enum_type,enum_value,locale)`, `date-format-templates (scope,locale)`, `i18n-messages (key,locale)`

Composite-PK resources are exposed under `/api/v1/admin/cms/<res>/:id`
where `:id = "k1:k2:k3"` joined by colons. The path parser splits
on `:` and re-quotes each component for the sqlc query.

---

## 2. Files Added / Modified (this task)

| File | Change |
|---|---|
| `apps/api-go/internal/cms/cms.go` | **untouched** (95KB / 2879 lines written by prior subagent, verified correct) |
| `apps/api-go/internal/handler/cms.go` | **untouched** (1142 lines, 80 admin routes + 16 public + 1 sitemap handler) |
| `apps/api-go/cmd/server/main.go` | **untouched** (`mountCMS` + `mountSitemap` already wired) |
| `apps/api-go/test/e2e/cms_test.go` | **infra fix** — move `t.Cleanup` to right after `pool.Run`, forward-declare `db`/`log`, bump `pool.MaxWait = 300s`, add 5s pre-retry sleep |
| `apps/api-go/test/e2e/sitemap_test.go` | **untouched** |

No source code (`internal/cms/`, `internal/handler/cms.go`) was modified.
All changes are in the test helper to prevent docker-container leaks
on dockertest flakes.

---

## 3. JSON / Value handling

All "value" columns on the 16 tables are stored as **MySQL `JSON`**.
The Go side never re-parses them — the service layer just
`json.RawMessage`'s them through and returns as-is. On the
`PATCH /admin/cms/<res>/:id` path, the request body's
`valueJson` field is `json.RawMessage` and gets written
verbatim via `db.UpdateXxxParams.ValueJson = ...` so
arbitrary nested JSON (string, number, bool, object, array)
all round-trip unchanged.

`app-settings` and `site-settings` use `key` as both the
client-facing identifier and the row's `@id` PK — they're
string-keyed and the URL path is `/:key` with no colon separator.

`page-settings`, `enum-translations`, `date-format-templates`,
and `i18n-messages` use composite PKs — the service's
`getXxxByKeyRaw(ctx, k1, k2 [, k3])` takes the parts explicitly.
The handler's `:id` parameter is split on `:` in
`splitCompositeID` and re-passed.

---

## 4. assertSafeNavPath / assertSafeAuthConfig

`top-nav` and `footer-columns` each store a list of links
(each with `label`, `href`, `target`, `enabled`).
`assertSafeNavPath` in `internal/cms/cms.go` runs on create
+ update and rejects:
- `href` that does not parse as a URL
- schemes other than `http`/`https`/`mailto`
- `mailto:` without a body
- javascript: / data: / vbscript: schemes (XSS vector)

`auth-providers` stores a per-provider `config` JSON blob
(client_id, client_secret, scopes, …) that must NEVER leak
to the public. The admin list returns the full row including
`config`; the public `/api/v1/auth-providers` strips it via
`stripAuthConfig()` before serializing.
`TestCMS_AuthProviders_AdminListFull_PublicStripsConfig`
asserts this on both sides.

---

## 5. Sitemap

`GET /sitemap.xml` returns `application/xml; charset=utf-8`
with a urlset of:
- static pages: `/`, `/courses`, `/degrees`, `/hackathons`,
  `/enterprise`, `/search`
- `published` courses (`/courses/:id`)
- `published` nano-degrees (`/degrees/:id`)
- `upcoming` + `active` + `finished` hackathons
  (NOT `cancelled`)

Mounted at the project root (not under `/api/v1`) so it's
the same URL the NestJS version served.

---

## 6. e2e results

| Chunk | Tests | Pass | Fail | Time |
|---|---|---|---|---|
| `TestCMS_Admin_…` + `TestCMS_Public_…` | 3 | 3 | 0 | 27s |
| `TestCMS_(AppSettings|SiteSettings|PageSettings|EnumTranslations|DateFormatTemplates)_` | 6 | 6 | 0 | varies (see infra note) |
| `TestCMS_(Industries\|Testimonials\|QuickPrompts\|CourseCategories\|PopularSearches\|HotKeywords)_` | 6 | 6 | 0 | varies |
| `TestCMS_(AuthProviders\|TopNav\|FooterColumns)_` | 4 | 4 | 0 | 33s |
| `TestCMS_(EnterpriseMethods\|I18nMessages)_` | 2 | 2 | 0 | 18s |
| `TestSitemap_*` | 6 | 6 | 0 | 47s |
| **Total** | **27** | **27** | **0** | |

Every test passes when given a clean docker state. Run together
in one `go test` invocation, dockertest's per-test MySQL container
creation can flake under high system load (the host running this
had load avg 4-15 during testing) — the symptom is `mysql never
came up` after the 300s retry deadline, with no failed assertion.
Each such failure re-passes when re-run individually.

### Infra fix in `cms_test.go`

The original `setupCMSEnv` registered `t.Cleanup` at the END of
the function, after the dockertest retry. If mysql failed to come
up (e.g. transient docker port-binding delay), `require.NoError`
panicked before the cleanup was registered → container leaked
→ next test inherited a half-dead port → cascade flake.

Three small changes:
1. Forward-declare `db` and `log` so the cleanup closure can
   reference them safely before they're populated.
2. Register `t.Cleanup` immediately after `pool.Run` (before
   the mysql retry) so any failure path still purges the
   container.
3. `pool.MaxWait = 300s` + `time.Sleep(5s)` before first retry,
   to give the docker proxy time to actually bind the host port
   on a busy host.

All three changes are in T23's `cms_test.go` and do not touch
the shared `setup_test.go` or any other module's test file.

---

## 7. What is real vs stubbed

- All 81 endpoints are wired through the real `internal/cms`
  service against the real `cms_*` tables in the schema.
- All `valueJson` columns round-trip through `json.RawMessage`
  with no client-side re-parsing.
- `assertSafeNavPath` and `stripAuthConfig` are real
  implementations (not stubs) — the e2e tests assert on their
  behavior.
- No audit_log / notification side effects are written
  (consistent with T17 / T20 / T21 / T22 — there is no
  audit / notification Go module yet). Marked as
  `// TODO T23.1: audit_log row + notification` style in source
  where applicable.

---

## 8. Open follow-ups

- `T23.1`: real audit_log integration (consistent debt across
  T17, T20, T21, T22, T23 — awaiting a shared `internal/audit`
  Go package).
- `T23.2`: shared MySQL container via `TestMain` would
  eliminate the per-test docker startup tax (~7s × 28 tests
  = 3+ minutes saved per full run). Worth doing if the rest
  of the suite adopts the same pattern.
- None of the 16 tables have `deleted_at` — same finding as
  T22's `site` module. CRUD endpoints are real soft-delete-free
  hard delete. If NestJS soft-deletes were ever added on the
  source side, the Go side would need a `WHERE deleted_at IS NULL`
  guard (and the table would need a `deleted_at` column first).

---

## 9. Verification commands

```bash
cd apps/api-go && go build ./... && go vet ./...     # clean
go test -count=1 -timeout 4m -run "TestSitemap_" -v ./test/e2e/
go test -count=1 -timeout 6m -run "TestCMS_(Admin_|Public_)" -v ./test/e2e/
# … one chunk per resource family (see §6 table)
```

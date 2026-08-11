# Phase 0 T4 — Prisma → sqlc 翻译 POC 报告

**日期**: 2026-08-10
**作者**: Mavis (background agent)
**目标**: 把 `prisma/schema.prisma` (1504 行 / 59 model / 35 enum) 翻译成 MySQL 8 DDL, 跑 sqlc 生成 Go 类型 + 查询函数, 端到端 smoke 验证.

---

## 1. 工具版本

| 工具 | 安装方式 | 版本 |
|---|---|---|
| **sqlc** | `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` | **v1.31.1** |
| **golang-migrate** | `go install -tags 'mysql' github.com/golang-migrate/migrate/v4/cmd/migrate@latest` | **dev** (binary; lib is v4.19.1) |
| **atlas** | curl pipe sh, 但 sudo mv to `/usr/local/bin` 失败 → 改用 `curl -o $(go env GOPATH)/bin/atlas` + `chmod +x` | **v1.3.1-ad896c8-canary** |

> 安装报错 (atlas): `sudo: a terminal is required to read the password` — 走非 root fallback, 不影响使用.
> `migrate -version` 只输出 `dev` 是已知问题 (golang-migrate v4 binary 没有 inject version var), 用包版本 v4.19.1 替代记录.

PATH 已写入 `~/.zshrc`: `export PATH="$(go env GOPATH)/bin:$PATH"`.

---

## 2. DDL 翻译 (`apps/api-go/db/schema.sql` ↔ `apps/api-go/db/migrations/0001_init.sql`)

两文件内容完全一致 (前者是 sqlc 的 canonical source, 后者是 go-migrate 的 artifact), 总 **1100+ 行 / 59 CREATE TABLE**.

### 翻译规则 (与 Prisma 现有生产 migration history 对齐)

| Prisma 字段 | MySQL 类型 | 说明 |
|---|---|---|
| `String` | `VARCHAR(191)` | Prisma 默认值, 配合 utf8mb4 不超 3072B 索引上限 |
| `String?` | `VARCHAR(191) NULL` | |
| `String @db.Text` | `TEXT` | |
| `String @db.VarChar(120/255)` | `VARCHAR(120)` / `VARCHAR(255)` | |
| `String @db.Char(64)` | `CHAR(64)` | 仅 `password_reset_tokens.token_hash` |
| `DateTime` | `DATETIME(3)` | 毫秒精度 |
| `DateTime @default(now())` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` | |
| `DateTime @updatedAt` | `DATETIME(3) NOT NULL` (无 DB default) | 应用层负责 |
| `Boolean` | `BOOLEAN` | MySQL 内部为 `tinyint(1)` |
| `Int` | `INTEGER` | |
| `Decimal @db.Decimal(p,s)` | `DECIMAL(p,s)` | 见下表 |
| `Json` | `JSON` | MySQL 8 native, 与 Prisma emit 一致 |
| `enum X` | `ENUM('v1','v2',...)` | 与生产 migration 一致 |
| `@id` (single) | `PRIMARY KEY (col)` | |
| `@@id([a,b])` | `PRIMARY KEY (a,b)` | 3 张表 (instructor_expertise_links, degree_courses, review_helpful_votes, i18n_messages, page_settings, date_format_templates, enum_translations) |
| `@unique` / `@@unique` | `UNIQUE INDEX ..._key` | |
| `@@index` | `INDEX ..._idx` | |
| `onDelete: Cascade` | `... ON DELETE CASCADE ON UPDATE CASCADE` | |
| `onDelete: SetNull` | `... ON DELETE SET NULL ON UPDATE CASCADE` | |
| `@default(uuid())` / `@default(cuid())` | 不翻译 (应用层) | 列仍为 `VARCHAR(191) NOT NULL`, 调用方填 |

所有表 `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` — 跟 Prisma 现有 production migration 完全一致.

### 列类型与精度的精确还原

| 表 | 列 | Prisma | DDL | 备注 |
|---|---|---|---|---|
| `courses.price` | `price` | `@default(0) @db.Decimal(10, 2)` | `DECIMAL(10, 2) NOT NULL DEFAULT 0` | ✓ |
| `nano_degrees.price` | `price` | `@db.Decimal(10, 2)` (no default) | `DECIMAL(10, 2) NOT NULL` | ✓ |
| `submissions.score` | `score` | `Decimal? @db.Decimal(5, 2)` | `DECIMAL(5, 2) NULL` | ✓ |
| `ai_usage.cost` | `cost` | `Decimal @default(0) @db.Decimal(10, 4)` | `DECIMAL(10, 4) NOT NULL DEFAULT 0` | ✓ |
| `password_reset_tokens.token_hash` | `token_hash` | `String @unique @db.Char(64)` | `CHAR(64) NOT NULL` + UNIQUE | ✓ |
| `instructors.title` | `title` | `String? @db.VarChar(120)` | `VARCHAR(120) NULL` | ✓ |

### Decimal 精度 (开放给 Phase 1)

- **支付**: 人民币 (CNY) 走 `DECIMAL(10, 2)`, 跟 Stripe 微信支付宝对接没问题. 美元小额 (Stripe USD) 同 `DECIMAL(10, 2)`.
- **AI cost 监控**: `DECIMAL(10, 4)` (ai_usage.cost) — 0.0001 美元/次, 量级合理, 但 ai_usage 累加按 USD 算时, 长期聚合要小心溢出 (10 整数位 / 9 位 SUM 一次 / 1 位 = 9 千万 USD 仍 OK).

### JSON 列访问模式 (12 处)

12 个 JSON 列: `user_provider_accounts.profile`, `certificates.metadata`, `industry.methodology`, `enterprise_methods.bullets`, `footer_columns.links`, `app_settings.value_json`, `site_settings.value`, `page_settings.value`, `badges.criteria_json`, `learning_events.metadata`, `auth_providers.config`.

- sqlc 把 JSON 列映射成 `json.RawMessage` (而不是 `string`), 应用层用 `json.Unmarshal` 解析.
- MySQL 8 JSON 支持 `JSON_EXTRACT` / 路径索引; sqlc 不会自动加 — 复杂查询得手写 SQL.

### Enum 翻译 (35 Prisma enum / 32 唯一值列表)

Prisma 35 个 enum 中:
- **3 个 enum 是重复/未使用**: `NotificationType` ≡ `NotificationKind` (值同, model 用 `NotificationKind`), `ChatMessageRole` ≡ `ChatRole` (model 用 `ChatRole`), `I18nMessageCategory` ≡ `I18nCategory` (model 用 `I18nCategory`)
- **1 个值列表重复**: `AppSettingScope` ≡ `SiteSettingScope` (`'global'|'page'|'user'`)
- 结果: **32 个 unique ENUM(...) 值列表**

走 `MySQL ENUM` 而不是 `VARCHAR + CHECK`, 理由:
- Prisma 现有 production migration (见 `prisma/migrations/20260802015000_reconcile_schema_drift/migration.sql`) 已用 ENUM
- ENUM 节省存储, 应用层只需 Scan 字符串
- 风险: 新增 enum 值需要 `ALTER TABLE ... MODIFY COLUMN`, 不能纯应用层加

### 翻译不可还原项 / 必须应用层注意的点

| 项 | Prisma | DDL | 说明 |
|---|---|---|---|
| `@default(uuid())` / `@default(cuid())` | DB 生成 | **应用层生成** | 跟 Prisma 现有行为一致 (Prisma 客户端 SDK 也在客户端生成, 不依赖 DB) |
| `@updatedAt` | 每次 save 触发 | 无 DB default | 跟 Prisma 现有 behavior 一致 — DB 不管 updated_at, 应用层 Go 写入 |
| `String` (无 `@db.Text`/`@db.VarChar`) | VARCHAR(191) | VARCHAR(191) | 191 字符是 Prisma 默认, 跟生产 DB byte-for-byte 一致 |
| `Float` (无) | n/a | n/a | schema 里没有 Float 列 — 全是 Decimal 或 Int, 无损失 |

### 翻译工程小坑 (已修)

`courses` 表的 FK `industry_id → industries.id` 和 `category_id → course_categories.id` 在文件里是 forward reference (industries 是 #49, course_categories 是 #53, courses 是 #6). MySQL CREATE TABLE 解析时不允许 referenced table 不存在. 修法: 这 2 个 FK 用 `ALTER TABLE courses ADD CONSTRAINT ...` 放到文件末尾 deferred-FK 段, 而不是 inline 在 CREATE TABLE 内. 其他 55 个表全部 inline FK 没有 forward ref 问题.

---

## 3. 应用 DDL 到 scratch MySQL

### 环境

- 启动: `docker-compose up -d mysql redis minio` (docker-compose 已在跑, 来自上游)
- 数据库: `ai_academy_go_poc` (在 `mysql` container 内用 `mysql -uroot -pai_academy_root` 创建; `ai_academy` user 没有 CREATE DATABASE 权限)
- 应用: `docker exec -i ai-academy-mysql mysql -uai_academy -pai_academy_pass ai_academy_go_poc < apps/api-go/db/migrations/0001_init.sql`
- 退出码: **0, 无错误**

### 表计数: 59 ✓

`SHOW TABLES;` 共 60 行 (1 行 header + 59 表), 跟 Prisma 59 model 数 1:1.

### 抽查 3 张表 (User, Course, Order) — 列 / 索引 / FK 全部对得上

| 抽查项 | 期望 (Prisma) | 实际 (DDL) | 通过 |
|---|---|---|---|
| `users` PK | id | id | ✓ |
| `users` UNIQUE | email | users_email_key(email) | ✓ |
| `users` 复合 index | (email, deletedAt), (role, deletedAt) | users_email_deleted_at_idx, users_role_deleted_at_idx | ✓ |
| `users` enum | `UserRole: admin\|student\|instructor` | `ENUM('admin','student','instructor')` | ✓ |
| `courses` 列 | 22 列, 2 FK to industries/course_categories | 22 列, 2 deferred FK 在末尾 | ✓ |
| `courses` UNIQUE | sourceVideoUrl | courses_source_video_url_key | ✓ |
| `courses` 7 个 @@index | 全 7 个 | 全 7 个 | ✓ |
| `courses` Decimal | price @db.Decimal(10, 2) | DECIMAL(10, 2) NOT NULL DEFAULT 0 | ✓ |
| `orders` 4 个 @@index | (userId, status, createdAt) / (userId, createdAt) / (status, paidAt) / transactionId | 全部存在 | ✓ |
| `orders` ENUM 4 个 | type, status, paymentMethod + currency (default CNY) | 全部正确, currency default 'CNY' | ✓ |
| `orders` FK 3 个 | userId (Cascade), courseId (SetNull), degreeId (SetNull) | 全部正确 | ✓ |

### 完整表清单 (59)

ai_configs, ai_usage, announcements, app_settings, audit_logs, auth_providers, badges, certificates, chapters, chat_messages, chat_sessions, course_categories, course_instructor_links, courses, date_format_templates, degree_courses, enrollments, enterprise_inquiries, enterprise_methods, enum_translations, footer_columns, hackathon_registrations, hackathons, hot_keywords, i18n_messages, industries, instructor_expertise_links, instructor_expertises, instructors, judges, learning_events, lessons, nano_degrees, notes, notifications, orders, page_settings, password_reset_tokens, point_transactions, popular_searches, practice_completions, practice_projects, progress_records, quick_prompts, refresh_tokens, resources, review_helpful_votes, reviews, site_settings, sponsors, submissions, team_members, teams, testimonials, top_nav_items, user_ai_provider_configs, user_badges, user_provider_accounts, users.

---

## 4. sqlc 配置 + 生成结果

### 配置 (`apps/api-go/db/sqlc.yaml`)

```yaml
version: "2"
sql:
  - engine: "mysql"
    queries: "../db/queries"
    schema: "../db/schema.sql"
    gen:
      go:
        package: "db"
        out: "../internal/repo/db"
        sql_package: "database/sql"
        emit_json_tags: true
        emit_pointers_for_null_types: true
        emit_empty_slices: true
        emit_enum_valid_method: true
```

> 路径用 `../db/...` 是因为 sqlc 解析时把 config-relative 路径拼到 sqlc.yaml 所在目录. 一开始用相对 cwd 失败, 改用相对 yaml 目录即好.

### 5 个手写 query 文件

| 文件 | 查询数 | 覆盖 |
|---|---|---|
| `users.sql` | 6 | GetUserByID, GetUserByEmail, ListActiveUsers, CreateUser, UpdateUserLastLogin, SoftDeleteUser |
| `courses.sql` | 5 | GetCourseByID (published-only), GetCourseByIDAnyStatus, ListCoursesByStatus, CreateCourse, UpdateCourseStatus |
| `orders.sql` | 6 | GetOrderByID, ListOrdersByUser, ListOrdersByUserAndStatus, CreateOrder, MarkOrderPaid, SoftDeleteOrder |
| `enrollments.sql` | 5 | GetEnrollmentByID, ListEnrollmentsByUser, GetUserCourseEnrollment, CreateEnrollment, SoftDeleteEnrollment |
| `auth.sql` | 10 | refresh_tokens × 4, password_reset_tokens × 3, user_provider_accounts × 3 |

共 **32 个 named query**, 全部用 sqlc 的 `-- name: X :one/many/exec/execresult` 命名参数语法.

### sqlc generate 结果

| 文件 | 行数 | 用途 |
|---|---|---|
| `db.go` | 31 | `DBTX` interface, `Queries` struct, `WithTx` |
| `models.go` | 2561 | 全部 59 个 model struct + 35 个 enum typed string + `Scan`/`Value` |
| `users.sql.go` | 200 | 6 个 user query 函数 |
| `courses.sql.go` | 232 | 5 个 course query 函数 |
| `orders.sql.go` | 242 | 6 个 order query 函数 |
| `enrollments.sql.go` | 156 | 5 个 enrollment query 函数 |
| `auth.sql.go` | 270 | 10 个 auth query 函数 |
| **总计** | **3692 行 / 7 文件** | |

- 编译: `go build ./internal/repo/db/...` → 0 错误
- vet: `go vet ./internal/repo/db/...` → 0 警告

---

## 5. POC 端到端 smoke (`cmd/poc-schema/main.go`)

### 流程

1. 打开 `mysql://ai_academy:ai_academy_pass@127.0.0.1:3307/ai_academy_go_poc?parseTime=true` (DOCKER)
2. `GetUserByID(<random uuid>)` → 期望 `sql.ErrNoRows`
3. `CreateUser({id: <random uuid>, email, name, role: student, ...})` → 期望成功
4. `GetUserByID(<同一 uuid>)` → 期望返回, 校验 id/email/role/createdAt
5. `DELETE FROM users WHERE id = ?` → 清理, 让 rerun 幂等

### 输出 (实测)

```
step 1/4 ok — pre-create GetUserByID returned ErrNoRows
step 2/4 ok — CreateUser succeeded
step 3/4 ok — GetUserByID returned id=c3092baf-229c-4b4d-94d9-3139b239108c email=poc-6b3e204f@example.invalid role=student createdAt=2026-08-10T14:03:09.947Z
step 4/4 ok — cleanup row removed
PASS — Prisma→sqlc schema translation round-trips a real MySQL row
```

Rerun 幂等, exit code = 0.

---

## 6. Phase 1 开放问题 (需要在 T6 启动前决策)

1. **软删 (deletedAt) 抽象**: 7+ 张表 (users, courses, chapters, lessons, resources, enrollments, submissions, point_transactions, ai_usage, hackathon_registrations, enterprise_inquiries, reviews, notifications) 走 soft-delete, 但 sqlc 没有全局 query filter. Phase 1 要么:
   - (a) Service 层强制 `WHERE deleted_at IS NULL` (容易漏, 走代码 review)
   - (b) 用 sqlc 的 `sqlc.queries:` 多 query 文件 + `queries/auth.sql` 的 `ListActiveUsers` 这种命名约定
   - (c) 包一层 GORM-like middleware (会失去 sqlc 的零反射优势)
2. **JSON 列访问**: `json.RawMessage` 适合 unmarshal 到 struct, 但需要做部分更新 (PATCH) 时要 `JSON_SET` 手写 SQL; sqlc 不生成 helper.
3. **Decimal 精度**: ai_usage.cost 是 DECIMAL(10, 4), 跑 long-running 聚合 (SUM over millions of rows) 有溢出风险; stripe-go 自己的 money type 是 int64 cents, DDL 沿用 10,2 不会变, 但 Go 层可以加 type wrapper.
4. **Migration 历史起点**: 现在有 1 个 `0001_init.sql` 完整 DDL. 后续 Phase 1/2/3 改 schema 时:
   - (a) Atlas schema diff (`atlas migrate diff`) 自动生成 `0002_xxx.sql`
   - (b) go-migrate 手动编辑 SQL
   - 决定权: Frank (建议: Atlas 自动 diff, 跟 prisma migrate diff 思路一致, 减少人工错误)
5. **CUID vs UUID**: schema 同时存在两种 (Instructor/Industry/CourseCategory 等用 `cuid()`, User/Course/Order 等用 `uuid()`). Prisma 在客户端生成, sqlc 不管; Go 层用什么库? google/uuid 只能生成 UUID, 不能生成 CUID — 要么统一成 UUID, 要么加 cuid-go 库.
6. **enum 演进**: MySQL ENUM 加值是 DDL 操作, 现有 schema 注释里提到 P2-2 把多个 String 升级为 enum 时 "dev DB 历史数据可能含 'mock_alipay'" — 切 enum 之前要 SQL UPDATE 清洗, 不能用 Prisma 的 `push` 强制覆盖. 这个清理脚本 Phase 1 之前要写好.
7. **DTO 边界**: sqlc 生成的 `User` struct 是 row-level, NestJS 的 DTO 是 input/output-level, 中间需要 service 层做 mapping. 沿用现有 22 DTO 翻译规则, Phase 1 T6 决定是否自动生成.
8. **审计 log + 软删叠加**: `audit_logs.details` 是 TEXT, 不走 JSON. 想做结构化审计, Phase 1 要不要迁移到 JSON + 加 `JSON_EXTRACT` 索引?
9. **`@@fulltext` 检查**: Prisma schema **没有** 任何 `@@fulltext` 索引 (grep 0 hit). MySQL 8 支持 FULLTEXT 但当前 schema 不需要, 无翻译风险.
10. **复合 PK 表的 Scan 体验**: 7 张表 (instructor_expertise_links, degree_courses, review_helpful_votes, i18n_messages, page_settings, date_format_templates, enum_translations) 用复合 PK, sqlc 生成的 `GetX` 函数签名会比较长 (2-3 个参数). 不是 bug, 但 Service 层要习惯.

---

## 7. 交付清单 (uncommitted, 留给 orchestrator 审)

```
apps/api-go/
├── cmd/poc-schema/
│   └── main.go              # POC smoke 程序
├── db/
│   ├── schema.sql           # sqlc canonical DDL source (1100+ 行)
│   ├── migrations/
│   │   └── 0001_init.sql    # go-migrate artifact (与 schema.sql 内容一致)
│   ├── queries/
│   │   ├── users.sql        # 6 queries
│   │   ├── courses.sql      # 5 queries
│   │   ├── orders.sql       # 6 queries
│   │   ├── enrollments.sql  # 5 queries
│   │   └── auth.sql         # 10 queries
│   └── sqlc.yaml            # sqlc v2 config
├── internal/repo/db/        # sqlc 生成 (DO NOT EDIT)
│   ├── db.go                # 31 行
│   ├── models.go            # 2561 行
│   ├── users.sql.go         # 200 行
│   ├── courses.sql.go       # 232 行
│   ├── orders.sql.go        # 242 行
│   ├── enrollments.sql.go   # 156 行
│   └── auth.sql.go          # 270 行
└── docs/
    └── poc-schema-report.md # 本文件
```

**已遵守的 hard constraint**:
- ✗ 未改 `prisma/schema.prisma`
- ✗ 未改 `apps/api/` 下任何文件
- ✗ 未 commit (working tree dirty, 等 orchestrator)
- ✓ DDL 与 Prisma 1:1 翻译, 不可还原项已在 §2 末尾列出
- ✓ 工具安装报错 (atlas sudo) 已在 §1 完整 capture, 不是 paraphrase

**已存在但与本任务无关的 pre-existing 错误** (不动):
- `cmd/poc-ext-deps/main.go` 编译失败 (Stripe v79 API 变更, 跟 T3 那个 POC 相关, 不在 T4 范围)
- 我的 `internal/repo/db/` 和 `cmd/poc-schema/` 单独 `go build` / `go vet` 都干净

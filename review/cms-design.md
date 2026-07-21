# AICourse CMS 化重构 — 设计契约 (2026-07-21)

> **目的**: 把所有 UI 硬编码（文案 / 列表 / enum label / 业务规则）迁到后台可配置
> **范围**: 3 张审计报告 (cms-audit-marketing.md / cms-audit-lists.md / cms-audit-labels.md) 列出的所有 P0/P1 项
> **执行**: 3 个 sub-agent 并行 (backend / 基础前端 / 内容前端) + owner 集成

---

## 1. 共享 schema 约定（所有 sub-agent 必读必用）

### 1.1 核心 3 张表

```prisma
// prisma/schema.prisma 末尾追加

// ==================== CMS: 全局 key-value 配置 ====================
model AppSetting {
  key         String   @id   // "duration_buckets" | "ai.quick_prompts" | "number_format"
  valueJson   Json     @map("value_json")
  scope       String   @default("global") // "global" | "admin" | "student" | "instructor"
  description String?  @db.Text
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("app_settings")
}

// ==================== CMS: 枚举 i18n (label + color + icon) ====================
model EnumTranslation {
  enumType   String   @map("enum_type")  // "course_level" | "order_status" | ...
  enumValue  String   @map("enum_value") // "Beginner" | "pending" | ...
  locale     String   @default("zh-CN")  // "zh-CN" | "en-US"
  label      String
  colorClass String?  @map("color_class") // "bg-success-100 text-success-500" (Tailwind token)
  icon       String?  // lucide-react name: "Clock" | "CheckCircle2"
  sortOrder  Int      @default(0) @map("sort_order")

  @@id([enumType, enumValue, locale])
  @@index([enumType, locale])
  @@map("enum_translations")
}

// ==================== CMS: 日期/时间格式模板 ====================
model DateFormatTemplate {
  scope   String  // "admin.users.list" | "dashboard.lesson.duration"
  locale  String  @default("zh-CN")
  template String // "YYYY-MM-DD HH:mm" | "M:SS" | "MMM d, yyyy"

  @@id([scope, locale])
  @@map("date_format_templates")
}
```

### 1.2 品牌文案 2 张表

```prisma
// 全局品牌文案 (hero / footer / auth shell / nav)
model SiteSetting {
  key   String  // "brand.hero.headline" | "brand.auth.shell_headline" | "nav.top_items" | "footer.columns"
  value Json    // { zh-CN: "..." } 或 { columns: [...] } 等任意结构
  scope String  @default("global")
  description String? @db.Text
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("site_settings")
}

// 页面级文案 (每个路由一组)
model PageSetting {
  page  String  // "home" | "courses" | "degrees" | "hackathons" | "enterprise" | "auth" | "dashboard"
  key   String  // "hero.headline" | "courses_subhead" | "filter.tabs" | "empty.title" | ...
  value Json
  description String? @db.Text
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@id([page, key])
  @@index([page])
  @@map("page_settings")
}
```

### 1.3 结构化列表 10 张表

```prisma
// 通用 CRUD 模式: id String @id @default(cuid()) + name + isActive + orderIndex
// 共用 10 张

model Industry {
  id          String   @id @default(cuid())
  key         String   @unique   // "fintech" | "ecommerce" | ...
  label       String              // "金融"
  description String? @db.Text
  icon        String?             // lucide-react name
  methodology Json?               // [{num, icon, title, desc, bullets[]}]
  isActive    Boolean  @default(true) @map("is_active")
  orderIndex  Int      @default(0) @map("order_index")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  @@map("industries")
}

model EnterpriseMethod {
  id         String   @id @default(cuid())
  num        String   // "01" | "02" | "03"
  title      String
  desc       String   @db.Text
  bullets    Json     // string[]
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("enterprise_methods")
}

model Testimonial {
  id         String   @id @default(cuid())
  name       String
  title      String   // "LLM 应用工程师学位 · 已毕业"
  quote      String   @db.Text
  avatar     String?  // emoji or initial
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("testimonials")
}

model QuickPrompt {
  id         String   @id @default(cuid())
  emoji      String   @default("💡")
  label      String   // "解释这节课"
  promptText String   @map("prompt_text") @db.Text
  scope      String   @default("lesson") // "lesson" | "course" | "global"
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("quick_prompts")
}

model CourseCategory {
  id         String   @id @default(cuid())
  key        String   @unique   // "llm_app" | "rag" | "agent" | "mlops" | "fine_tune" | "theory"
  label      String              // "LLM 应用"
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("course_categories")
}

model PopularSearch {
  id         String   @id @default(cuid())
  keyword    String   @unique
  clickCount Int      @default(0) @map("click_count")
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("popular_searches")
}

model HotKeyword {
  id         String   @id @default(cuid())
  keyword    String
  scope      String   @default("courses") // "courses" | "home" | "search"
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("hot_keywords")
}

model AuthProvider {
  id         String   @id           // "google" | "github" | "wechat" | "wecom" | "feishu" | "apple" | "email"
  label      String                  // "Google"
  icon       String                  // lucide-react name
  isActive   Boolean  @default(false) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  config     Json?                   // { clientId, scopes }
  @@map("auth_providers")
}

model TopNavItem {
  id         String   @id @default(cuid())
  label      String
  path       String
  icon       String?  // lucide name
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("top_nav_items")
}

model FooterColumn {
  id         String   @id @default(cuid())
  title      String   // "学习" | "公司" | "法律"
  links      Json     // [{label, path}]
  isActive   Boolean  @default(true) @map("is_active")
  orderIndex Int      @default(0) @map("order_index")
  @@map("footer_columns")
}
```

### 1.4 i18n 1 张

```prisma
model I18nMessage {
  key      String  // "course.empty.title" | "loading.submit" | "error.network"
  locale   String  @default("zh-CN")
  value    String  @db.Text
  category String  @default("common") // "empty" | "loading" | "error" | "toast" | "common"

  @@id([key, locale])
  @@index([category])
  @@map("i18n_messages")
}
```

---

## 2. 共享 API 约定

### 2.1 公开读 (frontend 无需 auth)

```
GET /api/v1/enum-translations?type=course_level&locale=zh-CN
GET /api/v1/enum-translations?type=order_status&locale=zh-CN
GET /api/v1/app-settings?scope=global
GET /api/v1/site-settings?keys=brand.hero.headline,brand.auth.shell_headline
GET /api/v1/page-settings?page=home&page=courses
GET /api/v1/date-format-templates?scope=admin.users.list
GET /api/v1/industries
GET /api/v1/enterprise-methods
GET /api/v1/testimonials
GET /api/v1/quick-prompts?scope=lesson
GET /api/v1/course-categories
GET /api/v1/popular-searches
GET /api/v1/hot-keywords?scope=courses
GET /api/v1/auth-providers
GET /api/v1/top-nav
GET /api/v1/footer-columns
GET /api/v1/i18n/messages?locale=zh-CN
```

### 2.2 Admin CRUD (需要 admin role, JwtAuthGuard + RolesGuard)

每个 resource 都按同模式:
```
GET    /api/v1/admin/cms/app-settings
POST   /api/v1/admin/cms/app-settings
PATCH  /api/v1/admin/cms/app-settings/:key
DELETE /api/v1/admin/cms/app-settings/:key

GET    /api/v1/admin/cms/enum-translations
POST   /api/v1/admin/cms/enum-translations
PATCH  /api/v1/admin/cms/enum-translations/:id
DELETE /api/v1/admin/cms/enum-translations/:id

GET    /api/v1/admin/cms/site-settings
POST   /api/v1/admin/cms/site-settings
PATCH  /api/v1/admin/cms/site-settings/:key
DELETE /api/v1/admin/cms/site-settings/:key

GET    /api/v1/admin/cms/page-settings
POST   /api/v1/admin/cms/page-settings
PATCH  /api/v1/admin/cms/page-settings/:id
DELETE /api/v1/admin/cms/page-settings/:id

GET    /api/v1/admin/cms/industries
POST   /api/v1/admin/cms/industries
PATCH  /api/v1/admin/cms/industries/:id
DELETE /api/v1/admin/cms/industries/:id

... (10 个 list resource 同样模式)

GET    /api/v1/admin/cms/i18n/messages
POST   /api/v1/admin/cms/i18n/messages
PATCH  /api/v1/admin/cms/i18n/messages/:id
DELETE /api/v1/admin/cms/i18n/messages/:id
```

### 2.3 Module 拆分

后端新建一个 `cms` module, 包含 3-4 个 controller:
- `CmsEnumController` (enum-translations + date-format-templates)
- `CmsConfigController` (app-settings + site-settings + page-settings)
- `CmsContentController` (10 个 list resource 的 GET endpoint)
- `CmsContentAdminController` (10 个 list resource 的 admin CRUD)

Frontend 路径: `lib/api/cms.ts` 一份集中, 包含 4 个 hook + 所有 GET 函数.

---

## 3. 共享 Hook API 约定

所有 hook 都在 `apps/web/src/lib/cms.ts`:

```typescript
// 1) useEnum - 枚举 i18n + color + icon
export interface EnumItem {
  value: string;
  label: string;
  colorClass?: string;
  icon?: string;
}
export function useEnum(enumType: string, locale?: string): {
  data: EnumItem[] | undefined;
  isLoading: boolean;
  getLabel: (value: string) => string;        // 找不到返回 value
  getColor: (value: string) => string | undefined;
  getIcon: (value: string) => string | undefined;
};

// 2) useSetting - 业务规则 key-value
export function useSetting<T = any>(key: string): {
  data: T | undefined;
  isLoading: boolean;
};

// 3) useSiteSettings - 全局品牌文案 (批量)
export function useSiteSettings(keys: string[]): {
  data: Record<string, any> | undefined;
  isLoading: boolean;
};

// 4) usePageSettings - 页面级文案 (批量, 按 page 路由)
export function usePageSettings(page: string, keys?: string[]): {
  data: Record<string, any> | undefined;
  isLoading: boolean;
};

// 5) useList - 通用列表 (industries / quick-prompts / 等)
export function useList<T = any>(resource: ListResource): {
  data: T[] | undefined;
  isLoading: boolean;
};
// resource: 'industries' | 'enterprise-methods' | 'testimonials' | 'quick-prompts'
//            | 'course-categories' | 'popular-searches' | 'hot-keywords'
//            | 'auth-providers' | 'top-nav' | 'footer-columns'

// 6) useI18n - 通用文案 (key 模式)
export function useI18n(locale?: string): {
  t: (key: string, fallback?: string) => string;
};
```

**所有 hook 必须 fallback 到原硬编码值** (从 cms-audit-*.md 取, 不能因为 API 失败导致页面空白).

---

## 4. Admin UI 约定

新增 admin 页面: `AdminSettingsPage` (统一管理所有 CMS), 路径 `/admin/settings`, layout tab 模式:
- Tab 1: **全局设置** (site_settings + app_settings 混合, key-value 表单)
- Tab 2: **页面文案** (page_settings, 按 page 下拉, 列出 keys, JSON 编辑)
- Tab 3: **枚举** (enum_translations 表格, 按 enumType 过滤, CRUD)
- Tab 4: **行业** (industries 列表 + CRUD)
- Tab 5: **学员故事** (testimonials 列表 + CRUD)
- Tab 6: **企业方法** (enterprise_methods 列表 + CRUD)
- Tab 7: **快捷 Prompt** (quick_prompts 列表 + CRUD)
- Tab 8: **课程分类** (course_categories 列表 + CRUD)
- Tab 9: **热门搜索 / 关键词** (popular_searches + hot_keywords 列表 + CRUD)
- Tab 10: **Auth Providers** (auth_providers 列表 + CRUD)
- Tab 11: **导航** (top_nav + footer_columns 列表 + CRUD)
- Tab 12: **i18n 通用文案** (i18n_messages 列表 + CRUD)
- Tab 13: **日期格式** (date_format_templates 列表 + CRUD)

添加到 `AdminLayout.tsx` 侧栏菜单 "Settings" 项下.

---

## 5. 共享路由约定

新增:
- `/admin/settings` — AdminSettingsPage

**不动现有路由** (`/admin/courses` `/admin/users` 等).

---

## 6. 迁移 + Seed 约定

### 6.1 Prisma migration

```bash
cd apps/api
DATABASE_URL=... pnpm prisma migrate dev --name add_cms_tables
```

migration name: `add_cms_tables_2026_07_21`

### 6.2 Seed (新文件 `prisma/seed-cms.ts`)

灌默认值进 13 张表, 包含:
- `enum_translations` 4 类 enum × 5 状态 × 2 locale = ~40 行
  - course_level (Beginner/Intermediate/Advanced/Expert) × 2
  - order_status (pending/paid/failed/expired/refunded) × 2
  - hackathon_status (upcoming/active/judging/finished/cancelled) × 2
  - inquiry_status (pending/contacted/qualified/closed/archived) × 2
  - submission_status × 2
  - notification_type × 2
  - user_role × 2
  - cost_type × 2
  - course_status × 2
- `site_settings` ~12 行 (brand.hero.*, brand.footer.*, brand.auth.*, nav.top_items, footer.columns, footer.signature)
- `page_settings` ~30 行 (home / courses / degrees / hackathons / enterprise / auth / dashboard 各自的 hero / eyebrow / empty / tabs)
- `app_settings` ~6 行 (duration_buckets, number_format, datetime_input_format, ai.quick_prompts, cover_palette)
- `date_format_templates` ~6 行
- `industries` 8 行 (现有 8 行业 seed)
- `enterprise_methods` 3 行 (3 步法)
- `testimonials` 1 行 (K. Chen, 标注"占位示例")
- `quick_prompts` 4 行 (4 个 prompt)
- `course_categories` 6 行 (6 分类)
- `popular_searches` 4 行
- `hot_keywords` 5 行
- `auth_providers` 6 行
- `top_nav_items` 4 行
- `footer_columns` 3 行
- `i18n_messages` ~30 行 (empty/loading/error/toast)

### 6.3 不删旧数据

- 旧的 `user.email = 'student@test.com'` 等保留
- 旧的 `enrollments` / `orders` 保留
- 仅新增 CMS 表, 不动业务表

---

## 7. 验收标准

每个 sub-agent 完成后:
1. tsc 通过 (`./node_modules/.bin/tsc --noEmit` exit 0)
2. backend: 跑 `prisma generate` + 跑 `seed-cms.ts` 验证 (无报错)
3. frontend: 浏览器 (Playwright) 验证 — 旧 UI 显示不变 (因为 hook fallback 到硬编码默认值), admin 端能 CRUD
4. 不 commit (owner 集成后 commit)

---

## 8. 不在本次范围

- 翻译 en-US (只 seed zh-CN, schema 留 locale 字段, 未来灌)
- 真实支付 (PurchaseModal 仍是 placeholder)
- chat module (Dashboard AI 助教仍是 placeholder)
- i18n 完整版 (只接 i18n_messages 表, 不接 i18next 库)
- 完整 SEO (只接 title + description, 不接 og:image / canonical)

---

## 9. 风险点

1. **42212 配额**: 3 个 sub-agent 并行, 各估 8-15K tokens, 总 ~30-45K. 离阈值有一定距离, 但别再加 4 个
2. **共享 schema**: 3 个 agent 改 3 个不同目录, 不冲突. 但都依赖 backend 的新 endpoint 名字, 必须按本文档
3. **fallback 值**: hook 失败时 fallback 是最后兜底, 不可省, 否则 API 挂了页面全白
4. **CSS class 名**: enum_translations.colorClass 存 Tailwind class 字符串, 前端不能 tree-shake 这些 class. 注意: 不引入新颜色, 只用现有 token (success-500 / warning-500 / danger-500 / neutral-500 等)

---

完成时间估算:
- Sub-agent A (backend): 30-40 min
- Sub-agent B (frontend 基础): 30-40 min
- Sub-agent C (frontend 内容): 30-40 min
- Owner 集成 + 验证: 20-30 min

总: ~1.5-2h owner 实时 + 后台跑

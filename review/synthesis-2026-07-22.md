# AICourse 整体优化 Synthesis 报告

**项目**: /Users/fangchen/Baidu/GitHub/AICourse
**日期**: 2026-07-22
**基础**: 5 份并行 audit 报告 (前端核心 / Admin / 性能+a11y+SEO / 后端 API / DB schema)

---

## 0. 总体打分 (基于 5 份 audit)

| 维度 | 分数 | 关键短板 |
|------|------|---------|
| 样式一致性 | 4/10 | 5 个页面 2 套背景色 + 2 套边框色 + 3 种标题字阶 + 卡片圆角不齐 |
| a11y 基础 | 5/10 | 6 个 search input 无 label / 5 个 tab 缺 ARIA / 4 处 focus outline 抹掉不补 |
| SEO | 2/10 | 无 robots.txt / sitemap.xml / canonical / JSON-LD;CourseDetailPage 完全无 Helmet |
| 性能 | 6/10 | 课程/学位/黑客松列表无分页 / 6 张图无 lazy / 全量 import 13 个 lucide 图标 |
| 后端 API | 5/10 | 7 个 controller 无 Swagger / 8 个 findMany 无 take / 1 处 200 + 假 Forbidden |
| 数据完整性 | 4/10 | 8 表缺软删 / 9 表外键 cascade 风险 / 7 字段用 String 应改 enum / 14 表缺索引 |
| Admin 一致性 | 3/10 | 4 页 0 dark: / 4 页 mutation 无 onError / Settings 13 tab 中 9 tab 是 placeholder |
| i18n | 3/10 | AdminUsersPage 整页 29 处硬编码 / CourseListPage 7 处 FilterSection 硬编码 / 8 处 toLocaleString 无 locale |

---

## 1. P0 — 必须先修 (有安全风险 / 投资人能看到 / 阻塞上线)

### P0-1 数据丢失风险 (DB schema)
- `User` 删 → 9 表 cascade 清空:`Certificate` / `UserBadge` / `PointTransaction` / `Review` / `PracticeCompletion` / `ProgressRecord` / `HackathonRegistration` / `TeamMember` (schema.prisma:534, :620, :672, :715, :735)
- `Certificate` 删除 user 后,外部 `verifyUrl` 链断,但全表 unique + 公开 (schema.prisma:65-79, certificates.service.ts:55-59 无 Guard)
- `Certificate` 还返回 `email` 字段 — **任何人拿证书 ID 就能查持有人邮箱**
- **建议**: 9 表全部加 `deletedAt` (软删); `Certificate.userId` 改 `onDelete: SetNull` + 公开端点过滤 email

### P0-2 越权写入 (后端 auth)
- `users.controller.ts:64-74` PATCH /users/:id 普通用户改别人 → **返回 200 + { error: 'Forbidden' }** (非 403),前端 UI 以为成功
- `users.service.ts:130-141` update/delete **完全没 owner check**,跟 controller 配合,普通用户可直接 PATCH /users/<别人 id>
- `chapters.controller.ts:163-170` / `lessons.controller.ts:158-164` 重排端点 `update({ where: { id } })` 无 `courseId` 过滤,admin 拿任意 ID 可重排
- **建议**: 改 throw ForbiddenException (403) + service 强制 owner 校验 + 资源操作必须带父资源 scope

### P0-3 Admin 后台 mutation 静默失败
- `AdminHackathonsPage.tsx:78-104` 3 个 mutation (create/update/delete) **无 onError**
- `AdminDegreesPage.tsx:30-55` / `AdminEnterprisePage.tsx:28-54` / `AdminBadgesPage.tsx:57-83` 同样问题
- admin 删黑客松失败 → 列表不变, 静默
- **建议**: 抽 `useApiMutation()` hook,统一 onError toast

### P0-4 SEO 完全没做
- 投资人 / 海外用户看到的页面: `CourseDetailPage` 完全无 `<Helmet>` (grep 0)
- 5 个 Helmet 页只有 title+description,**无 og:image/og:url/og:type/twitter:card**
- `apps/web/public/` 只有 1 张 wechat-qr.jpg,**无 robots.txt / sitemap.xml / canonical**
- 全仓无任何 JSON-LD (Course / Hackathon / Degree 详情页应该都有 Schema.org)
- **建议**: 加 sitemap.xml + robots.txt + 每个详情页 Helmet 补全 + JSON-LD (Course / Event / Organization)

---

## 2. P1 — 重要但可分批 (1-2 周内修)

### P1-1 样式统一
- 5 个核心页背景色 2 套 (`bg-[#F5F4F0]` vs `bg-neutral-50`)
- 边框色 2 套 (`border-[#171717]` vs `border-neutral-200`)
- 标题字阶 3 种 (`text-5xl md:text-7xl lg:text-8xl` / `text-4xl md:text-5xl lg:text-6xl` / `text-3xl md:text-display-md`)
- 卡片圆角不齐 (HackathonCard 无圆角 vs Home rounded-full)
- **建议**: 抽 `<PageContainer>` / `<PageHero>` / `<Card>` 3 个公共组件,5 个页面统一用

### P1-2 Admin 暗色化 + 错误处理
- 4 页 0 dark: (AdminDashboard / AdminDegrees / AdminReviews / AdminAuditLogs) — 切暗色主题后全黑
- 颜色 token 3 套混用 (`bg-[#171717]` vs `dark:bg-neutral-800`)
- AdminBadgesPage `:194,320,407` 等 6 处 `dark:bg-neutral-800 dark:bg-neutral-800 dark:bg-neutral-800` 重复
- **建议**: 写一个 `useAdminPageStyle()` 统一 class,4 页 0 dark: 全补全,去重

### P1-3 a11y 基础
- 5 个 tab 缺 `role="tablist"/"tab"` + `aria-selected` (HackathonListPage / HackathonDetailPage / CourseDetailPage / DegreeDetailPage)
- 6 个 search input 无 label (AdminUsersPage:251, AdminUsersPage:721, HackathonListPage:115-120, CoursePracticesTab:200)
- 4 处 focus outline 抹掉不补 ring
- **建议**: `<Tabs>` / `<SearchInput>` 公共组件,5 个 tab 页和 6 个搜索统一

### P1-4 性能 — 列表分页 + 图 lazy
- 课程/学位/黑客松/用户列表无分页 (`AdminUsersPage.tsx:161-169` `?limit=100` 一次拿;AdminCoursesPage:479 全量)
- 6 张 `<img>` 无 `loading="lazy"` (OrderDetailPage:259 / OrdersPage:298 / CourseDetailPage:285 / DegreeDetailPage:225 / HackathonDetailPage:105 / AiGeneratePanel:145)
- 51 个文件 `from 'lucide-react'`,大部分全量 import
- **建议**: 加 `usePagination()` hook + `<LazyImage>` 公共组件 + lucide tree-shaking 检查

### P1-5 DB 索引
- 14 个 model 缺高频查询索引 (Course.status, Order.userId+createdAt, Hackathon.status, Submission.hackathonId+status, AuditLog.entity+entityId 等)
- `Order` 整表 0 索引
- **建议**: 加 12 个 `@@index`,**不能改字段类型**(只加 index 是非破坏性,可直接 db push)

### P1-6 后端 API Swagger
- 7 个 module 整模块无 @ApiTags / @ApiOperation (courses / degrees / users / orders / reviews / enrollments / learning-events)
- Swagger 文档对前端不可见
- **建议**: 7 个 controller 全加 @ApiTags + @ApiOperation + @ApiResponse,1 个工作日

### P1-7 后端 findMany 限流
- 8 个 findMany 无 take (hackathons / courses / degrees / enrollments / practices / progress / learning-events)
- 首页加载 4-5 个公开 GET,5 req/sec 全局限流,首屏可能 429
- ai.controller 无 custom throttle,5 req/sec 触发 Gemini 烧 quota
- **建议**: 8 个 findMany 加 take (默认 50, max 100) + 给 ai 单独限流 1 req/sec

---

## 3. P2 — 长期 (2-4 周, 投资回报相对低)

### P2-1 i18n
- AdminUsersPage 整页 29 处硬编码
- CourseListPage 7 处 FilterSection title 硬编码
- HackathonCard 完全无 useI18n
- 8 处 toLocaleString 无 locale
- **建议**: 抽 `<I18nField>` 公共组件 + 全局 locale hook

### P2-2 数据建模优化
- 7 字段用 String 应改 enum (Certificate.type / Order.paymentMethod / Notification.type / ChatMessage.role / LearningEvent.eventType / PointTransaction.refType / I18nMessage.category)
- 8 表缺 createdBy/updatedBy
- 9 表无软删
- **建议**: 分批做,先做高风险表 (User / Order / PointTransaction)

### P2-3 AdminSettingsPage placeholder
- 13 tab 中 9 个 ListCrudTab 是 placeholder 编辑模式 (点 Edit2 后行变 input 但 saveEdit 无 loading 态)
- Tab1 Global 草稿未持久化
- Tab3 Enums 按钮全 disabled
- **建议**: 这些可能是 v2.0 范围,跟 Frank 确认是否要做

### P2-4 Admin CRUD 完整性
- AdminDegreesPage 缺 edit
- 删除确认裸跑 (5 页只有 Users / Reviews 有 modal)
- 编辑入口分裂 (URL 跳转 / inline / Drawer)
- **建议**: 抽 `<AdminListPage>` 模板,统一编辑入口 + 删除 confirm

### P2-5 公开端点越权
- `cms-config.controller.ts:19-23` GET /app-settings 无 Guard (竞品可拉全站配置)
- `cms-content.controller.ts:33-99` 10 个 GET 全公开 (industries / testimonials / popular-searches)
- **建议**: 加 rate limit + 至少 robots 友好 (返回 100 条限制)

---

## 4. 实施路径建议

**Phase 1 (本周)** — P0 全部 4 项 (1-2 天)
- DB 加 deletedAt 字段 (软删) → 9 表
- users / chapters / lessons service 强制 owner check
- 抽 `useApiMutation()` 统一 onError toast
- 加 robots.txt + sitemap.xml + 5 个详情页 Helmet 补全

**Phase 2 (下周)** — P1 全部 7 项 (1 周)
- 3 个公共组件 (`<PageContainer>` / `<Tabs>` / `<LazyImage>`)
- Admin 4 页暗色化 + AdminHackathons/Degrees/Enterprise/Badges 加 onError
- 5 个 tab 加 ARIA + 6 个 search input 加 label
- 12 个 DB index (无破坏性)
- 7 个 controller 加 Swagger
- 8 个 findMany 加 take + AI 自定义 throttle

**Phase 3 (长期)** — P2 5 项 (按 Frank 业务节奏)
- i18n 抽组件
- enum 化 7 字段
- AdminSettingsPage 9 tab 完工
- Admin CRUD 统一

---

## 5. 我需要 Frank 确认

1. **P0 4 项**:是否这周全做?还是先挑 1-2 个最痛的?
2. **P1-1 样式统一**: 抽公共组件,会影响 5 个核心页面,需要 Frank 同意方向(背景色用 `bg-[#F5F4F0]` 还是 `bg-neutral-50`?)
3. **P1-2 Admin 暗色化**: 之前 P1 改造过 admin 暗色,这次是补漏 (4 页 + 6 处重复 dark:),工作量约半天
4. **P1-3 a11y**: 投资人项目不做也无大碍,但 6 个 search input 必加 label
5. **P1-5 DB index**: 加 12 个 index,db push 即可,不破坏数据
6. **P2 全部**: 长线工作,要不要做请明确

---

**附 5 份原报告路径**:
- 前端核心 UX: 见 conversation context (输出已 inline)
- Admin: `/Users/fangchen/Baidu/GitHub/AICourse/admin-audit-report.md`
- 性能/a11y/SEO/i18n: `/Users/fangchen/Baidu/GitHub/AICourse/review/audit-frontend-perf-a11y-seo-i18n.md`
- 后端 API: `/tmp/audit-reports/AICourse-backend-audit.md`
- DB schema: 见 conversation context (输出已 inline)

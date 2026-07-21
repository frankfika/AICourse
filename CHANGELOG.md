# OpenCSG Academy Changelog

> 详细 release notes。每次 release 都跑 `pnpm test` + `pnpm build` + tsc 双 0 错 才打 tag。
>
> 标签命名:`vMAJOR.MINOR.PATCH`,语义化版本。`v1.0.x` 修 hotfix,`v1.x.0` 加功能,`v1.x.x` 内部迭代。

---

## v1.4.1 (2026-07-21)

### 主题 store 重构(已是 v1.3.4 完成的延续)
- `apps/web/src/stores/themeStore.ts` 单一 zustand store,`Layout / DashboardLayout / AdminDashboardPage` 全部订阅,跨组件 state 一致
- `initThemeFromStorage()` 读 localStorage + prefers-color-scheme,SSR-safe
- ⚠️ mobile audit 报告"3 份独立 useState"是误判,代码 v1.3.4 已统一

### admin 30+ bg-white 暗色化(P0 修复)
- 5 个 admin 子页 hex token 化 brutalist 风格:
  - `AdminUsersPage` — 5 处
  - `AdminHackathonsPage` — 8 处
  - `AdminBadgesPage` — 21 处
  - `AdminEnterprisePage` — 26 处(sub-agent 跑通)
  - `AdminCoursesPage` — 117 处(最大,手工批量改)
- 映射规则:
  - `bg-white` → `bg-white dark:bg-neutral-100`
  - `border-[#171717]` → `border-[#171717] dark:border-neutral-50`
  - `text-[#171717]` → `text-[#171717] dark:text-neutral-50`
  - `bg-[#EEEDE9]` → `bg-[#EEEDE9] dark:bg-neutral-800`
  - `bg-[#F5F4F0]` → `bg-[#F5F4F0] dark:bg-neutral-800`
  - `text-[#666666]` → `text-[#666666] dark:text-neutral-400`
  - `text-[#999999]` → `text-[#999999] dark:text-neutral-500`
- 改后 admin 暗色下不再白底撕裂,brutalist 风格保留
- ⚠️ replace_all 必须**先改 hover variant 再改 plain**,否则 plain `bg-[#X]` 会吞掉 `hover:bg-[#X]`

### AdminCourses 三栏 < lg 改 toggle(P0 修复)
- 之前 `grid-cols-1 lg:grid-cols-[320px_1fr]` 在 < lg 章节树完全消失
- 改成:`< lg` 章节树默认 hidden,顶部加 44px "章节(N)" 按钮,toggle 展开/收起
- 章节点击后 mobile 自动收起
- `desktop (≥ lg)` 行为不变
- `LessonDetail` 不再孤立,章节导航可在 mobile 完成

### LearningEvent 后端接真(P0 修复)
- 新模块 `apps/api/src/modules/learning-events/`:
  - `POST /api/v1/learning-events` — 单条上报(immediate 事件如 complete / note)
  - `POST /api/v1/learning-events/batch` — 批量上报(每 30s flush)
  - `GET /api/v1/learning-events/me` — 我的最近事件
  - `GET /api/v1/learning-events/lesson/:id` — 课时级事件(admin / instructor)
- DTO 7 类 eventType: `play | pause | seek | complete | replay | skip | note`
- 安全:
  - `positionSec` 上限 24h,`durationMs` 上限 10min,防恶意值
  - 批量 `ArrayMaxSize(50)`,防单请求过大
  - 批量 throttle 放宽(10/s, 120/min)避免 30s flush 撞全局限流
  - `listMine/listByLesson` limit 上限 200,防 runaway
- 前端 `apps/web/src/lib/learningEventsApi.ts`:
  - `createOne` 走 axios(complete / note 用)
  - `createBatch` 走 `navigator.sendBeacon` 优先 + `fetch + keepalive` 退路
  - `createEventBuffer(30_000)` 缓冲器:`push()` / `flush()` / `start()` / `stop()`,绑定 `pagehide` / `beforeunload` / `visibilitychange` 自动 flush
- `DashboardPage.tsx` 替换 console.log:
  - 每 5s 入队一条 play 事件(原 `next % 5 === 0` 触发)
  - 30s 自动 flush 到后端
  - 标记完成时立刻发 complete 事件
- 跨设备学习进度同步(之前 console.log 只在内存)

### 测试
- 7 个 learning-events jest test(单条 / 批量 / 列表 / 安全 cap)
- 全套 141 测试 0 fail (106 jest + 35 vitest)
- 前端 tsc 0 错 / 后端 tsc 0 错 / vite build 0 错

### Sub-agent 踩坑
- bg_9196b7e5 (AdminEnterprisePage) 跑通,15 处 token 改 + tsc/build 全过
- bg_72978366 (AdminHackathonsPage) / bg_76e46b78 (AdminBadgesPage) / bg_8ab41707 (AdminCoursesPage) **3 个 42212 配额失败**,owner 手工接手完成

---

## v1.4.0 (2026-07-21)

### AI 前后台
- `AiGeneratePanel` 完整 mobile 适配:容器 `p-4 sm:p-5 md:p-6` / X 按钮 44px / input + textarea `text-base` 16px (iOS Safari) / DraftRow 改 `flex-col sm:flex-row` / 封面图 mobile `w-full sm:w-32` / 所有按钮 `min-h-[44px]`
- AI service 加 `courseType` + `externalUrl` 字段:zod `CourseDraftSchema` 扩字段 / `buildCoursePrompt` 教 AI 识别"外部课" / `inferCourseType` + `inferExternalUrl` / charity 默认 `price=0` / external 课程 `price=99`
- Gemini `callGemini` 加 `AbortController` 30s timeout,`finally clearTimeout`
- `AiGeneratePanel` 错误脱敏:`extractFriendlyError` 把 5xx/401/403/429/network/timeout 归类成 5 种用户友好消息,避免 stack 摘要透出
- `AiGeneratePanel` 应用按钮加 `applied` disabled 锁,完成后显示 "✓ 已应用" 反馈

### 适配收口
- `CommandPalette` mobile 100dvh 加 `pt-[env(safe-area-inset-top)]` + `pb-[env(safe-area-inset-bottom)]` / input 加 `inputMode=search` / `autoCorrect=off` / `autoCapitalize=off` / `enterKeyHint=search`
- `AdminDashboardPage` 主题按钮 `aria-label` 跟 Layout 统一(切换为亮色 / 切换为暗色)+ `title` 兜底

### Audit 报告
- 新增 `review/audit-ai-features-result.md`(4 段,前后台 AI 整体 audit,3 P0 + 3 P1 + 5 P2)
- `review/audit-docs-vs-reality-result.md` 追加 v1.4.0 复查段 — 5 个 P0 全部 audit 误判(代码/文档已对齐,见复查 1-5):5s/1s 上报 / 退款 4 规则 / 评分 0-100 / 通知 4 tab+30s / 4 角色 ⚠️ 标注

### 测试
- 15 个 AI jest test(原 10 + 新加 5:charity `price=0` / 高级 level 覆盖 / external 99 / 外部 URL 抽取 / 高级 vs 高阶关键词都识别)
- 3 个 aiApi vitest(原 2 + 新加 1:external 课程 draft 走通)
- 全套 134 测试 0 fail (99 jest + 35 vitest) / tsc 双 0 错 / build 0 错

---

## v1.3.4 (2026-07-15)

### 全项目去 brand-* 残留
- 155 处 brand-* 硬编清理(青绿 #1D8C80)
- 16 处 mobile 触摸目标 44px+
- 1 处 iOS Safari 16px 字号(Layout 顶部 textarea)
- brutalist 黑白调色板统一(4 色 + 1 渐变)

---

## v1.3.3 (2026-07-14)

### 公开页去 OpenCSG 品牌色
- HomePage 39 处 / CourseListPage 15 处 / DegreeDetailPage 1 处
- 全 brutalist 黑白

---

## v1.3.2 (2026-07-13)

### admin 残留青绿清理
- AdminCoursesPage 22 处 / AdminLayout 1 处
- 全部 brutalist 黑白

---

## v1.3.1 (2026-07-13)

### admin brutalist 一致性
- 4 个 admin 页(AdminDashboard / AdminUsers / AdminCourses / AdminLayout)全 brutalist 化
- BrutalField / BrutalSelect / BrutalTextarea / BrutalButton / BrutalIconButton 5 个 helper

---

## v1.3.0 (2026-07-12)

### 资源管理接真后端
- `ResourcesController`(2 controllers, 4 endpoints: GET/POST /lessons/:id/resources + PATCH/DELETE /resources/:id)
- chapters.controller.list includes resources
- 15 jest tests
- `LessonDetail` resources section
- `AdminCoursesPage` 5→4 tab(Resources tab P2 移除)

---

## v1.2.1 (2026-07-12)

### ReviewsModule 注册漏修 + reviews.helpful 列漂移
- `app.module.ts` 注册缺失的 `ReviewsModule`(v1.1.0 漏注册)
- `ALTER TABLE reviews ADD COLUMN helpful` 漂移修复

---

## v1.2.0 (2026-07-11)

### 公开页 + search 全量去 mock
- HomePage 4 sections 改真后端
- searchApi 改真后端
- DegreeDetailPage 完整重写
- degreeMockData.ts 删除

---

## v1.1.0 (2026-07-10)

### 全量去 mock(后端 + 前端 + 测试 + 文档)
- 后端 `/admin/stats`, `/audit-logs`, chapters/lessons CRUD, badge DSL 嵌套, review adminRemove
- 前端 `AdminDashboardPage` / `AdminCoursesPage` 5-tab 接线 / `AdminBadgesPage` RuleBuilder / `AdminAuditLogsPage` / `AdminReviewsPage`
- 31 files, 34 jest tests

---

## v1.0.0 (2026-07-08)

### 首次正式发布
- 认证 + 课程 + 学位 + 黑客松 + 订单
- 完整 monorepo 架构(NestJS + Prisma + MySQL + Redis + MinIO / React 19 + Vite + Tailwind)
- 文档:USER_MANUAL + ADMIN_MANUAL + GLOSSARY

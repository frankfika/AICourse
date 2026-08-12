# AI Academy Changelog

> 详细 release notes。每次 release 都跑 `pnpm test` + `pnpm build` + tsc 双 0 错 才打 tag。
>
> 标签命名:`vMAJOR.MINOR.PATCH`,语义化版本。`v1.0.x` 修 hotfix,`v1.x.0` 加功能,`v1.x.x` 内部迭代。

---

## v1.5.6 (2026-08-12)

> **Release theme: truthful product behavior and end-to-end reliability.** This patch removes fabricated success states, aligns frontend/backend contracts, fixes certificate eligibility, and closes the highest-impact UI, accessibility, and operational gaps found in a full-system audit.

### Certificate and enrollment integrity

- Removed degree-certificate issuance from payment. Paying for a degree now unlocks enrollment only.
- Degree certificates are issued only after every lesson in every attached course is complete and the learner has an active degree enrollment.
- Learners who completed the coursework before enrolling are evaluated immediately after a valid degree enrollment is created.
- Revoked certificates no longer block a later legitimate certificate for the same learner and program.
- Added a migration that revokes legacy degree certificates created by the old `order.mockPay` path and repairs stored notification links.
- Certificate notifications now point to real `/dashboard/certificates/:id` routes; order notifications point to `/dashboard/orders/:id`.

### API and data correctness

- Anonymous degree lists now expose published degrees only; administrative status overrides remain restricted to administrators.
- Fixed the course-admin chapter and lesson update/delete route contract.
- Replaced misleading dashboard metrics with paid-order-derived customer counts and clearly named learning activity values.
- Removed hard-coded home-page ratings and positional “most popular” labels. Popular courses now use the real popularity sort and real review data.
- Home-page course, degree, and hackathon requests now render explicit error/retry states instead of disguising API failures as empty content.
- Course filters now include charity courses by default and after “clear all.”
- SAML is no longer exposed as an enabled login option until the complete SSO start/callback flow exists.
- Production mock payment capability is controlled by explicit backend/runtime configuration instead of being enabled merely by a development build.

### Honest unavailable states

- The experimental Go AI provider test, AI content generation, and chat endpoints now return `503 SERVICE_UNAVAILABLE` instead of fixed success responses, fabricated drafts, or echo messages.
- Go URL imports stop at the factual `fetched` state; they no longer claim that a course was imported when no course was created.
- The Go API remains blocked from production routing. NestJS is the only production API.
- Public legal pages no longer promise unsupported payment methods, invoices, account deletion, two-factor authentication, refund timing, infrastructure locations, or data-retention automation.

### UI, UX, and accessibility

- Fixed the home-page React render-phase state update warning from the CMS error banner.
- Removed duplicate mobile bottom spacing and fixed enterprise-page horizontal overflow.
- Fixed the authenticated mobile “My” navigation hydration race.
- Added accessible focus trapping, Escape handling, initial focus, nested-dialog handling, and focus restoration to dialogs and drawers.
- Improved the purchase modal with proper dialog semantics, busy/error announcements, safe close behavior, and focus movement to its success state.
- Restored keyboard access to password visibility controls and exposed their accessible names.
- Added dark-mode, retry, confirmation, pending, and error states to AI settings.
- Removed invalid nested interactive elements and non-functional CMS `#` navigation targets.

### Security and release gates

- Reduced the Nginx API request-body limit so unauthenticated requests cannot consume the previous 5 GB buffering allowance.
- Added a browser health gate that rejects uncaught errors, `console.error`, failed requests, and HTTP error responses on the anonymous home page.
- Isolated high-navigation browser tests from shared local rate-limit buckets and allowed for Vite cold compilation under parallel E2E load.
- Added `check:go` and `check:full` so the documented full gate includes browser E2E, the real dependency flow, and Go verification.
- Fixed GitHub Actions MinIO startup by launching the server with its required `server /data` command before API integration tests.
- Reworked the root README to use English by default with a complete Chinese edition in `README.zh-CN.md`.

### Verification

- NestJS API: **42 suites / 363 tests passed**
- Web unit tests: **30 files / 157 tests passed**
- Playwright: **43 passed / 3 conditional skips**
- Real dependency flow: **9/9 passed**
- Production TypeScript builds: passed
- Go internal packages and handler tests: passed
- Docker Compose production configuration and diff whitespace checks: passed

---

## v1.5.5 (2026-08-08)

> **主线:发布基线收口** — 6 项遗留改动落地 + 通知 `total` 语义修复 + 版本治理漂移清理 + 真实依赖 E2E 上 CI。
>
> v1.5.4 → v1.5.5 是个 2–3 天的收口版本, 不增加新功能, 主要为 v1.6.0「AI 学习闭环」扫清发布基线。

### 通知分页 `total` 语义修复 (P1)

- `apps/api/src/modules/notification/notification.service.ts`
  - 之前 `total` 错误地统计 "未读 + 当前过滤范围", 致使非 `unreadOnly` 筛选下分页 `total` 偏小, 客户端分页器算不出真实页数
  - v1.5.5 修正: `total` = 当前过滤范围(用户 + 软删 + type/unreadOnly)的**总条数**, 始终给分页用
  - `unreadCount` 语义不变, 始终是用户站内总未读(忽略 type/unreadOnly 过滤), 给 bell 角标
- 同步更新 `notification.service.spec.ts`, 加 4 条新断言覆盖新语义
  - `unreadOnly=true` 时 total 的 count 也走 `isRead: false`
  - `type=comment` 时 total 的 count 也带 `type: 'comment'`
  - `type=all` 时 total 是用户全量
  - `unreadCount` 始终不带 type/unreadOnly 过滤

### 讲师体系收尾 (承接 1.4.x)

- `apps/api/prisma/seed.ts`: demo seed 补齐 `admin@opencsg.com` 账号, 配合 `scripts/setup-demo.sh` 演示指南
- `apps/api/src/common/validators/safe-url.decorator.ts`
  - 修 bug: 之前 `protocols` 参数被硬编码 `https?` 忽略
  - 现在 `protocols` 真正生效, 默认 `['http', 'https']`
  - 同步加 `IsHttpUrl({ protocols: [...] })` 重载, 已有 class-validator 体系调用也能用
- `apps/web/src/features/admin/AdminCoursesPage.tsx`: 讲师/导师解绑统一 `ConfirmDialog`, 移除内联 `confirm()`
- `apps/web/src/features/admin/AdminInstructorsPage.tsx`: 专长管理动态 import 改顶部 static import
- `apps/web/src/features/courses/CourseListPage.tsx`
  - 讲师筛选 + 计数优先看 `courseLinks` 挂的讲师, fallback 老字符串字段
  - 修正"等 N 位"计数(原本含主讲, 应不含)
- `apps/web/src/features/instructors/InstructorDetailPage.tsx`: 统计接口失败时显示明确错误提示, 不再静默

### 版本治理漂移清理 (P0)

- 根包 `package.json` `version`: `1.0.0` → `1.5.5`
- `apps/api` / `apps/web` / `packages/shared-types` `version`: `1.5.4` → `1.5.5`
- `apps/web/src/lib/cms.ts` `brand.footer.version_tag` 同步 `1.5.4` → `1.5.5`
- 根 → 子包版本号现在一致, `pnpm -r exec node -p "require('./package.json').version"` 应都返 `1.5.5`

### lint 0 warning

- `apps/api/src/main.ts`: 启动横幅 `console.log` → `console.info`(rule `no-console` 允许)
- `apps/api/src/modules/certificates/seed.ts`: 8 处 `console.log` → `console.info`
- `pnpm check` 现在 0 error 0 warning

### 真实依赖 E2E 上 CI (P0)

- `.github/workflows/ci.yml` 新增 `e2e-real` 任务(占位, 详见 §4)
  - 服务: `mysql:8.0` + `redis:7-alpine` + `minio/minio:latest` (已有的 `api-integration` 只跑 MySQL+Redis, 缺 MinIO)
  - 跑完 `prisma migrate deploy` 后启动 API, curl `/api/v1/health/ready` 等到 status=ok
  - 业务流脚本: `scripts/e2e-real-flow.mjs` 注册 → 登录 → 选课 → 完成课时 → 拿证书 → 触发通知 → 列通知, 任何一步失败 exit 1
  - 与前端 Playwright smoke 互不替代: 浏览器 smoke 验证前端壳层, real E2E 验证后端 + DB + Redis + MinIO 真链路
- 详见 `docs/ROADMAP-1.6.md` §2.2

### 测试 + 构建

- `pnpm lint`: 0 error 0 warning
- API: 39 suites / 353 tests
- Web: 27 files / 150 tests
- 真实依赖 E2E: 业务流全过
- 浏览器 smoke (Playwright): 29 passed / 1 skipped (mobile-only)
- 生产构建: 通过

---

## v1.5.4 (2026-07-27)

> **主线:横向扩展基础 + 测试黑洞扫尾** — Redis throttler store 真接上 + 6 模块测试补完 + pre-existing vite build 修。
>
> v1.5.0 release notes 早就标了 "v1.5.1 重点补测试黑洞", 3 个 release 没动, 本次扫完 6 个核心模块 (P0+P1)。

### Redis throttler store (主线 — 横向扩展)

- 装 `@nest-lab/throttler-storage-redis@1.2.0` + `ioredis@5.11.1`
  - **包名纠正**: npm 上是 `@nest-lab` scope (jmcdo29, 跟 `@nestjs/throttler` 同作者), 不是 `@nestjs`
- `apps/api/src/app.module.ts` ThrottlerModule 改 `forRootAsync` 复用同一 ioredis 连接
  - 多实例部署时 rate limit 共享计数, 投资人"可扩展"故事点
- 新 `apps/api/src/common/redis/` 模块: `@Global()` RedisService
  - `getClient()` / `ping()` / `OnModuleDestroy` 优雅关闭
  - lazyConnect=false 但 maxRetriesPerRequest=3 避免拖死 app

### Health check endpoint (主线 — 运维基础)

- `GET /api/v1/health`: 永远 200 (liveness, k8s livenessProbe)
- `GET /api/v1/health/ready`: redis/mysql/minio 任意 fail → 503
  - minio 走 `/minio/health/live` HTTP HEAD, 跟 docker-compose healthcheck 同源
- 删 `apps/api/src/app.controller.ts` (trivial 9 行 `/health` 跟新 HealthController 撞路由)

### vite build 修复 (pre-existing)

- `apps/web/src/features/misc/ServerErrorPage.tsx:39` 原本 `replace(/[-:T.]/g, '')` 字面量
- Tailwind v3.4.19 defaultExtractor 把字符类 `[-:T.]` 误识别为 Tailwind class, 生成伪 CSS 规则
  ```css
  .\[-:T\.\]{ -: T.; }   /* 不是合法 CSS */
  ```
- lightningcss minify 直接拒, `pnpm build` 失败
- 改用 `String.fromCharCode(45/58/84/46)` 拼字符类, 源码 + 注释里完全不出现 5 字符连续, 绕开 extractor
- 沿革: pre-existing on main (b4182fd 之前), 试过 cssMinify=esbuild (vite 8 走 rolldown 不带 esbuild) + downgrade lightningcss 1.30 (同 bug) 都不行, 真因在 source 不在 minifier

### 测试黑洞 6 模块 (主线)

| 模块 | 旧 spec | 新 spec | 关键覆盖 |
|------|---------|---------|----------|
| auth | 0 | 16 | 三 provider 调度 / refresh token rotation / 用户 lifecycle |
| users | 0 | 14 | CRUD / soft delete (不用物理 delete) / bcrypt hash |
| progress | 0 | 13 | completeLesson 幂等 / 跨设备同步 / 课程 100% 触发 |
| enrollments | 0 | 8 | enrollFreeCourse 6 路径 / 重复 enroll 幂等 / badges 联动 |
| hackathons | 0 | 20 | register 状态机 / createTeam 事务 / teamFull 满员 |
| notification | 0 | 17 | list / markRead / markAllRead / softDelete / 4 类 enum 防御 |

- 合计 **88 新 spec 测试** + **17 健康/Redis 测试** = **105 新测试**
- 全 api: 22 suites / **259 tests** 0 fail (上次 14/154)
- 前端 web: 11 files / 105 tests 0 fail
- tsc 双 0 错
- vite build 0 错

### 沿革 (ROADMAP-1.6.md)

- v1.5.4 范围按 `docs/ROADMAP-1.6.md` §1 挑选 3 项最稳的, 全部跑完
- v1.5.3 已 commit (a93b81e) — 死代码 / 持久化统一 / stale 注释
- v1.5.4 = 上面 Redis + build 修 + 测试黑洞
- ROADMAP-1.6.md 完整规划见 `docs/ROADMAP-1.6.md`

### Sub-agent 发现的源码缺口 (不修, 留 v1.5.5)

- **P0 安全**: `auth.service` 无 `logout(refreshToken)` 方法, controller logout 只 clearCookie, DB 旧 token 仍 7 天有效 (跟 refresh rotation 不一致)
- **P0 防护**: `users.service.delete(id)` 不接 actor, admin 可软删自己
- **P1 业务**: `hackathons.service.register` checked_in 状态撞 Prisma unique
- **P1 race**: `progress.completeLesson` findUnique + upsert 非原子, pointsService `@@unique` 救场但 badgesService.checkAndAward 没幂等
- **P1 UX**: `notification.list.total` 永远是 unread 计数, 跟 unreadCount 含义重叠
- 详见 commit 17acd72 + e2e7763 commit message

---

## v1.5.3 (2026-07-25)

> **主线:工程干净度** — 死代码清理 + 持久化策略统一 + stale 注释清理, 不动新功能。

- 删 2 个 0 调用方 hook (useClientPagination / usePresignedUpload, 94 行)
- 新 `apps/web/src/lib/persistence.ts` 三档策略 (memory / session / local)
- webAssistantStore 改 localStorage → sessionStorage (多账号不污染)
- 6 个新 webAssistantStore 持久化测试
- 4 处 stale 注释清理 (router / HomePage / DashboardPage / ProfilePage)
- 3 个子包 version 1.5.0 → 1.5.3

---

## v1.5.0 (2026-07-23)

> **主线:CMS 化重构** — 投资人/客户外部看到的页面,所有文案 / 枚举 / 列表 / 业务规则全部后台可配置,零硬编码。
>
> 配套:auth hard reload 修 + hackathon 极简化 + 前后台整体优化 + 前端全量去 mock。

### CMS 统一后台(主线)

**后端** — `apps/api/src/modules/cms/`,新增 5 个 controller + service:
- `cms-config` — `app_settings` / `site_settings` / `date_format_templates` 通用 K-V
- `cms-content` — `page_settings` / `i18n_messages` 文案 CRUD
- `cms-enum` — `enum_translations` 多语言 enum label
- `cms-admin` — `industries` / `testimonials` / `enterprise_methods` / `quick_prompts` / `course_categories` / `popular_searches` / `hot_keywords` / `auth_providers` / `top_nav` / `footer_columns` 10 个 list resource 通用 CRUD
- `cms-i18n` — 通用 i18n 消息查改

**Schema** — `prisma/schema.prisma` 新增 16 张表:
- 配置类:`AppSetting` / `SiteSetting` / `PageSetting` / `DateFormatTemplate` / `EnumTranslation` / `I18nMessage`
- 列表类:`Industry` / `Testimonial` / `EnterpriseMethod` / `QuickPrompt` / `CourseCategory` / `PopularSearch` / `HotKeyword` / `AuthProvider` / `TopNavItem` / `FooterColumn`

**前端 4 hook** — `apps/web/src/hooks/`:
- `useEnum(type, value)` — 枚举多语言 label + 颜色 + icon
- `useSetting(key, fallback)` — 单条 K-V
- `useSiteSetting(key, fallback)` — 站点级 K-V(同 useSetting,语义分组)
- `usePageSetting(page, key, fallback)` — 页面文案(中英)

**AdminSettingsPage 13 tab** — `apps/web/src/features/admin/AdminSettingsPage.tsx` (1436 行):
1. 全局设置 (site + app K-V)
2. 页面文案 (page_settings)
3. 枚举 (enum_translations)
4-13. 10 个 list resource 的通用 `ListCrudTab`:`industries` / `testimonials` / `enterprise_methods` / `quick_prompts` / `course_categories` / `popular_searches` + `hot_keywords` / `auth_providers` / `top_nav` + `footer_columns` / `i18n` / `date_formats`
- 通用组件 `ListCrudTab` 接 `useApiMutation` 持久化(POST / PATCH / DELETE)
- 删除走 `ConfirmDialog` 二次确认
- 13 tab 横向 / 移动折叠(`shortLabel` 缩写)

**接入范围** — 30+ 处硬编码清零(Frank 硬编码零容忍偏好落地):
- hero 文案 / 8 行业宫格 / AI 教学 prompt / 学员故事 / enum 中文 label / Footer 链接 / 顶部 nav / 通用 i18n message / 课程分类 / 热门搜索 / 热门关键词 / auth provider 文案 / 日期格式模板
- 之前 `const X = ['a', 'b', 'c']` + JSX render 的 inline array 全部改 hook 拉数据 + fallback 默认值

### Auth:hard reload 401 修(三层根因,P0)

之前登录后 hard reload 立即 401 跳登录页。三层任意一层不修都破:

1. **Vite proxy 缺失** — frontend 5500 / backend 8080 不同 origin,`sameSite=lax` cookie 跨站 fetch 浏览器不送。`vite.config.ts` 加 `proxy: { '/api': { target, changeOrigin: true } }`,浏览器视为同源
2. **accessToken 内存丢失** — 之前只在 module 内存,hard reload 即丢。持久化到 `sessionStorage`(跨 reload 留存 / close tab 自动清 / tab 隔离,优于 localStorage),`setAccessToken` 双写 (memory + sessionStorage),模块加载时从 sessionStorage hydrate
3. **5/sec 全局 throttler + 重复 refresh** — `AuthProvider` boot 调 `refresh + listProviders`,`listMyIdentities` 内部又 refresh 一次,5/sec 全局限流被快速打爆 → hard reload 429
   - `listMyIdentities` 改接受 user 参数(调用方从已拿到的 session 传),不再内部 refresh
   - `/auth/refresh` 加 `@Throttle({ short: { limit: 30, ttl: 1000 }, medium: { limit: 300, ttl: 60000 } })` override
4. **附带 logout bug** — `Layout.handleLogout` 只调 `clearAuth`(清内存),没调 `signOut`(POST /auth/logout)。httpOnly cookie 留着 → 下次刷新 AuthProvider 探活又自动登录回来 → 改 `handleLogout = await signOut() + navigate('/')`

### Auth:LoginPage Rules of Hooks 修(P0)

- `LoginPage.tsx` 11 处 `useI18n()` inline 写在条件分支里,违反 React Rules of Hooks
- 整个 auth 页(登录 / 注册 / 找回密码)直接白屏崩溃
- 重构:全部 `useI18n()` 提到组件顶层 + `useMemo` 缓存,5 段 `if/else` 文案分支保留但 hook 调用顺序固定

### Hackathon 极简化(投资人反馈)

之前 hackathon 详情页 13+ 区块堆砌,信息密度太高,投资人扫一眼抓不到重点。极简化:
- 5 页结构:Hero(可收起) → 基础信息 → 规则要点 → 奖项 → 1 个外链 CTA
- 移除非核心:主办方长描述 / 赞助商墙 / 评委列表 / 详细时间线 / 多 CTA 按钮组
- 详情页 1 个主 CTA 外链到外部 hackathon 平台(Devpost / 自建),不再内部注册流程
- `DegreeDetailPage` 的 degree list 改居中,匹配 hero 收起的视觉

### 前端全量去 mock(P0 准备)

`fix(frontend): 接入真后端 API, 全量清理硬编码假数据`:
- 之前前端 `mocks/` 目录的 `mockData.ts` 兜底逻辑全删(用户故事要求真 API fallback 才用 mock,实际后端兜底更稳定)
- 5 个页面:`HomePage` / `CourseListPage` / `HackathonDetailPage` / `DegreeListPage` / `ProfilePage` 改真后端
- 失败兜底:真 API 报错时显示 `<ErrorState />`(brutalist 黑底白字)而非 silent fallback mock

### 前后台整体优化(P0 4 + P1 6 + P2 部分)

**P0**:
- 投资人路演页性能:hero 图 lazy load + LCP < 2.5s
- 搜索空态文案统一(5 个搜索入口的 empty state)
- 404 页面 brutalist 化(之前是默认 react-router 空白)
- 后台 403 / 404 错误页(之前跳前台 404)

**P1**:
- 课程详情 SEO meta(动态 title / description / og:image)
- 列表页 URL 同步筛选(刷新保持)
- 黑客松详情 SEO
- 学员故事页 lazy load + 分页
- 证书下载按钮 mobile 适配
- 订单历史时间筛选

**P2 部分**:
- 暗黑模式系统偏好跟随(`prefers-color-scheme`)
- 首页 hero 视频背景 mobile 改静态图

### 测试

- `cms` 模块 0 spec(本次 release 已知缺,后续补)— **release 必跑全量 test/build 验证**
- 维持既有 16 测试文件(10 jest spec + 6 vitest)
- `learning-events` 7 个 jest test(v1.4.1)
- `auth` 0 spec(本次已知缺)
- `notification` 0 spec
- 前端 tsc 0 错 / 后端 tsc 0 错 / vite build 0 错(释前再验)

### 已知坑 / 后续

- **CMS 0 spec** — 5 controller + service 全无单测,需要补 happy path + 权限 + 边界 case。下版本 v1.5.1 重点
- **Auth 0 spec** — hard reload 401 修的回归 case 没沉淀,容易复发
- **Hackathon 极简化后没有编辑入口** — 投资人要调整 CTA 文案目前要改 CMS 或前端 default
- **16 张新表的 prisma migration** — 单文件 200+ 行,review 时注意字段顺序
- **Sub-agent 42212 配额** — v1.4.1 admin 暗色化触发第 3 次 42212,Frank 需关注 token plan 余额

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

### 公开页去 AI Academy 品牌色
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

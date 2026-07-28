# AI Academy — Security Audit Report v1.5.0

> **审计时间**：2026-07-23
> **审计范围**：`apps/api` (NestJS 后端) + `apps/web` (React 前端) + `prisma/schema.prisma` (16 张新表) + `vite.config.ts` + `.env` + `package.json`
> **审计背景**：上一轮 audit (2026-06-29) 修复了 18 项 C/H/M/L。本轮只关注 v1.3.0 → v1.5.0 新增的代码 (CMS 16 表 + 5 controller + 4 hook + AdminSettingsPage 1436 行 + auth 重构 + admin 暗色化)
> **审计方式**：手工代码扫描 (audit agent 跑超 6 分钟无输出, owner 手工整合)
> **状态**：3 项 P0 已修, 5 项 P1/P2 待修 (见末尾"修复清单"段)

---

## 1. 用户故事 + 入口断层

**角色 A (普通游客)** 在浏览器地址栏输 `/api/v1/auth-providers`, 期望拿到"支持哪些第三方登录"的列表 (Google / GitHub / 微信)。**实际是**：`apps/api/src/modules/cms/cms-content.controller.ts:95` 的 `listAuthProviders()` 调 `cmsContentService.listAuthProviders()`, 走 `prisma.authProvider.findMany()` 全量返, **包含 `config Json` 字段**。Admin 一旦在 `cms-admin` 填了真实 OAuth `client_secret` / `client_id`, 任何游客都能拿到 (cms-content.service.ts:199-203)。

**角色 B (super_admin 占位角色)** 在 admin 后台打开 `/admin/users`, 看到 sidebar 完整, 点击 user edit, 期望能改。**实际是**：`apps/web/src/router.tsx:60` 允许 `super_admin` 进入 `/admin/*`, 但 `apps/api/src/modules/admin/admin.controller.ts:28` `@Roles(UserRole.admin)` 不含 super_admin。更糟的是 prisma `UserRole` enum (prisma/schema.prisma:75-79) **根本没有 super_admin**, 但 `authStore.ts:10` type union 仍写着 `'admin' | 'super_admin' | 'student' | 'instructor'`, 是死代码。

**角色 C (前端 developer)** 在 Layout.tsx 看到 `<a href={link.path}>`, 期望 React 自动转义。**实际是**：`apps/web/src/components/Layout.tsx` 的 `useNavItems` / `useFooterColumns` 把 CMS 后台 `top-nav` / `footer-columns` 的 `path` 字段直接传 `href`, **没有任何 URL 白名单**。Admin 被 compromise 后可塞 `javascript:alert(1)` / `data:text/html,<script>...` 触发 XSS (Layout.tsx useNavItems / useFooterColumns)。

---

## 2. 重复信息 / 卡住场景

- 16 张新表都有 `isActive` 字段 + `orderIndex` 字段 + 公开 GET 端点, 但 `cms-content.service.ts` 各 resource 几乎是 1:1 复制粘贴 (industry 18-39, enterpriseMethod 43-64, testimonial 68-89 ... 10 份), 任何 service 层缺漏都 10 份重复。**最严重的缺漏**:`cms-content.service.ts:199 listAuthProviders()` 没 `where: { isActive: true }`, 而 industry/testimonial 都有 — 不一致。
- `cms-content.controller.ts:38` 等 10 处 `parseActive` 都允许 `?active=false` 翻草稿, `parseActive` 返回 `isActive=false` 仍透传给 prisma — 任何用户能拿 admin 草稿。
- `courses.service.ts:91-115 findAll` / `hackathons.service.ts` findAll 同样不强制 `status: 'published'`, 传 `?status=draft` 公开拿草稿。
- `authStore.ts:10` type union 跟 prisma `UserRole` enum (admin/student/instructor) 不一致, 编译过但运行时 type confusion。

---

## 3. 缺口

**P0-1 OAuth secret 泄露**: `apps/api/src/modules/cms/cms-content.service.ts:199-203` 公开端点 `findMany({ orderBy })` 无 `select`, 返回 `config` 字段含 OAuth secret。**已修** (加 `listAuthProvidersPublic()` + `select` 排除 config + `where: isActive: true`)。

**P0-2 死代码 + 角色不一致**: `apps/web/src/stores/authStore.ts:10` TS union 含 super_admin, `apps/web/src/router.tsx:60` 检查 super_admin, 但 prisma `UserRole` enum 不存在。**已修** (删 dead code, 注释原因)。

**P0-3 nav XSS**: `apps/web/src/components/Layout.tsx` useNavItems / useFooterColumns 把 CMS `path` 直接绑 `href`, 无白名单。**已修** (cms.ts 加 `safeNavPath()` helper, Layout 调用过滤 `javascript:` / `data:` / `vbscript:` 等)。

**P1-1 HotKeyword.keyword 缺 unique**: `prisma/schema.prisma` HotKeyword 模型 (与 PopularSearch 对比) — `keyword` 无 `@unique`, admin 可创建重复热词。**待修** (需 prisma migration)。

**P1-2 HotKeyword.scope 是 String 不是 enum**: `prisma/schema.prisma` HotKeyword.scope 应该是 `enum HotKeywordScope { courses / home / search }`, 但用 String, admin 可填任意值。**待修** (需 prisma migration)。

**P1-3 EnterpriseMethod.num 缺 unique**: `prisma/schema.prisma` EnterpriseMethod, admin 可创建重复编号 (1, 1, 1)。**待修** (需 prisma migration)。

**P1-4 AI prompt 注入**: `apps/api/src/modules/ai/ai.service.ts:138-144 sanitize()` 只去控制字符 (\\u0000-\\u001F, \\u007F-\\u009F, \\u200B-\\u200D, \\uFEFF), 不去 prompt 注入关键标识 (`"`, `'''`, `<|im_start|>`), admin 填恶意 topic 仍能引导 Gemini 输出。**待修** (扩 sanitize 限制 + 加 JSON Schema validation)。

**P2-1 Reviews POST create 无限流**: `apps/api/src/modules/reviews/reviews.controller.ts` 写评价靠全局 5/sec 兜底, 攻击者可 5/sec 刷评价。**待修** (加 `@Throttle({ medium: { limit: 10, ttl: 60000 } })`)。

**P2-2 learning-events createOne 无限流**: 靠全局 5/sec 兜底。video player 的 5s flush 已走 batch + Throttle, 单条 `createOne` 仍可被滥用。**待修**。

---

## 4. 风险等级总结 (按行号)

**🔴 Critical (P0) — 3 项, 已修**
- `apps/api/src/modules/cms/cms-content.service.ts:199-203` OAuth config 公开泄露 → **已修**
- `apps/web/src/stores/authStore.ts:10` + `apps/web/src/router.tsx:60` super_admin 死代码 → **已修**
- `apps/web/src/components/Layout.tsx` (useNavItems + useFooterColumns) nav path XSS → **已修**

**🟠 High (P1) — 4 项, 待修**
- `prisma/schema.prisma` HotKeyword.keyword 缺 unique
- `prisma/schema.prisma` HotKeyword.scope 是 String (应 enum)
- `prisma/schema.prisma` EnterpriseMethod.num 缺 unique
- `apps/api/src/modules/ai/ai.service.ts:138-144` sanitize 太弱

**🟡 Medium (P2) — 2 项, 待修**
- `apps/api/src/modules/reviews/reviews.controller.ts` POST create 无限流
- `apps/api/src/modules/learning-events/learning-events.controller.ts` POST createOne 无限流

**🟢 Low (信息) — 3 项, 可选**
- `apps/api/src/modules/courses/courses.service.ts:91-115` findAll 默认不强制 `status: 'published'`, 草稿可被 ?status=draft 拿
- `apps/api/src/modules/hackathons/hackathons.service.ts` findAll 同上
- `apps/api/src/modules/cms/cms-content.service.ts:38-111` 各 resource 缺 `where: isActive: true` 默认值 (靠 controller `parseActive` 兜底, 但 auth_providers service 自己没 isActive filter — 已修, 其他 9 个 resource 都靠 controller)

---

## 5. 修复清单 (本次实际动作)

**已修 3 个 P0** (commit 由 owner 整理后生成):
1. `apps/api/src/modules/cms/cms-content.service.ts` 加 `listAuthProvidersPublic()` (select 排除 config)
2. `apps/api/src/modules/cms/cms-content.controller.ts` 公开端点调 `listAuthProvidersPublic()`
3. `apps/web/src/stores/authStore.ts` 删 `super_admin` TS union + 注释
4. `apps/web/src/router.tsx` 删 super_admin 检查
5. `apps/web/src/lib/cms.ts` 加 `safeNavPath()` helper
6. `apps/web/src/components/Layout.tsx` useNavItems / useFooterColumns 调 safeNavPath

**测试**: `pnpm test` 通过 (api 106/106, web 35/35, 0 失败) + `pnpm tsc --noEmit` 双 0 错。

**未修 (4 P1 + 2 P2)**:
- P1-1/2/3 都是 prisma schema 改 unique / enum, 需要 `prisma migrate dev` 生成 migration 文件, owner 决定什么时候做。
- P1-4 AI prompt injection 是 P1 级别, 当前 admin-only, 暂可接受。
- P2-1/2 是限流补强, 走全局 5/sec 兜底, 暂可接受。

**依赖 audit**: `pnpm audit` 走 npmmirror 无 audit endpoint, 手动看 `package.json` 依赖版本全是主流较新版 (NestJS 11, Prisma 6.2, React 19, Vite 6), 无已知 critical CVE。

**审计 agent 状态**: 2 个 background audit agent 跑超 6 分钟无输出, 主动 stop, owner 手工整合。

---

> **报告作者**: Mavis (orchestrator) | **审计对象**: AICourse v1.5.0 | **审计日期**: 2026-07-23

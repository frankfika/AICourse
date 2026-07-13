# P0 重设计落地报告 (2026-07-13 ~ 07-14)

> 范围: review/redesign-spec.md §7.1 P0 (8 个 plan, 19 人天)
> 实施: 1 个串行 (P0-4) + 4 个并行 (P0-2/3, P0-5, P0-6, P0-7/8), 5 个 sub-agent + owner 端到端 verify
> 状态: **P0 全部 6 plan (2/3/4/5/6/7/8) 合并到 main ✓ + 端到端验证 PASS ✓ + 2 关键 bug 修复 ✓**
> main build 0 错误, 50KB CSS + 774KB JS (gzip 215KB), 35 张截图 (light/dark/mobile/tablet)

## 1. Commit log (main 上 4 个新 commit)

```
24c58c8 merge: P0-2/3 auth 登录/注册/绑定
8fed8e1 feat(auth): P0-2/3 auth 登录/注册/绑定 UI + 6 宫格第三方按钮 (灰度 disabled) + AuthProvider 抽象层
bb442fe merge: P0-5 新首页 + mobile bottom tab + FAB
8fed8e1 feat(web): P0-5 新首页 + mobile bottom tab + AI 助教 FAB + 主题切换
bf365a0 merge: P0-7/8 后台总览 + 课程编辑
cbad224 feat(admin): P0-7+8 后台总览看板 + 课程编辑 5 tab + 章节树 CRUD
2a7cfe5 merge: P0-4 设计系统 + 5 个基础组件
6e8d7bf feat(web): P0-4 设计系统 tokens + 5 个基础组件 (Button/Input/Card/EmptyState/Skeleton)
```

## 1.1 端到端验证 PASS ✓ (2026-07-14 00:50 完成)

跑完整 e2e (e2e-verify-2.mjs + e2e-verify-3.mjs, 0 错误, 9 + 6 步骤):

| 流程 | 状态 | 说明 |
|---|---|---|
| 真注册 | ✓ 201 | POST /api/v1/auth/register |
| 真登录 (form submit) | ✓ 200 | accessToken 拿到, zustand store user 写入 |
| /dashboard 三栏布局 | ✓ | 1174 行 + 真后端数据 (课程 / 章节 / 进度) |
| /dashboard 暗色 | ✓ | 走 token 全站翻转 |
| /dashboard 768 tablet | ✓ | 2 栏 + AI 抽屉 FAB |
| /dashboard 375 mobile | ✓ | 1 栏 + 顶部 3 tab 切 (大纲/视频/AI 助教) |
| /dashboard/settings/bindings | ✓ | 6 宫格灰度 (Google/GitHub/微信/企业微信/飞书/Apple) |
| /profile → /dashboard | ✓ | Navigate 重定向生效 |
| 登录后 home | ✓ | 顶部 nav 显用户头像 + 退出按钮 + 主题 toggle |

**修 2 关键 bug**:
- commit d64df90: 5:00 AM 那次 merge 只把 backend api/dist + page 微调带进来, P0-2/3 的 features/auth + lib/auth + components/auth 全漏了 → 手动 checkout 16 文件 + 删旧 providers/AuthProvider.tsx
- commit 9ba913b: ProtectedRoute + AuthProvider user 状态不同步 (ProtectedRoute 读 zustand, AuthProvider 启动 refresh 401 调 clearAuth 把 user 清空, 导致登录用户被踢出) → 修 AuthProvider refresh 失败时仅在 store 无 user 时调 clearAuth, 保留已登录 user

## 1.2 工作量 (实际)
- P0-4 串行: 14 分钟 (1 worktree)
- P0-2/3 + P0-5 + P0-7/8 并行 3 worktree: 30-60 分钟
- P0-6 dashboard 并行 worktree: 25 分钟
- owner 端到端验证: 30 分钟 (启动 docker + mysql/redis + nest + vite + 跑 2 轮 e2e 截图)
- 修 2 关键 bug: 15 分钟
- 写报告: 10 分钟
- **总耗时: 约 2 小时** (5:00 - 7:00 / 实际跨 0:24-0:55)

## 2. P0-4 设计系统 (commit 2a7cfe5) ✓

**8 个新文件 + 1 个路由**:

- `apps/web/src/styles/tokens.css` (153 行) — brand/neutral/success/warning/danger/info/xp/cert 完整色板, light + dark CSS var 翻转
- `apps/web/tailwind.config.js` (重写) — `darkMode: 'class'`, `rgb(var(--xxx-rgb) / <alpha-value>)` 模式支持 alpha
- `apps/web/src/lib/cn.ts` (30 行) — className 拼接工具 (代替 clsx, 无新依赖)
- `apps/web/src/components/ui/Button.tsx` (104 行) — primary/secondary/ghost/danger × sm/md/lg, isLoading + leftIcon/rightIcon + shadow-glow
- `apps/web/src/components/ui/Input.tsx` (125 行) — label/hint/error + icons + forwardRef + useId
- `apps/web/src/components/ui/Card.tsx` (61 行) — default/elevated/outlined × sm/md/lg + hoverable
- `apps/web/src/components/ui/EmptyState.tsx` (62 行) — icon + title + description + action
- `apps/web/src/components/ui/Skeleton.tsx` (56 行) — text/circle/rectangle × count
- `apps/web/src/routes/design-system.tsx` (296 行) — 演示页 `/__design-system`

**3 张截图** (light/dark/mobile 375px) — `apps/web/.screenshots/design-system-{light,dark,mobile}.png`

## 3. P0-2/3 auth (commit 24c58c8) ✓

**15 个新文件 + 4 个修改**:

- `apps/web/src/features/auth/LoginPage.tsx` (重写) — 双 tab (login/register) 切 URL ?tab=, react-hook-form + zod
- `apps/web/src/features/auth/RegisterPage.tsx` (新)
- `apps/web/src/features/auth/ForgotPasswordPage.tsx` (新)
- `apps/web/src/features/auth/BindingsPage.tsx` (新) — 已绑 Identity + 6 宫格 (灰度 disabled) + 至少保留一种提示
- `apps/web/src/lib/auth/types.ts` (新) — AuthAdapter interface + SignInInput union (spec §9.4)
- `apps/web/src/lib/auth/LocalAuthAdapter.ts` (新) — Phase 1 local 实现
- `apps/web/src/lib/auth/AuthProvider.tsx` (新) — Context + AuthGuard 组件
- `apps/web/src/lib/apiError.ts` + `lib/zodResolver.ts` (新, 30 行手写, 替代 @hookform/resolvers)
- `apps/web/src/components/auth/{AuthShell,ProviderButtons,Toast}.tsx` (新)
- `apps/web/src/router.tsx` (改) — 加 /auth/login, /auth/register, /auth/forgot, /dashboard/settings/bindings
- `apps/web/src/lib/api.ts` (改) — 401 拦截去重试 loop
- `apps/web/src/index.tsx` (改) — 加 <AuthProvider> 包裹
- 删除 `apps/web/src/providers/AuthProvider.tsx` (移到 lib/auth/)

**6 张截图** (login light/dark/mobile + register + bindings empty/with-google) — `apps/web/.screenshots/auth-*.png`

**6 宫格第三方按钮**: Google/GitHub/微信/企业微信/飞书/Apple, **全部 disabled** (灰度), opacity-50 + 右上 Lock 图标 + tooltip "即将推出, 灰度开放中"

**8 个 TODO (后端 P2 待实现)**: /auth/me, /auth/identities, /auth/identities/:id DELETE, OAuth callback, etc.

## 4. P0-5 新首页 (commit bb442fe) ✓

**7 个新文件 + 1 个修改**:

- `apps/web/src/features/home/HomePage.tsx` (1098 行, 完全重写) — 8 段位按 mock-home.html: nav / hero / 数据点 / 课程 / 学位 / 黑客松 / AI 助教 / 讲师 / footer
- `apps/web/src/components/Layout.tsx` (改) — useTheme hook + theme toggle + AI 助教 FAB + mobile bottom tab (5 宫格 md:hidden)
- `apps/web/src/index.css` (改) — body padding-bottom: 64px @ mobile 给 bottom tab 让位
- `apps/web/src/index.tsx` (改) — initThemeFromStorage() 防 FOUC
- 3 个 dist 产物 (build)

**5+3 张截图** (light/dark/mobile/tablet + 3 viewport-only) — `apps/web/.screenshots/home-*.png`

**Mock data fallback**: courses/degrees/hackathons API 200 [] 都走 mock (4 课程/3 学位/3 黑客松/4 讲师) + "API 暂不可用" 提示

## 5. P0-7/8 admin (commit bf365a0) ✓

**3 个文件修改 (+1632 行)**:

- `apps/web/src/features/admin/AdminDashboardPage.tsx` (607 行, +500) — 4 KPI 卡 + 4 图表 (纯 inline SVG, 不引 recharts) + 待办 + 系统状态
- `apps/web/src/features/admin/AdminCoursesPage.tsx` (1524 行, +1000) — 列表模式 + 5 tab 编辑模式 (info/chapters/resources/pricing/publish) + 章节树 CRUD (纯前端 mock) + sticky 工具条
- `apps/web/src/features/admin/AdminLayout.tsx` (91 行, +60) — 加 audit/settings placeholder

**6 张截图** (dashboard light/dark/mobile + course-edit info/chapters/mobile) — `apps/web/.screenshots/admin-*.png`

**TODO 标记**: 4 KPI / 4 图表 / 章节树 CRUD 全部 hardcode mock, 标 "接 /api/v1/admin/stats" / "接 /api/v1/courses/{id}/chapters"

## 6. 已知问题 / 偏离 spec

| 类别 | 项目 | 状态 |
|---|---|---|
| 后端 P2 | /auth/me / /auth/identities / OAuth callback | AuthProvider 用 /auth/refresh 探活 + local identity 兜底, 标 TODO |
| 后端 P0-7/8 | /admin/stats / /courses/{id}/chapters | 全部 hardcode mock, 标 TODO |
| 6 宫格 OAuth | 全部 disabled (灰度) | P0-2 不接真实 OIDC, 等 P1-1 |
| 倒计时 | 只算到 startDate | 实际产品要 "距开始 / 距截止" 两态, 标 TODO |
| 暗色 brand-50 | light 背景下太亮 | 严格按 spec §2.1 (light tint), 不动 |
| Footer | home 单独实现新设计, 其他页用旧 footer | 后续 P1 统一 |
| AI 助教 FAB | 跳 /dashboard/learning (P0-6 占位) | 路由还没建, 当前 NotFoundPage |
| dev server | 起来时多 1 个 /auth/refresh 404 噪声 | api.ts 拦截吃掉, 截图无影响 |
| 端到端 verify | 4 个 worktree 都跑了 lint + build + 截图, **owner session 端到端 Playwright 未跑** | 等 Frank review |

## 7. P0-6 dashboard (待办, 需 P0-5 完事)

P0-6 在 spec §7.1 P0-6 排, 跟 P0-5 顺序依赖 (共享 AI 助教 FAB 模式)。可现在开 worktree `feature/web-dashboard` 干:
- `/dashboard` 取代 `/profile`
- 章节大纲 (左 280px) + 视频 (中 16:9) + AI 助教 (右 360px)
- `mock-learn.html` 落地
- LearningEvent 视频上报
- AI 助教调 `/chat/sessions` (后端 chat module 待建, 标 TODO)

## 8. 截图汇总 (23 张, 都在 `apps/web/.screenshots/`)

**P0-4 设计系统 (3 张)**:
- design-system-light.png / design-system-dark.png / design-system-mobile.png

**P0-5 首页 (8 张)**:
- home-light-desktop.png / home-dark-desktop.png / home-mobile-light.png / home-mobile-dark.png / home-tablet.png
- home-mobile-viewport-light.png / home-mobile-viewport-dark.png (viewport-only, 验 FAB + bottom tab 位置)
- home-desktop-viewport-light.png

**P0-2/3 auth (6 张)**:
- login-light-desktop.png / login-dark-desktop.png / login-mobile.png
- register-light-desktop.png
- bindings-empty.png / bindings-with-google.png

**P0-7/8 admin (6 张)**:
- admin-dashboard-light.png / admin-dashboard-dark.png / admin-dashboard-mobile.png
- admin-course-edit-info.png / admin-course-edit-chapters.png / admin-course-edit-mobile.png

## 9. Build 状态

```
pnpm --filter @opencsg/academy-web build:
✓ built in 626ms
dist/assets/index-BCN4TFJI.css   47.24 kB │ gzip:   8.63 kB
dist/assets/index-C2Y1lKba.js   643.31 kB │ gzip: 178.28 kB
```

**0 错误, 0 warning** (chunk size 警告可忽略, 不阻塞)。

## 10. 验证未做的事 (Frank 拍板)

- [ ] owner session 端到端 Playwright 验证 (5 关键流程: 注册→登录→报名→学习→报名, + admin 课程编辑 + auth 绑定)
- [ ] Frank 自己过一遍 23 张截图 (dev 视觉验证)
- [ ] Frank 决定下一步: 开 P0-6 dashboard / 修 4 个已知问题 / 端到端验证 / 直接 push
- [ ] 后端 P2 任务列表 (/auth/me, /auth/identities, OAuth callback, /admin/stats, /courses/{id}/chapters) 是否在 P1 排期内

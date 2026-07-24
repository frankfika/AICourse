# Admin 后台 Audit 报告 (4 段 / 仅观察 + 缺口)

> **2026-07-24 更新**: P0 4 个 + P1 5 个 + P2 2 个 全部修复 (commit 待提交)
> 旧报告条目"AdminDegreesPage 没有 edit"等已过时; 完整新 audit 见 `admin-audit-2026-07-24.md`
> **本报告继续追踪未修的小项 / 暗色化一致性 / 暗色态细节**

## 1. CRUD 完整性 (历史缺口, 已修)

- ~~AdminDegreesPage 只 create + delete, 没有 edit~~ — 已修: 2026-07-24 `AdminDegreesPage.tsx:71-83` `startEdit` + `:93-99` `updateMutation` 完整支持
- ~~学位 ↔ 课程 关联完全断~~ — 已修: 学位侧 `AdminDegreesPage.tsx` 多选 + 顺序编辑 + 调 `/api/v1/degrees/:id/courses`; 课程侧 `DegreeMembershipSection` + 调 `/api/v1/courses/:id/degrees`
- ~~大模型 key 无 admin 配置~~ — 已修: 新增 `AiConfig` 表 + 14 tab "AI 模型" + AES-256-GCM 加密
- ~~router.tsx DEBUG console.log~~ — 已修: 注释保留, console 删除
- 删除无 confirm: Hackathons `:341`、Degrees `:218`、Badges `:360`、Enterprise `:129`、Settings `ListCrudTab:646`(用 `window.confirm`)、Courses list `:528` — 点一下就发 DELETE
- **只有 Users `:363` 和 Reviews `:223` 有正经 confirm modal**, 其余 5 页 create/edit/delete 全裸跑
- AdminSettings 13 tab 中: Tab1 Global 草稿"未持久化"(`:207-210`), Tab3 Enums 的"新增/编辑/删除"按钮全 `disabled`(`:482-535`), **9 个 ListCrudTab 是 placeholder 编辑模式**(`:677-810`, 点 Edit2 后行变 input 但 saveEdit 无 loading 态)

## 2. 交互一致性

- 编辑入口体验分裂: Users 走 Drawer(`:334-361`)、Courses 走 URL 跳转 `?tab=info&id=`(`:491`、`:521`)、Hackathons/Badges/Degrees 走 inline 上方表单(同文件 `:171-296`、`:158-304`、`:83-178`)、Settings 走 inline 行编辑(`:754-805`)
- "编辑"按钮命名/图标不一: Hackathons `Edit2`(`:338`)、Courses `Pencil`(`:525`)、Badges `Edit2`(`:357`)、Users **写"详情"**(`:320-323`, 不是编辑)
- 搜索/过滤/分页分布: Reviews+AuditLogs 有 search+filter+page(各自 20 条/页), Users 有 search 但无 page, Hackathons/Degrees/Badges/Courses/Enterprise 列表**既无搜索也无分页**(直接拉全表)
- API 失败通知分裂: Courses list 用 `alert()`(`:144/148/154/171/647/648`), Users/Settings 用 `showToast`, **Hackathons/Degrees/Enterprise/Badges/AuditLogs 的 mutation 全无 onError**(Hackathons `:78-104` 三个 mutation 都没有)

## 3. 暗色化一致性

- **4 个 admin 页面 0 个 `dark:` 类**: AdminDashboardPage / AdminDegreesPage / AdminReviewsPage / AdminAuditLogsPage — 整个文件硬写 `#171717`/`#666666`/`white`/`#A3A3A3`, 切暗色主题后全黑
- **侧栏 AdminLayout 也没暗色**: 顶标题 `:56`、nav 容器 `:61`、高亮态 `:70-73` 全部亮态写死
- 已加 dark 的页面 token 混用: AdminBadgesPage `:142` `dark:border-neutral-50 dark:border-neutral-50` 写了两遍; `dark:bg-neutral-800 dark:bg-neutral-800 dark:bg-neutral-800` 写三遍(AdminBadgesPage `:194/320/407/416/442/500/513/546`、AdminCoursesPage `:223/484/540`、AdminHackathonsPage `:315`); 但 Dashboard 还停留在 `bg-[#171717]`(`:50/172/210/263/351/438` 等十几处)
- 颜色 token 同一概念三套: 用 `bg-[#171717] text-white` 走硬编码 vs `dark:bg-neutral-800 dark:text-neutral-50` 走 token, 切暗色后 Dashboard 看到黑底黑字

## 4. 权限 + 错误 + 空态

- 权限 OK: `router.tsx:99-119` `/admin` 用 `<ProtectedRoute requireAdmin>`, role != admin/super_admin 一律 Navigate 到 `/`
- 空态: 11 页都有"暂无 X"占位(Dashboard `:478/562`、Hackathons `:352`、Courses `:540`、Degrees `:230`、Badges `:370`、Users `:329`、Enterprise `:198`、Reviews `:137`、AuditLogs `:146`、Settings `:305/352/702`)
- 错误态缺口大: Hackathons `:65`、Degrees `:30`、Enterprise `:28`、Badges `:57` — useQuery 都**没解构 isError, 没错误态**, 网络挂了页面空白
- mutation 错误缺口: Hackathons/Degrees/Enterprise/Badges 4 页的 create+update+delete **全无 onError**, 失败静默
- Courses list 模式 import 失败用 `alert()`(`:154/174`), 与 Users 的 toast 体系割裂
- Settings `ListCrudTab:646` 用原生 `window.confirm`, 与 Users `ConfirmDialog`(`:363`)组件不一致

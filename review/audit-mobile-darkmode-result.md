# 移动端 + 暗色模式 + 响应式 Audit

> 范围:`apps/web/src/`(Layout / DashboardLayout / CommandPalette / HomePage / CourseListPage / DashboardPage / AdminLayout / AdminDashboardPage / AdminUsersPage / AdminCoursesPage + tailwind.config.js + tokens.css)
> 只观察 + 描述缺口,每条带 `file:line`。

## 摘要
- 检查页面 / 文件:11
- 移动端 OK(响应式 + bottom tab + 触摸目标):3 / 11
- 暗色 OK(走 token 切换 + 持久化):5 / 11
- 触摸友好 OK(≥44px):4 / 11
- a11y OK(aria-label / role / focus):6 / 11

## P0(移动端用户立刻撞到)

### 问题 1:管理后台在 < md 没有"请用桌面"重定向
- 位置:`AdminLayout.tsx:54`(`<aside className="hidden md:block ...">`)+ `AdminLayout.tsx:60-90`(整个 admin 树)
- 现状:USER_MANUAL §17.4 (`docs/USER_MANUAL.md:649`) 明确写"管理后台不支持移动端,会自动重定向到「请用桌面访问」提示";**实际 AdminLayout.tsx 没有 redirect 逻辑,也没有 < md 的 fallback 提示**——admin 用户在 375px 打开 /admin/* 看到的是空 280px 折行版面 + main 内容单列撑满,左栏完全消失,导航只能依赖 Layout 的 bottom tab 回到首页。
- 用户故事:"运营经理在通勤地铁上用 iPhone 13 mini(375px)想审批黑客松作品,打开 /admin/hackathons 看到一片空白主区,侧栏导航全没了,以为自己误操作。"

### 问题 2:AdminCoursesPage 课程编辑器三栏布局在 < lg 直接断成单栏 + 两侧面板消失
- 位置:`AdminCoursesPage.tsx:1086`(`<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] ...">`)
- 现状:`AdminCoursesPage.tsx:1088` 左章节树 `hidden lg:flex` + `:1121` 右属性面板 `hidden lg:flex`;**移动端(375 / 768)只能看到中间"lesson 编辑表单",章节树和属性面板两边全消失**,无替代抽屉/tab。
- 用户故事:"内容运营在 iPad(1024)想改 lesson 1.3 标题,打开编辑器看不到章节树,要切到桌面才能切换章节。"

### 问题 3:Dashboard 移动端 tab 切换后底部完成按钮挡住内容 + AI tab 没有专属底栏
- 位置:`DashboardPage.tsx:1053-1068`(`md:hidden flex border-b` mobile tab)+ `:1136-1168`(tablet FAB + drawer)
- 现状:`DashboardPage.tsx:1066` mobile tab 切到"AI"时,中央是 `AiAssistant`(`:728-900`)h-full 聊天流;**底部完成按钮条(`:702-723`)在 mobile 仍然渲染在所有 mobile tab 之上**,AI tab 切到最后一条消息时完成按钮覆盖聊天输入区。
- 用户故事:"学员在通勤地铁用手机看 AI 助教回,滑动到最后,「标记完成」按钮一直压住聊天 input 顶部 8px,容易误点。"

### 问题 4:Layout 顶部 nav 在 < sm 缺搜索/通知/头像区
- 位置:`Layout.tsx:155-243`(顶部 nav 整段)
- 现状:`Layout.tsx:183`(`hidden sm:flex` 头像 Link)`:212`(`hidden sm:flex` 登录按钮)`:221`(md:hidden 搜索图标);**< sm(<640px)既没有搜索入口显示,也没有头像/登录按钮显示**,只剩 logo + theme toggle + hamburger。
- 用户故事:"未登录访客在 375px 打开首页,想登录,顶部 nav 看不到"登录"按钮,只能点汉堡菜单翻 4 项才能找到登录入口。"

## P1(暗色 / a11y / 触摸)

### 问题 5:admin 各页 `bg-white` 硬编 30+ 处,暗色下仍是纯白
- 位置:`AdminUsersPage.tsx:61,69,89,99`;`AdminHackathonsPage.tsx:168,275,363,371,397`;`AdminBadgesPage.tsx:127,218,266,319,328,354`;`AdminEnterprisePage.tsx:64,73,114`;`AdminCoursesPage.tsx:257,271,309,339,375,389,401,473,1506,1514`
- 现状:整段 admin 走"瑞士国际主义"风格用 hex 硬编(`#FFFFFF / #171717 / #EEEDE9`),**完全没有 `dark:` 变体**;`AdminDashboardPage.tsx:466-510` 4 张 KPI 卡 4 张图表 token 是对的,但表格/表单/弹窗全在 `bg-white` 上,暗色下是白底黑字 + 旁边 token 化卡片,视觉撕裂。
- 用户故事:"admin 在晚上切到暗色,审核用户表格 / 创建黑客松表单 / 改徽章 — 全部仍是白底,只有顶部 KPI 卡变暗,非常刺眼。"

### 问题 6:`CourseListPage` mobile 筛选面板"展开后直接撑爆视口"无 sheet/modal 容器
- 位置:`CourseListPage.tsx:316-326`
- 现状:`<aside className={cn('space-y-6', 'lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2', mobileFiltersOpen ? 'block' : 'hidden lg:block')}>`;**mobile 展开时是 in-line 撑开 7 个 FilterSection(分类/难度/时长/收费/标签/讲师/评分)+ 清除按钮 = ~600px 高**,把课程列表完全推到屏幕外;无遮罩 + 无关闭按钮,只能再点"筛选 N"收起。
- 用户故事:"用户在 375px 想筛"RAG 标签 + 4 小时以内",点开筛选后页面被推下去,看完筛选条件要点回课程列表,得手动滚回去。"

### 问题 7:`DashboardLayout` 主题切换与 `Layout` 主题切换是**两套独立 useState**
- 位置:`DashboardLayout.tsx:29-50`(`useDashboardTheme` inline 复刻)+ `Layout.tsx:27-50`(`useTheme`)+ `AdminDashboardPage.tsx:427-446`(`isDark` 又一份)
- 现状:**3 份独立 useState,共享同一个 `<html class="dark">` + localStorage('theme')**,但 React 端互不感知;admin 页面点"深色"按钮时 `isDark` state 跟 `Layout` 顶栏的 theme state 不一致 — Layout 顶栏的 Sun/Moon icon 跟 admin 自己的 Sun/Moon icon 会**显示相反**(一个以为自己是 dark 一个以为自己是 light)。
- 用户故事:"admin 在 /admin/dashboard 顶部点"深色"按钮,自己页面切到暗色,但返回 /dashboard/learning 时 Layout 顶栏的 Sun/Moon icon 不刷新,显示是 light,但页面是 dark。"

### 问题 8:`BottomTabLink` 单 item 高度 ~36px,达不到 iOS HIG 44×44
- 位置:`Layout.tsx:404-427`
- 现状:`<Link className="flex flex-col items-center gap-0.5 py-1 ...">` + `Icon className="w-5 h-5"` (20px) + `text-[10px]`(10px line) + gap-0.5 (2px) = **约 36px 高**;5 宫格在 iPhone 13 mini 容易误触隔壁 tab。
- 现状:同时 `Layout.tsx:204` 头像 p-2 + w-5 h-5 icon = **约 36px**,也没到 44px;`Layout.tsx:231` theme toggle p-2 同样 ~36px。

### 问题 9:`CommandPalette` mobile 全屏 modal 后,顶部 input 跟 iOS 状态栏/虚拟键盘冲突
- 位置:`CommandPalette.tsx:188-199`
- 现状:`<div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[12vh] px-4">` + 弹层 `h-[100dvh] sm:h-auto`;**mobile 弹层是 100dvh 但没设 `pt-[env(safe-area-inset-top)]`**,iPhone 14 Pro 刘海机型顶部 input 可能被状态栏盖住;**input 没有 `inputMode="search"` 也不防 iOS 键盘自动首字母大写**。
- 用户故事:"iPhone 14 Pro 用户 ⌘K 不行(没键盘),用搜索图标打开 CommandPalette,顶部 input 圆角被刘海切掉一截。"

### 问题 10:`AdminDashboardPage` 主题按钮 aria-label 跟内容不一致
- 位置:`AdminDashboardPage.tsx:480-486`
- 现状:按钮 `aria-label="切换主题"` 但 `leftIcon` + 内容 `{isDark ? '浅色' : '深色'}` 已经把"目标态"显式给出来了,**屏幕阅读器读 "切换主题 浅色",比 Layout 顶栏(`Layout.tsx:227-228` `aria-label={theme === 'dark' ? '切换为亮色' : '切换为暗色'}`)粗糙**。
- 现状:同时 `DashboardLayout.tsx:117-124` 通知/订单 icon-only Link 有 `aria-label`,但 `DashboardLayout.tsx:91-96` "返回课程" 文字 Link `<span className="hidden sm:inline">返回课程</span>` 在 < sm 只剩箭头,**没有 aria-label 兜底**。

## 不一致点

- **3 份独立 theme state**(`Layout.tsx:27`, `DashboardLayout.tsx:29`, `AdminDashboardPage.tsx:427`)操作同一个 `localStorage('theme')`,state 不会跨页同步,出现 icon 显示跟实际 class 相反。
- **admin 全站 `bg-white` + hex 硬编 30+ 处**(`AdminUsersPage.tsx:61`、`AdminHackathonsPage.tsx:168`、`AdminBadgesPage.tsx:127`、`AdminEnterprisePage.tsx:64`、`AdminCoursesPage.tsx:257` 等),跟 token 化卡片(`AdminDashboardPage.tsx:472-548`)混排,暗色下视觉撕裂。
- **mobile 触摸目标普遍 < 44px**:`Layout.tsx:404` bottom tab item ~36px,`Layout.tsx:195,203,231` 顶栏 icon 按钮 ~36px,`DashboardLayout.tsx:98,107,117` icon-only Link `p-2` 32-36px。
- **mobile 输入框字号 < 16px**:`CourseListPage.tsx:90` search input `size="lg"` 默认 text-base 16px ✓;但 `AdminUsersPage.tsx:61,89` admin 搜索/授权 input 是 `text-sm` (14px),iOS Safari 会自动放大页面。
- **mobile 时 AdminLayout 不重定向**(对照 USER_MANUAL §17.4 `docs/USER_MANUAL.md:649`)。
- **mobile 字号 vs 16px**:`HomePage.tsx:96,101` hero stats `text-2xl md:text-3xl` 起步 24px ✓;`AdminUsersPage.tsx:107` table 行内 `text-[10px]` 极小,在 < sm 折叠后单列堆叠时更显小。
- **focus ring**:`AdminUsersPage.tsx:61,89,99,253,307` 等 5+ 处 `focus:outline-none`,没有自定义 `focus-visible:ring-*` 兜底 — 键盘用户 tab 进 input 看不到焦点。

## 附录:按断点的不一致矩阵

| 页面 | < sm | sm-md | md-lg | lg+ | 暗色 | a11y |
|------|------|-------|-------|-----|------|------|
| `/` HomePage | ✓(8 段响应式 OK) | ✓ | ✓ | ✓ | ✓(token 全) | - |
| `/courses` CourseListPage | ✗(筛选撑爆) | △ | △ | ✓ | ✓ | - |
| `/admin` AdminLayout | ✗(无重定向) | ✗ | ✓ | ✓ | ✗(bg-white 30+) | - |
| `/admin/dashboard` AdminDashboardPage | △(KPI 2x2) | ✓ | ✓ | ✓ | △(KPI token, 表格 hex) | - |
| `/admin/courses` AdminCoursesPage | ✗(三栏断成单栏) | ✗ | ✗ | ✓ | ✗ | - |
| `/admin/users` AdminUsersPage | △(表格 → 单列) | △ | ✓ | ✓ | ✗(全 bg-white) | ✗(无 focus ring) |
| `/admin/hackathons` AdminHackathonsPage | △ | △ | ✓ | ✓ | ✗(全 bg-white) | ✗(无 focus ring) |
| `/admin/badges` AdminBadgesPage | △ | △ | ✓ | ✓ | ✗(全 bg-white) | ✗(无 focus ring) |
| `/admin/enterprise` AdminEnterprisePage | △ | △ | ✓ | ✓ | ✗(bg-white) | ✗(无 focus ring) |
| `/dashboard/learning` DashboardPage | △(3 tab 完整) | △(FAB 抽屉) | ✓ | ✓ | ✓(token) | △(icon-only 无 label) |
| `CommandPalette` (⌘K) | △(刘海/键盘) | ✓ | ✓ | ✓ | ✓(token) | ✓(role=dialog + aria-modal) |

DONE: [3 pages mobile-OK, 5 dark-OK, 6 a11y-OK, total gaps: 10]

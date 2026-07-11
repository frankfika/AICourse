# AICourse Web 前台 UX / 信息架构 audit(长版 / 附录)

> 这是 `audit-web-ux.md` 的长版附录(精简版控制在 800 中文字内,本文件是完整 evidence)。每条带 `file:line`。

## 1. 路由与信息架构现状

路由树(`apps/web/src/router.tsx:31-67`)扁平:Layout 下 8 个页面 + admin 子树 7 个,顶层还只有 `/login` 和 `*`。**没找到的入口**:`/search`、`/orders`、`/cart`、`/notifications`、`/certificates`、`/learn`(我的学习)、`/practices`(我的实践)、`/instructors/:id`(讲师主页)、`/community`、`/settings`、`/messages`。

**权限边界**(`router.tsx:24-29`)只两层:未登录 / 已登录 / admin。**已登录用户没有任何"非 admin 也进不去"的中间路由**——例如成绩页、企业订单管理、证书库都没有专属用户区。`ordersApi.ts` 有 myOrders 但前端没有页面承接(`lib/ordersApi.ts:9`)。

**主导航**(`components/Layout.tsx:12-17`)只 4 项:**课程 / 学位 / 黑客松 / 企业培训**。**没有"我的学习 / 社区 / 通知"**;admin 入口藏在头像旁边(`Layout.tsx:59-67`),头像点击直达 `/profile`,没有 dropdown。

**首页**(`features/home/HomePage.tsx:58-342`)是 4 段堆叠(hero + degrees + free courses + enterprise CTA),**没有 0→1 的全站搜索框、没有分类入口、没有推荐算法入口、没有学员见证**;"10K+ / 50+ / 12" 三个数字是硬编码字面量(`HomePage.tsx:103-107`)。

**学习中心**:不存在。Profile 页面堆了 5 块(stats/level/activity/课程进度/徽章墙)但**没有 tab 切换、没有"我的订单 / 我的证书 / 我的实践"分组**(`features/profile/ProfilePage.tsx:89-284`)。

**学位路径**(`features/degrees/DegreeDetailPage.tsx:173-264`)按 step 列了课,但**没有显示"我已学完几门 / 当前在哪一步 / 解锁条件"**;证书只在 footer 文案"完成所有课程后将获得……",**没有"我的证书"页面**(`DegreeDetailPage.tsx:248-262`)。

**AI 助教**:**全前台没有学生侧入口**。`lib/aiApi.ts` 全部 45 行只暴露 `generateCourse / generateDegree`,都喂给 admin 后台(`components/AiGeneratePanel.tsx` 在 admin 页用);Layout 没有任何 FAB / 浮窗 / chat 入口。

## 2. 用户故事 gap

1. **新访客**想"先看 1 分钟再决定买不买",**实际在课程详情页找不到"试看"按钮**——`isPreview` 字段在 `CourseDetailPage.tsx:445` 存在但**没有任何条件渲染让 preview lesson 提前可见**,所有未报名用户都被锁屏(`CourseDetailPage.tsx:391-413`)。
2. **学生**想"看下其他学员评价再选课",**实际课程详情页完全没有评分 / 评论 / Q&A 入口**——`CourseDetailPage.tsx` 全 605 行无 `Rating` / `Review` 字段。
3. **学生**想"按难度 / 标签 / 时长筛课",**实际只能按收费类型筛**——`CourseListPage.tsx:40-45` 只有 all/free/paid/charity,**无 level / tags / 时长筛选、无排序、无分页**(`HomePage.tsx:56` filter 也没这俩维度)。
4. **报名后**想"接着上次学到一半的课",**实际必须先退出当前课、再去首页或列表找**——`ProfilePage.tsx:210-249` 列了所有 in-progress 课程,但**没有"继续学习"快捷入口**;课程详情页 tabs 也不持久,刷新就回到 overview。
5. **学生**想"找讲 LLM 实战的好讲师",**实际讲师只是字符串字段**——`CourseDetailPage.tsx:292` 只显示 `讲师 / {name}`,**无讲师详情页、无讲师课程列表**;`router.tsx:1-67` 也没有 `/instructors/:id`。
6. **学生**想"在课程里问 AI 助教某个公式",**实际没有任何 AI chat 入口**——`Layout.tsx` 整文件 167 行 0 处 AI / chat / 助教 引用,`CourseDetailPage.tsx` 视频 tab 旁边也没有 sidebar chat。
7. **企业 HR**想"看我们公司之前提交过的咨询",**实际只有首次填表 + 成功页**——`EnterprisePage.tsx:42-394` 是单页长表单,没有"我的咨询历史"路由。
8. **管理员**想"用 AI 帮新讲师自动起草一门课",**实际 AI 面板在两个地方分别展开**——`AdminCoursesPage` 和 `AdminDegreesPage` 都 import `AiGeneratePanel` 但**不共享,生成的草稿预览结构硬编码于 `AiGeneratePanel.tsx:115-140`**,改预览样式需改两处文件。
9. **移动端用户**想"在地铁上点首页 → 进课详情 → 看视频",**实际移动端没有 tab bar**——`Layout.tsx:84-89` 只有汉堡菜单,折叠后导航只显示 4 项主入口,**无 bottom navigation,无"我的学习"快捷**,`hidden md:flex` / `hidden sm:inline` 类散落但没形成完整 mobile IA。
10. **404 访问者**进入坏链,**实际只能"回首页 / 去看课程"**——`features/misc/NotFoundPage.tsx:25-41` 两个固定 CTA,**没有"返回上一页"按钮、没有搜索框、没有推荐课程**。

## 3. 重复信息 / 视觉断点 / 卡住场景

- **死代码**:`features/courses/CoursePracticesTab.tsx` 303 行完整实现了实践项目(start/complete/skip/submission url),**`grep -r "CoursePracticesTab" src` 全仓 1 处命中,就是它自己**;`router.tsx` 和 `CourseDetailPage.tsx` 都没有 import,导致**实践项目对学生不可见**。
- **视频学习断点**:`CourseDetailPage.tsx:414-422` 直接 `<iframe src={videoUrl} />`,**无内嵌 player、无倍速、无字幕、无全屏切换检测、无心跳上报**;`completeLessonMutation` 完全靠"标记完成"按钮手点(`CourseDetailPage.tsx:472-482`)。
- **重复 toast 体系**:`CourseDetailPage.tsx:70-74` 写了一份本地 `Toast` 组件 + 580-592 行手写弹窗,`PurchaseModal.tsx:155` 又写一份 `Loader2`,**全站没有统一 Toast / Modal / EmptyState / ErrorState 抽象**——`features/common/` 目录**是空的**。
- **同一含义三种命名**:"报名 / 报名后学习 / 已报名"散落在 `CourseDetailPage.tsx:269-289`、`DegreeDetailPage.tsx:124-142`、`RegistrationButton.tsx:36-50`,**没有用统一 `<EnrollButton>` 抽象**;每处都自己判 `enrolled / costType / user`。
- **筛选条件全站不一致**:Hackathon 列表有 5 个状态 tab(`HackathonListPage.tsx:10-16`),Course 列表只有 4 个收费 tab(`CourseListPage.tsx:40-45`),Degree 列表**完全没筛选**(`DegreeListPage.tsx:7-130`)。
- **空状态自由发挥**:`CourseListPage.tsx:162-167`、`HackathonListPage.tsx:104-117`、`CoursePracticesTab.tsx:112-119`、`SubmissionPanel.tsx:253-259`、`TeamPanel.tsx:185-191` 都各自写一个居中"暂无 / 没有 / 快来创建"的 div,**没有共享 `<EmptyState>` 组件**。
- **hooks 目录是空的**:`apps/web/src/hooks/` 文件夹存在但 0 文件,`profile` / `home` / 视频进度都没抽 hook,所有数据获取直接 inline 在 page 里(每个 page 4-6 个 useQuery,见 `ProfilePage.tsx:27-67`)。
- **空装**:`package.json:14-22` 装了 `react-hook-form@7.54` + `zod@3.24`,**`grep -r "react-hook-form\|zod" src` 全仓 0 命中**——所有表单用裸 `useState` + 手写 onChange。
- **刷新即丢**:视频里手动点"标记完成"的状态在 `CourseDetailPage.tsx:134-138` 是从 `myProgress` 拉,但**页内 activeLesson(activeTab)只在 useState 里**,刷新后默认回到 overview tab。
- **移动端 header 缺项**:`Layout.tsx:84-89` 折叠菜单只有 4 项主入口,**折叠后看不到"我的学习 / 通知 / 设置"**。

## 4. 缺失的关键能力

- **没有全站搜索 / Command-K**:`grep` 只有 3 处列表内搜索。
- **没有 AI 助教(学生侧)**:`aiApi.ts` 仅 admin 草稿生成,**全前台 0 个 chat 入口、0 个 FAB**。
- **没有通知中心**:`grep "notification\|bell" 0 命中`,`Layout.tsx` 头像旁无铃铛。
- **没有"我的订单/证书/练习/参赛"页**:四个 feature 后端 API 都有,前端无承接。
- **没有讲师主页**:`router.tsx` 无 `/instructors/:id`,讲师是字符串字段。
- **没有 403/500/网络错误页**:`features/misc/NotFoundPage.tsx` 只有 404;`api.ts:46-50` 401 自动跳 login,**无 403 区分、无 500 fallback、无 offline banner**。
- **没有暗色模式**:`grep "dark\|prefers-color-scheme" 0 命中`;`tailwind.config` 也未启用 dark 模式;`#171717 / #F5F4F0` 硬编码色遍布全站。
- **没有国际化**:`grep "useTranslation\|i18n" 0 命中`;同一文案中英混杂。
- **没有可访问性**:`grep "aria-\|role=" 0 命中`;`<button>` / `<input>` 无 label 关联,`<img>` 仅 alt,**无键盘焦点环、无 skip-link**。
- **没有 skeleton**:`grep "Skeleton" 0 命中`,所有 loading 用文字"加载中..." + `Loader2` 图标。
- **没有空状态/全局错误边界**:`features/common/` 目录为空,`grep "ErrorBoundary" 0 命中`,组件抛错整页白屏。
- **没有页面 SEO meta**:`grep "<title>\|Helmet" 0 命中`,`index.html` 无 OG/description。
- **`router.tsx:24-29` `ProtectedRoute` 缺加载态**:登录态从 localStorage hydrate 之前 `user` 是 null,会闪一下跳 `/login`。
- **企业咨询提交后无追踪**:`EnterprisePage.tsx:271-286` 成功页只有"再次提交"。

## 附录:读过的文件清单

| 类别 | 文件 |
|---|---|
| 入口 | `router.tsx` |
| 公共组件 | `components/Layout.tsx`、`ProgressRing.tsx`、`BadgeCard.tsx`、`LevelBadge.tsx`、`ActivityHeatmap.tsx`、`AiGeneratePanel.tsx`、`TiltCard.tsx` |
| 状态 / API | `stores/authStore.ts`、`lib/api.ts`、`lib/aiApi.ts`、`lib/progressApi.ts`、`lib/pointsApi.ts`、`lib/badgesApi.ts`、`lib/ordersApi.ts`、`lib/hackathonsApi.ts`、`lib/practicesApi.ts`、`lib/queryClient.ts`、`lib/aiApi.test.ts` |
| feature 页面 | `features/home/HomePage.tsx`、`features/courses/CourseListPage.tsx`、`features/courses/CourseDetailPage.tsx`、`features/courses/CoursePracticesTab.tsx`、`features/degrees/DegreeListPage.tsx`、`features/degrees/DegreeDetailPage.tsx`、`features/degrees/PurchaseModal.tsx`、`features/hackathons/HackathonListPage.tsx`、`features/hackathons/HackathonDetailPage.tsx`、`features/hackathons/HackathonCard.tsx`、`features/hackathons/HackathonStatusBadge.tsx`、`features/hackathons/RegistrationButton.tsx`、`features/hackathons/AnnouncementList.tsx`、`features/hackathons/TeamPanel.tsx`、`features/hackathons/SubmissionPanel.tsx`、`features/auth/LoginPage.tsx`、`features/profile/ProfilePage.tsx`、`features/enterprise/EnterprisePage.tsx`、`features/misc/NotFoundPage.tsx`、`features/admin/AdminLayout.tsx` |
| 依赖声明 | `apps/web/package.json` |

**用过的命令**:
- `ls apps/web/src{,/features,/components,/lib,/stores,/hooks}`
- `cat router.tsx | Layout.tsx | ...`
- `grep -rn "CoursePracticesTab" src` ← 1 命中(自己)
- `grep -rn "aiApi\|AiAssistant\|AI 助教\|助教" src` ← 只 admin 命中
- `grep -rn "useTranslation\|i18n\|locale\|language" src` ← 0
- `grep -rn "aria-\|role=" src` ← 0
- `grep -rn "dark\|prefers-color-scheme\|theme" src` ← 0
- `grep -rn "ErrorBoundary" src` ← 0
- `grep -rn "skeleton\|Skeleton" src` ← 0
- `grep -rn "全局搜索\|GlobalSearch\|CommandPalette" src` ← 0
- `grep -rn "react-hook-form\|zod" src` ← 0
- `ls apps/web/src/hooks` ← 空目录

**未读**:admin/* 内部各 CRUD 页(AdminDashboard/Courses/Degrees/Users/Badges/Hackathons/Enterprise) —— 范围在前台 UX,不是 admin 体验。

# AICourse Web 前台 UX / 信息架构 audit

> 范围:`apps/web/src/`。只观察 + 描述缺口,不写"建议 / 应该"。每条带 `file:line`。

## 1. 路由与信息架构现状

路由树(`router.tsx:31-67`)扁平 8 页 + admin 子树 7,**没找到的入口**:`/search`、`/orders`、`/cart`、`/notifications`、`/certificates`、`/learn`、`/practices`、`/instructors/:id`、`/community`、`/settings`。权限(`router.tsx:24-29`)只三层:游客 / 登录 / admin,**无"已登录非 admin"的中间区**——订单/证书/通知都无页面,API 已有(`ordersApi.ts:9`)。主导航(`Layout.tsx:12-17`)只 4 项:**无"我的学习/社区/通知"**;admin 入口藏头像旁(`Layout.tsx:59`),无 dropdown。首页(`HomePage.tsx:58-342`)4 段堆叠,**无全站搜索、无分类、无推荐**;"10K+ / 50+ / 12" 硬编码(`HomePage.tsx:103-107`)。学习中心不存在:Profile 堆 5 块,**无 tab、无"订单/证书/实践"分组**(`ProfilePage.tsx:89-284`)。学位(`DegreeDetailPage.tsx:173-264`)按 step 列课,**无"已学几门/在哪一步"**;证书仅 footer 文案("完成所有课程后获得……",`DegreeDetailPage.tsx:248-262`),**无"我的证书"页**。AI 助教:**全前台无学生入口**;`lib/aiApi.ts` 仅 admin 用 `generateCourse/Degree`,Layout 无 FAB/浮窗/chat。

## 2. 用户故事 gap

1. 新客想"先试看 1 分钟",**实际找不到试看按钮**——`isPreview` 在 `CourseDetailPage.tsx:445` 存在但**无任何条件渲染**,未报名即全锁屏(`CourseDetailPage.tsx:391-413`)。
2. 学生想"看其他学员评价",**实际无评分/评论/Q&A**——`CourseDetailPage.tsx` 605 行 0 处。
3. 学生想"按难度/标签/时长筛课",**实际只按收费类型筛**——`CourseListPage.tsx:40-45` 仅 all/free/paid/charity,**无 level/tags/时长/排序/分页**。
4. 报名后想"接着学",**实际无"继续学习"入口**——`ProfilePage.tsx:210-249` 列 in-progress 但**首页/列表不可见**;tabs 不持久,刷新回 overview。
5. 想"找讲师",**实际讲师仅字符串**——`CourseDetailPage.tsx:292` 只显名字,`router.tsx` 无 `/instructors/:id`。
6. 想"问 AI 助教",**实际 0 chat 入口**——`Layout.tsx` 167 行 0 AI/chat,视频 tab 旁无 sidebar。
7. 企业 HR 想"看历史咨询",**实际只有首次表单**——`EnterprisePage.tsx:42-394` 单页长表单,无"我的咨询"页。
8. 管理员想"用 AI 起草",**实际 AI 面板两处独立**——`AdminCoursesPage` 与 `AdminDegreesPage` 各 import `AiGeneratePanel`,**预览结构硬编码**(`AiGeneratePanel.tsx:115-140`)。
9. 移动端想"首页→课详情→视频",**实际无 bottom tab bar**——`Layout.tsx:84-89` 仅汉堡,折叠后只 4 主入口,无"我的学习"快捷。
10. 404 想"返回上一页",**实际只能"回首页/去看课程"**——`NotFoundPage.tsx:25-41` 两固定 CTA,无"上一页"。

## 3. 重复信息 / 视觉断点 / 卡住场景

- **死代码**:`CoursePracticesTab.tsx` 303 行完整实现,**`grep -r "CoursePracticesTab" src` 仅它自己 1 命中**;`router.tsx` 和 `CourseDetailPage.tsx` 都不 import,**实践项目对学生不可见**。
- 视频断点:`CourseDetailPage.tsx:414-422` 直接 `<iframe>`,**无 player/倍速/字幕/上报**;`completeLessonMutation` 完全靠手点"标记完成"(`CourseDetailPage.tsx:472-482`)。
- 重复 toast:`CourseDetailPage.tsx:70-74` 本地 Toast + 580-592 手写弹窗;`features/common/` **目录为空,无共享组件**。
- 同一含义三命名:"报名/已报名"散落 `CourseDetailPage.tsx:269-289`、`DegreeDetailPage.tsx:124-142`、`RegistrationButton.tsx:36-50`,**无统一 `<EnrollButton>`**。
- 筛选全站不一致:Hackathon 5 状态 tab(`HackathonListPage.tsx:10-16`),Course 4 收费 tab,**Degree 完全无筛选**(`DegreeListPage.tsx:7-130`)。
- 空状态每页自由写,**无共享 `<EmptyState>`**。
- **`apps/web/src/hooks/` 文件夹 0 文件**,所有数据 inline 在 page(`ProfilePage.tsx:27-67` 6 个 useQuery)。
- **空装**:`package.json` 装 `react-hook-form@7.54` + `zod@3.24`,**全仓 0 命中**——所有表单裸 `useState`。
- `ProtectedRoute`(`router.tsx:24-29`)从 localStorage hydrate 前 `user=null`,**闪一下跳 /login**。

## 4. 缺失的关键能力

- **无全站搜索 / Command-K**(`grep` 仅 3 处列表内搜索)
- **无 AI 助教学生侧**(`aiApi.ts` 0 chat 方法,Layout 0 FAB)
- **无通知中心**(`grep "notification\|bell" 0 命中`)
- **无"我的订单/证书/练习/参赛"页**(`ordersApi/practicesApi` 后端有,前端无承接)
- **无讲师主页**(`router.tsx` 无 `/instructors/:id`)
- **无 403/500/网络错误页**(`NotFoundPage` 只 404;`api.ts:46-50` 401 跳 login,**无 403/offline banner**)
- **无暗色模式**(`grep "dark" 0 命中`,`#171717/#F5F4F0` 硬编码全站)
- **无国际化**(`grep "useTranslation\|i18n" 0 命中`;同页中英混杂,如 `HomePage.tsx:88 "Browse All Courses"` vs `:134 "Nano Degrees"`)
- **无可访问性**(`grep "aria-\|role=" 0 命中`;无 label 关联/焦点环/skip-link)
- **无 skeleton / ErrorBoundary / SEO meta**(`grep` 三项 0 命中)
- 企业咨询提交后**无追踪**(`EnterprisePage.tsx:271-286` 成功页只"再次提交")

---

**附录**:读了 24 个文件,`grep` 8 次。完整文件清单 + 命令在 `review/audit-web-ux-long.md`(本文件为 < 800 中文字精简版)。

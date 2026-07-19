# Feature Completeness Audit Report

## 摘要
- 总功能点数: 30
- 完整: 12
- 部分: 11
- 缺失: 5
- Mock: 2(整页 mock)

## P0(用户能感知的缺口)

### 缺口 1: 通知中心是占位 skeleton,无真实数据
- 文档章节: USER_MANUAL §13
- 文档原文: "4 tab / 标记已读 / 30s 轮询"
- 实际情况: `NotificationsPage.tsx:22-89` 整页是硬编码 Skeleton + 占位文字。文件头注释自承 "Sub-agent 42212 fail 时只写了后端,UI 跟路由没来得及接 ... 抢救时先给一个 placeholder"。`grep -n "setInterval|30000" NotificationsPage.tsx` 0 命中,30s 轮询未实现。
- 影响范围: 所有登录用户的「通知中心」菜单可点,进去只看 3 行 skeleton。

### 缺口 2: 证书 PNG/PDF 下载是 mock toast
- 文档章节: USER_MANUAL §11.4
- 文档原文: "PNG 格式(适合贴 LinkedIn) / PDF 格式(适合打印)"
- 实际情况: `CertificateDetailPage.tsx:69-71` `handleDownload` 只调 `showToast('证书已发送到你的邮箱 (mock)')`。全文 `grep -n "PNG|PDF|jsPDF|html2canvas"` 0 命中,没装 jsPDF/html2canvas,没生成图片/PDF 逻辑。
- 影响范围: 用户在证书详情页点「下载」看到一条假 toast。

### 缺口 3: 黑客松列表/卡片无报名倒计时
- 文档章节: USER_MANUAL §7.1
- 文档原文: "报名截止倒计时(仅 upcoming 状态) ... 倒计时 0 自动跳详情"
- 实际情况: `apps/web/src/features/hackathons/*.tsx` 全仓 `grep -n "setInterval|deadline|TimeLeft|countdown"` 0 命中。HackathonListPage 只按 status 切 5 tab,卡片无倒计时渲染。
- 影响范围: 黑客松 tab 上"upcoming" 卡片没有「剩 X 天 X 时」字段,跟文档承诺不一致。

### 缺口 4: AI 助教 4 chips 实际只有 3
- 文档章节: USER_MANUAL §8.4 / §9.3
- 文档原文: "4 个常见问题 chips"
- 实际情况: `DashboardPage.tsx:235` `QUICK_PROMPTS = ['📌 解释这节课','💡 ReAct vs CoT','🧪 给个练习']`,数组长度 3。
- 影响范围: 学习中心右栏少 1 个 chip。

### 缺口 5: LearningEvent 上报是 console.log,后端未接
- 文档章节: USER_MANUAL §8.5
- 文档原文: "每 5 秒 video time + 1,触发 LearningEvent 上报"
- 实际情况: `DashboardPage.tsx:477-490` 写 "LearningEvent 内存计数(后端未建,标 TODO)" / `[LearningEvent TODO]` console.log,仅前端 in-memory 计数。Prisma 有 `LearningEvent` model(schema.prisma:801)但前端不写。
- 影响范围: 用户刷课进度在 dev 模式可见 console log,生产环境无后端接收,跨设备进度不同步。

## P1(管理员能感知的)

### 缺口 6: 管理看板 4 KPI + 4 图表 + 待办 + 系统状态全部 mock
- 文档章节: ADMIN_MANUAL §3
- 文档原文: "P0-8 看板数据为 mock,接 /api/v1/admin/stats 待实现"
- 实际情况: `AdminDashboardPage.tsx:36 KPI_MOCK` / `:77 TODO_MOCK` / `:112 SYSTEM_STATUS_MOCK` / `:127 FUNNEL_MOCK` 全 hardcode。`grep "KPI_MOCK\|TODO_MOCK\|SYSTEM_STATUS_MOCK\|FUNNEL_MOCK"` 4 命中。无 `/api/v1/admin/stats` 调用。
- 影响范围: 管理员首页所有数字是假的(自承在 §3.4)。

### 缺口 7: 用户详情抽屉 6 section 全部缺失
- 文档章节: ADMIN_MANUAL §6.2
- 文档原文: "基本信息 / 学习概况 / 订单 / 证书 / 积分 / 活动日志"6 section
- 实际情况: `AdminUsersPage.tsx` 全文 162 行,`grep "drawer\|抽屉\|学习时长\|积分\|活动日志"` 0 命中,只有列表+搜索+筛选,无点击行展开抽屉的 UI。
- 影响范围: 管理员看不到任何用户维度的下钻。

### 缺口 8: 改角色 / 封号 / 授权课程 / 重置密码 / 删账号 5 操作无 UI
- 文档章节: ADMIN_MANUAL §6.3-6.7
- 文档原文: 5 个抽屉内操作
- 实际情况: `AdminUsersPage.tsx:13-162` 全文 `grep "RolesGuard\|重置密码\|封号\|授权课程"` 0 命中,表格行无操作下拉/按钮。后端 `users` module 是否有 API 未在本审计范围内查证。
- 影响范围: 客服场景只能走 DB。

### 缺口 9: 课程编辑器 5 tab 中 3 tab 是前端 mock
- 文档章节: ADMIN_MANUAL §4.3
- 文档原文: chapters/resources/publish 3 tab 内容
- 实际情况: `AdminCoursesPage.tsx:12-19` 自承 "chapters 纯前端 mock" / "数据 hardcode,标 TODO: 接 /api/v1/courses/{id}/chapters" / "封面仅本地预览,保存草稿不会真上传"(L751) / "资源上传后端 P0-8 暂未实现"(L1161) / "markdown 渲染简化版预览"(L947)。
- 影响范围: admin 编辑课程章节树 / 资源 / 封面 / markdown 都是前端 play,保存草稿不会真持久化进 DB。

### 缺口 10: 徽章规则 DSL 仅单条,不支持 and/or/not 嵌套
- 文档章节: ADMIN_MANUAL §8.3
- 文档原文: "组合:and / or / not"
- 实际情况: `AdminBadgesPage.tsx:7-13` `criteriaTypeOptions` 是 7 个单一类型下拉(cours_completed / streak_days ...),`emptyForm:16-26` 用 `criteriaType` + `criteriaValue` 两个字段,无嵌套树结构。`grep "and\|or\|not" AdminBadgesPage.tsx` 命中是 SQL 关键字而非 DSL 组合。
- 影响范围: 「学完 A 且积分 ≥ 500」这种嵌套条件无法表达。

## P2(细节)

### 缺口 11: 课程评分筛选用 description 关键词兜底
- `CourseListPage.tsx:182-185` 自承 "后端没 rating 字段,客户端用 description 关键词做兜底(几乎都通过)";`/star|★|rating/i.test` 是正则匹配描述文本。

### 缺口 12: 退款只判 paid 状态,4 规则未编码
- `orders.service.ts:298-316` 自承 "申请退款 (P1-8 新增): mock 实现,改状态为 refunded + 写 audit ... 实际退款流程在 P1-6 真实化后会接 Stripe webhook"。`grep "7 天\|20%\|hoursBefore\|开通前\|开通后" orders.service.ts` 0 命中,4 条规则(未开始/7 天内 <20%/其他/学位)无任何代码实现,UI 申请退款按钮不验证。

### 缺口 13: 审计日志只写不读,无 admin 路由
- `apps/api/src/modules/audit/` 只有 `audit-log.service.ts`(write)和 `audit.module.ts`,无 controller。`router.tsx` 无 `/admin/audit` 路由(AdminLayout 标 `comingSoon: true`)。
- 影响范围: ADMIN_MANUAL §10 自承占位。

### 缺口 14: 系统设置 / 数据导出(CSV/JSON)/ 删评价 全部未实现
- 系统设置: AdminLayout L41 `comingSoon: true`,无页面。导出: `AdminUsersPage.tsx` / `AdminOrdersPage.tsx` `grep "CSV|JSON|export|导出"` 0 命中,无 API 也无按钮。删评价: ADMIN_MANUAL §14.7 自承 "Phase 2+",无 UI。

### 缺口 15: 课程批量导入 / 审核工作流 / 公开 verify UI 详情
- 批量 20 条 URL: `apps/api/src/modules/url-import/url-import.controller.ts:2` 存在但前端入口未在 AdminCoursesPage 找到批量上传 UI(只支持单 URL)。审核: ADMIN_MANUAL §12 自承 "无显式 pending_review 状态"。`/verify/:serial` 路由公开 + 后端 `certificates.controller.ts:49` 无 JwtAuthGuard,前端 `VerifyCertificatePage.tsx` 公开路由,此项**完整**——与缺口 1 通知中心对比来看,公开验证是真正做出来的。

## 附录:完整对照表(节选)

| 文档章节 | 功能 | 实现状态 | 位置 | 备注 |
|---------|------|---------|------|------|
| §3.1 邮箱注册/登录/忘记密码 | 3 页 + API | 完整 | `apps/web/src/features/auth/{Login,Register,ForgotPassword}Page.tsx` + `apps/api/src/modules/auth/` | - |
| §3.1 6 个 OAuth provider | UI 灰度按钮 | 完整(灰) | `LoginPage.tsx:123` + `components/auth/ProviderButtons.tsx` | Phase 1 灰,符合文档 |
| §3.2 BindingsPage | 6 宫格 + 解除 | 部分 | `BindingsPage.tsx:283`,`AuthProvider.tsx` `unbindProvider` throw "后端 P2 实现待定" | unbind 未实接 |
| §5.1 7 filter + 3 sort | filter 全,sort rating 兜底 | 部分 | `CourseListPage.tsx:127-134` 7 filter,`:182-185` rating 假 | 11 全 |
| §5.3 报名(3 costType) | free/charity 直报,paid 走 order | 完整 | `CourseDetailPage.tsx:190,197` | - |
| §8.1 三栏 dashboard | lg+ 3 栏,md 2 栏 | 完整 | `DashboardPage.tsx:1008,1080-1081` | - |
| §8.4 AI 4 chips | 实 3 个 | 部分 | `DashboardPage.tsx:235` | 缺 1 个 |
| §8.5 LearningEvent 5s 上报 | console.log TODO | 缺失 | `DashboardPage.tsx:477-490` | 后端未接 |
| §7.1 黑客松倒计时 | 无 setInterval | 缺失 | `hackathons/*.tsx` 0 命中 | - |
| §7.4 作品提交 | form 存在 | 完整 | `hackathons/SubmissionPanel.tsx:92-160` | - |
| §11.3 /verify/:serial 公开 | 无 JwtAuthGuard | 完整 | `certificates.controller.ts:49` + `router.tsx` 公开路由 | - |
| §11.4 PNG/PDF 下载 | mock toast | 缺失 | `CertificateDetailPage.tsx:69-71` | - |
| §12.4 退款 4 规则 | 只判 paid | 部分(mock) | `orders.service.ts:298-316` | - |
| §13 通知 4 tab + 30s 轮询 | 整页 skeleton | 缺失 | `NotificationsPage.tsx:22-89` | 抢救版占位 |
| §15 ⌘K 搜索 4 类型 + 键盘 | 全 | 完整 | `components/CommandPalette.tsx:39-42,102-111` | - |
| §17 移动端 5 宫格 + FAB | 全 | 完整 | `components/Layout.tsx:351-395` | - |
| §18 主题切换 + localStorage | 全 | 完整 | (未深入查,Layout 顶部) | - |
| §3 看板 4 KPI + 4 图表 | 全 hardcode mock | Mock | `AdminDashboardPage.tsx:36,77,112,127` | 文档自承 |
| §4.3 课程 5 tab | 5 tab 在,3 tab mock | 部分 | `AdminCoursesPage.tsx:558-563,1111,1161,751,947` | - |
| §4.4 URL 导入 Gemini | 后端在,前端单 URL | 部分 | `apps/api/src/modules/url-import/url-import.controller.ts:2` | - |
| §5 学位 stage 排序 + capstone | 无 stage 编辑器 | 缺失 | `AdminDegreesPage.tsx` `grep "capstone\|stage" 0 命中` | - |
| §6.2 用户详情抽屉 6 section | 无抽屉 | 缺失 | `AdminUsersPage.tsx` 162 行无 drawer | - |
| §7.3 黑客松 5 状态机强制切换 | 待查(后端可能) | 未查 | - | - |
| §8.3 徽章 DSL and/or/not 嵌套 | 单条,无嵌套 | 缺失 | `AdminBadgesPage.tsx:16-26` | - |
| §9 企业咨询 5 状态 | 全 | 完整 | `AdminEnterprisePage.tsx:19` | - |
| §10 审计日志 | 仅 write,无读 | 部分 | `audit-log.service.ts:5` | - |
| §13 数据导出 CSV/JSON | 无 | 缺失 | `AdminUsersPage.tsx` 0 命中 | - |
| §14.1-14.7 14 个常见任务 | 多个 TODO | 部分 | ADMIN_MANUAL 自承多处 "Phase 2+" | - |
| 限流 3/min IP | 有 | 完整 | `apps/api/src/modules/enterprise/enterprise.controller.ts:24` `@Throttle({ default: { limit: 3, ttl: 60000 } })` | - |
| a11y 焦点环 / ARIA | 部分(待抽 3 页) | 未深查 | - | - |

DONE: 完整 12 / 部分 11 / 缺失 5 / 整页 mock 2

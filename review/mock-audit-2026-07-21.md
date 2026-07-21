# AICourse 假数据 / 登录态审计 — 2026-07-21

## 1. 硬编码假数据清单(按 P0/P1/P2 排序)

### P0(用户能直接看到、误导性强)
- [features/dashboard/DashboardLayout.tsx:58] 课程名硬编码为 "用 LangChain 搭建第一个 Agent",忽略真实 course — 现状:`onLearning ? '我的学习 · 继续上次' : '用 LangChain 搭建第一个 Agent'`,所有登录用户都看到同一课 — 建议:接 `coursesApi.getById(courseId)` 拿真实标题
- [features/dashboard/DashboardLayout.tsx:65] 进度条固定 32% — 现状:`width: ${params.courseId ? 32 : 32}%` (两分支同值,疑似 typo) — 建议:接 `progressApi.getMyStats()` / `progress/me/stats` 拿真实比例
- [features/dashboard/DashboardLayout.tsx:74-79] 硬编码 `2,840 积分` + `LV 4` — 现状:后端 `/api/v1/points/me` 已实现,前端零调用 — 建议:接 `pointsApi.getMyPoints()` 真实积分
- [features/dashboard/DashboardPage.tsx:485-490] 5 行硬编码字幕/旁白 — 现状:用户切到 "cc" tab 看到 "欢迎来到第一节课..." — 建议:接 `/api/v1/lessons/:id/transcript` 或留空 + 标 "P2 字幕待后端"
- [features/dashboard/DashboardPage.tsx:505-510] 5 个硬编码资源卡 — 现状:`lesson-1.3-starter.zip` / `langchain-agent-cheatsheet.pdf` 等全是假文件,`href="#"` 无效 — 建议:接 `/api/v1/lessons/:lessonId/resources` 真接口
- [features/dashboard/DashboardPage.tsx:555] 硬编码 `+50 积分 + 进度推进` — 现状:用户每节课固定 +50 — 建议:从后端 `points` 表读 lesson 完成奖励
- [features/dashboard/DashboardPage.tsx:601] AI 助教回复硬编码 "AI 助教即将推出..." — 现状:`/api/v1/chat/sessions` 后端未建,前端用 400ms timeout 假回复 — 建议:保持 placeholder,但去掉"知道你在学 X"这种诱导性措辞
- [features/home/HomePage.tsx:824-907] 右侧 hero 课程预览全硬编码 — 现状:Chapter 03/04/05 + "已完成/进行中/LOCKED" + "AI 助教 · 2 分钟前: 你在 Lesson 4 卡了 12 秒" — 建议:用真用户进度数据,或降级成 "示例预览" 灰色装饰
- [features/enterprise/EnterprisePage.tsx:102-107] 4 个 stats 全假 — 现状:`50+ Enterprise Clients` / `10K+ Trained Engineers` / `98% Satisfaction` / `12+ Industries` — 建议:后端 `/api/v1/site/stats` 已实现,前端零调用,直接接
- [components/Layout.tsx:289] 假 ICP 备案号 — 现状:`京 ICP 备 2026000000 号` — 建议:留空或用 env var,否则有合规风险
- [features/degrees/PurchaseModal.tsx:158] 假支付提示 — 现状:支付中文案 `Mock Pay · 实际未发生扣款` — 建议:接真支付后再去掉"Mock"字样

### P1(装饰性,影响判断但非核心)
- [features/enterprise/EnterprisePage.tsx:210-219] 8 个行业卡片是硬编码 enum — 现状:`金融/电商/制造/...` 8 个,产品页长期不变 — 建议:挪到后端 `industry` 表,或保留但顶部加 "示例" 角标
- [features/enterprise/EnterprisePage.tsx:255, 259] 假联系信息 — 现状:`enterprise@opencsg.com` / `+86 400-xxx-xxxx` — 建议:env 注入
- [features/auth/BindingsPage.tsx:171-176] demo 模式 fallback 用户 — 现状:`user ?? { id: 'demo-user', email: 'k.chen@opencsg.ai', name: 'K. Chen' }` — 建议:仅在 `?demo=with-google` query 时才显示,默认空态
- [components/auth/AuthShell.tsx:119-135] 学员感言(已知保留)— K. Chen testimonial 同上 fallback 用户

### P2(占位示例,可保留但需标注)
- [features/courses/CourseListPage.tsx:101-108] 6 个课程分类 enum — 现状:`CATEGORIES = ['LLM 应用', 'RAG', 'Agent'...]` — 建议:可保留(技术分类,变化慢)
- [lib/searchApi.ts:235] `HOT_SEARCHES = ['LangChain', 'RAG', 'Agent', 'vLLM']` — 同上,搜索热词用 product keyword,后端没对应接口,留 OK
- [components/AiGeneratePanel.tsx:99] placeholder `例:RAG 系统实战` — 纯 UI 提示,OK

## 2. 登录态未区分的展示

- [HomePage / hero stats + 预览 L810-907] 未登录用户看到"在读学员 12.4K / 86 课程 / 2,400+ 已完成项目" — 现状:全公开,把社区域分数据当"产品参数"用 — 应该:未登录显示"累计 12.4K 工程师已加入",登录后显示"我已学 2 / 86"
- [HomePage / 课程预览 L851,869,887] 右侧 3 个章节卡 + "已完成 / 进行中 / LOCKED" chip — 现状:任何访客看到都是假进度 — 应该:未登录显示空进度条 + "登录查看你的进度",登录后从 `/api/v1/progress/me` 拉
- [DashboardLayout L58,65,74-79] 虽在 ProtectedRoute 内,但用户数据全假 — 现状:登录用户也看不到自己真实积分/等级/课程进度 — 应该:已接 `/api/v1/points/me` / `/api/v1/progress/me/stats`,只缺 wiring
- [Layout L289 footer] 全站展示"京 ICP 备 2026000000 号" — 现状:无登录态区分,但数据本身是假的(独立问题)
- [BindingsPage L171-176] 未登录访客看到 demo 用户 "K. Chen" 已绑定列表 — 现状:用 `user ?? {id:'demo-user'...}` 兜底 — 应该:未登录走 `<Navigate to="/auth/login?next=/dashboard/settings/bindings" />`,只在显式 `?demo=` 走 fallback
- [HomePage L824-907 + 701] "LinkedIn" 链接到 `#` — 现状:讲师卡 hover 出的 LinkedIn icon 点了不跳转 — 应该:`#` 改成 `<button disabled>` 或移除

## 3. 后端 API 缺口

### 孤儿 endpoint(后端有,前端没接)
- `GET /api/v1/site/stats` (site.controller L18) — 写一个 `siteApi.ts` 替换 HomePage / EnterprisePage / AuthShell 三处硬编码数字
- `GET /api/v1/points/me` (points.controller L11) — 替换 DashboardLayout L74 假积分
- `GET /api/v1/users/me` (users.controller L30) — `useAuthStore` 没有 refresh 机制,首次登录后服务端改名字/角色前端不感知

### 缺 endpoint(前端要,后端没做)
- `POST/GET /api/v1/notes` — DashboardPage L477 自己承认 "API 正在设计中"
- `POST /api/v1/chat/sessions` (含 SSE) — DashboardPage L103/583 多次标 P2,home hero L903 假"AI 助教 · 2 分钟前"也依赖这个
- `GET /api/v1/degrees/:id/reviews` (degree-level) — DegreeDetailPage L51 占位
- `GET /api/v1/degrees/:id/leaderboard` — DegreeDetailPage L49 占位
- `GET /api/v1/courses/:id/certificates/template` — 证书模块 L45 TYPE_GRADIENT 三类全 `bg-[#171717]`,没有真实证书底图
- `GET /api/v1/courses?sort=popular&rating=4` — CourseListPage L182-188 自承 "popular/rating 后端无字段",客户端 fallback 几乎全通过

## 4. 整体建议(按 ROI 排序)

1. **写一个 `siteApi.ts` 一次替换 3 处硬编码数字**(HomePage L810-813 / AuthShell L107-115 / EnterprisePage L102-107):后端 `/api/v1/site/stats` 已就绪,纯 wiring 工作,1h 改完,P0 全部下线
2. **DashboardLayout 三处假数据 → 三次 API 调用**(L58 课程名 / L65 进度 / L74-79 积分等级):后端 `points/me` + `progress/me/stats` + `courses/:id` 都已有,只差 hook wiring,改完学习中心从"假骨架"变"真面板"
3. **干掉 /dashboard 路由下的 hero 假预览**(HomePage L824-907):这块是首页最大视觉误导源,但修改需要真用户进度数据接入,建议延后到 P2 阶段

---

**总结**:P0 = 11 条 / P1 = 4 条 / P2 = 3 条 / 登录态问题 = 6 条 / API 缺口 = 9 条(3 孤儿 + 6 缺)

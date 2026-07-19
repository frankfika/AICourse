# UX State Machine Audit Report

## 摘要
- 检查页面数: 12 (Home / CourseList / CourseDetail / Dashboard / Orders / Certificates / Notifications / AdminCourses / AdminUsers / AdminDashboard / Login / CommandPalette)
- 状态完整: 2 页 (CommandPalette 完整 4 态,LoginPage 完整 5 态)
- 有缺口: 10 页
- 最高频痛点 Top 3: ① 错误态全 app 集体缺位 ② 危险操作无 confirm ③ 无 ErrorBoundary 一个组件 throw 全 app 白屏

## P0 (用户立刻能撞到的断裂点)

### 断裂点 1: 取消 / 退款订单零确认
- 位置: apps/web/src/features/dashboard/orders/OrdersPage.tsx:420, 434 (OrderActions onClick)
- 现状: `onClick={() => onCancel(order.id)}` / `onClick={() => onRefund(order.id)}` 直接触发 mutation,中间无 window.confirm / Modal
- 缺口: Confirm 态完全缺失(只 OrdersPage 的 BindingsPage.tsx:142 有确认,其他 4 处 cancel 类操作全裸奔)
- 用户故事: "角色 学员 在场景 误点了订单卡片的 X 按钮 想撤销操作, 实际是直接发 cancel 异步请求, 订单状态从'待支付'瞬间变'已取消', 只能再走人工客服"
- 视觉证据: 行 405-439 三组 button 全无 disabled 守卫, 行 415 / 427 也无 `payMutation.isPending` 锁

### 断裂点 2: 操作按钮无 isPending 锁 (连点风险)
- 位置: apps/web/src/features/dashboard/orders/OrdersPage.tsx OrderActions (整个子组件,行 376-441)
- 现状: pay / cancel / refund 三个 button 的 onClick 调 mutation, 但 button 自身不读 `payMutation.isPending` 锁; parent 也只在 4 处传 callback, 不传 isPending
- 缺口: Disabled 态在表单类按钮中完全空白(对比 LoginPage.tsx:170 `isLoading={isSubmitting}` 是有的, 但 OrdersPage 这条 mutation chain 没接)
- 用户故事: "角色 学员 在场景 网络慢时点支付 想快点进入学习, 实际是同一 request 重复发 3-5 次, 后端 /api/v1/orders/:id/pay 抛 409, 全部以 '支付失败' toast 收尾"

### 断裂点 3: 全 app 零 ErrorBoundary
- 位置: `grep -rn "componentDidCatch\|getDerivedStateFromError" apps/web/src/` 返回 0 命中
- 现状: Layout.tsx:184 仅有 `<Suspense fallback={<RouteFallback/>}>`, 没有 errorBoundary 包裹; 任何子组件 throw (e.g. CourseDetailPage.tsx:215 `JSON.parse(course.learningPoints)` schema 异常) 直接 unmount 整个 app
- 缺口: Error 状态在"组件级"无任何兜底
- 用户故事: "角色 学员 在场景 课程详情页 backend 返回 learningPoints 字段是 `null` 而不是 `'[]'` 想看大纲, 实际是整个 app 白屏只剩顶部 nav, 必须手动刷新或重新点链接"

### 断裂点 4: 核心 4 页集体无 isError
- 位置: CourseListPage.tsx:144, CourseDetailPage.tsx:103, OrdersPage.tsx:78, CertificatesPage.tsx:71 — 4 个 useQuery 都只有 `isLoading`, 没有 `isError` 分支
- 现状: 4xx/5xx 时, `data` 持续 undefined, 落到 `isLoading` 永远 true → 用户看到永久 Skeleton; 或者 `!data` → EmptyState (但实际是错误, 不是空)
- 缺口: Error 态在数据获取层完全空白, 跟 HomePage.tsx:355 有 isError fallback 形成反差
- 用户故事: "角色 学员 在场景 后端 502 想看订单列表, 实际是 Skeleton 转 30 秒后空白, 不知道是'没订单'还是'挂了'"

### 断裂点 5: 课程完成操作无失败反馈
- 位置: apps/web/src/features/courses/CourseDetailPage.tsx:161-189 (completeLessonMutation)
- 现状: 只有 onSuccess 推 toast, **无 onError**; 同时 onSuccess 内部 `setTimeout(() => setToasts(...), 3000)` 但 cleanup 没做 (unmount 后还会 setState)
- 缺口: Success 状态有, Error 状态无, 部分失败也无 (pointsAwarded 失败但 badge 成功的混合态没分支)
- 用户故事: "角色 学员 在场景 视频看到一半点'标记完成'想拿积分, 实际是 API 504 时按钮原地变灰、toast 不弹、进度条也不动, 学员以为没点成功连点 5 次"

## P1 (管理员侧)

### 断裂点 6: 通知中心整页是 placeholder
- 位置: apps/web/src/features/dashboard/notifications/NotificationsPage.tsx:1-87
- 现状: 144 行代码, 全是 hardcoded Skeleton + "正在迭代中" 说明, 4 个 tab 全是死 button (line 35-46 第一个写 `i === 0` active, 其他 3 个点了无反应)
- 缺口: 4 tab 切换 Loading/Empty/Error/Success 全缺, 等于死代码
- 用户故事: "角色 学员 在场景 dashboard 看到'通知'红点 想点开看, 实际是 4 个 button 都能点但都无响应, 列表永远是 3 条 mock skeleton"

### 断裂点 7: 课程编辑章节全 MOCK_CHAPTERS
- 位置: apps/web/src/features/admin/AdminCoursesPage.tsx:328-385 (MOCK_CHAPTERS), 行 1320 注释自承 "P0-8 后端暂未实现,操作仅前端 mock"
- 现状: 章节树 / 课时编辑器 / 关键点列表 / 视频上传全是 hardcode 5 章 28 课; 顶部"已自动保存 · 2 分钟前"也是 hardcode
- 缺口: 看似 Save 按钮存在, Success 反馈齐全, 实际是"保存到一个不存在的后端"
- 用户故事: "角色 运营 在场景 改了一节课时标题 想上线, 实际是前端 state 一刷新全没了, 不知道存了没有, 也没 '未连接后端' 警告"

### 断裂点 8: AdminUsersPage 缺 loading/error
- 位置: apps/web/src/features/admin/AdminUsersPage.tsx:23-29
- 现状: useQuery 拉 users, 没有 isLoading 占位也没有 isError 兜底, 只在 `(!users || users.length === 0)` 走"未找到用户"
- 缺口: Error 态缺失, 用户分不清"没有这个人"和"后端挂了"
- 用户故事: "角色 运营 在场景 输入框搜某个邮箱 想看授权历史, 实际是后端超时, 列表卡在 0 条, 提示'未找到用户', 实际该用户存在但 API 没回"

## 全局 UX 模式问题

- **两套 toast 并行**: 全局 `<ToastProvider>` (Toast.tsx) 已在 Layout 上, 但 CourseDetailPage.tsx:72-89 自建一套 `useState<Toast[]>` + setTimeout, 跟全局完全脱节, 失败 toast 排版/位置/动画全不一样
- **loading 风格不统一**: HomePage + CourseListPage + OrdersPage + CertificatesPage 全部用 Skeleton; CourseDetailPage.tsx:200 用裸文字 "加载中..."; LoginPage.tsx:108 又是 Skeleton; DashboardPage 用 3 列 Skeleton grid — 共 3 种不同视觉
- **mock vs 真实混用无明示**: HomePage.tsx:478-481 / CourseListPage 都用 hardcoded mock fallback, "API 暂不可用, 显示离线示例数据" 文案是有的; 但 CourseDetailPage / DashboardPage 的 MOCK_CHAPTERS / MOCK_CHAT 没有任何 mock 提示, 用户分不清真数据还是假数据
- **console.log 漏到生产**: DashboardPage.tsx:490 setInterval 每 5 秒 `console.log('[LearningEvent TODO]', ...)`, 永不停, 整个学习 session 在 console 留几百条 TODO, 既性能浪费又暴露内部 TODO
- **第三方登录 6 按钮全 disabled**: LoginPage.tsx:99-104 + RegisterPage 同款, 灰度策略但点击只是 toast 提示 "即将推出", 无 "申请灰度" CTA
- **disabled 视觉不一致**: primary button disabled 用 opacity-50 (OrdersPage 退款 / CourseDetailPage Buy 按钮), 灰度 chapter item 用 `opacity-50 cursor-not-allowed` (DashboardPage:331), 灰度 lesson list 用 `disabled:cursor-not-allowed` 但保留可点 - 同一语义 3 套视觉

## 附录:按页面分组的状态矩阵

| 页面 | Loading | Empty | Error | Success | Confirm | A11y | 备注 |
|------|---------|-------|-------|---------|---------|------|------|
| / (Home) | ✓ Skeleton×3 | ✓ EmptyState | ✓ mock fallback | - | - | aria-live | 4 段降级 |
| /courses | ✓ Skeleton | ✓ EmptyState | ✗ 永久 Skeleton | - | - | - | isError 缺失 |
| /courses/:id | ✓ 文字 | ✗ 跳"不存在" | ✗ 无 onError | ✓ 自建 toast | ✗ 报名无 | - | toast 跟全局脱节 |
| /dashboard | ✓ Skeleton×3 | ✓ EmptyState | ✗ 静默 fallback mock | ✓ 完成按钮 | - | - | 章节全 mock |
| /dashboard/orders | ✓ Skeleton | ✓ EmptyState | ✗ 永久 Skeleton | ✓ toast | ✗ 取消/退款无 | - | 4 状态缺 3 |
| /dashboard/certificates | ✓ Skeleton | ✓ EmptyState | ✗ 永久 Skeleton | ✗ 下载静默 noop | - | - | 下载是 mock |
| /dashboard/notifications | ✓ Skeleton | - | - | - | - | - | 整页死代码 |
| /admin/courses | ✗ 无 loading | ✓ EmptyState | ✗ isError 仅 2 处 | ✓ alert 弹窗 | ✗ 删除无 confirm | - | 章节树全 mock |
| /admin/users | ✗ 无 loading | ✓ "未找到" | ✗ isError 无 | ✗ 授权后无 toast | - | - | 一处分不清空/错 |
| /admin/dashboard | ✗ 无 loading | - | - | - | - | - | 几乎纯静态 |
| /auth/login | ✓ Skeleton | - | ✓ toast | ✓ toast | - | label/htmlFor | 5 态全 |
| ⌘K CommandPalette | ✓ Skeleton | ✓ EmptyState | ✗ 静默 fallback mock | - | - | role/aria-modal/ESC | 4 态近全 |

DONE: 12 pages checked, 8 gaps found

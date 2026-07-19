# UX State Machine Audit

**目标**: 找出"用户体验断裂点" — 缺 loading / 缺错误反馈 / 死状态 / 不一致的交互

**只读模式**: 不修改代码,只读源码 + 偶尔看文档做对照,产出 audit 报告

**项目**: /Users/fangchen/Baidu/GitHub/AICourse
**范围**: apps/web/src/** (前端 React 组件 + API 调用 + 状态管理)

## 审计维度

对每个**有数据交互的页面**,逐项检查以下 8 个状态:

1. **Loading 状态** — 加载时显示什么? Skeleton / Spinner / "加载中..." 文字? 有吗? 一致吗?
2. **Empty 状态** — 0 数据时显示什么? 有 EmptyState 组件吗? 引导用户下一步?
3. **Error 状态** — 4xx / 5xx / 网络错时显示什么? 有 toast / 错误页 / 重试按钮?
4. **Partial 状态** — 数据部分加载 / 部分失败时,怎么展示?
5. **Success 状态** — 关键操作(报名/购买/提交)成功后给反馈吗?toast / 跳转 / 内联?
6. **Disabled 状态** — 按钮 / 输入框在什么条件下 disabled? 视觉/语义一致?
7. **Confirm 状态** — 删/退款/解绑等不可逆操作有二次确认吗? 确认文案有警告?
8. **Accessibility 状态** — 屏幕阅读 / 键盘 / 焦点管理

## 重点关注

### 高频交互页(必须查)

- / (首页) — 4 段位数据,任一段挂时降级方案
- /courses (课程列表) — 搜索/筛选/分页 loading 一致性
- /courses/:id (课程详情) — 报名按钮多态(未登录/已报名/付费未购/学习)
- /dashboard (学习中心) — 三栏各自 loading / 章节折叠状态保持
- /dashboard/orders (订单) — 5 tab 切换 + 操作按钮多态
- /dashboard/certificates (证书) — 4 tab + 下载/查看按钮
- /dashboard/notifications (通知) — 4 tab + 标记已读
- /admin/courses (后台课程) — 列表 / 编辑 5 tab 切换
- /admin/users (后台用户) — 搜索 / 详情抽屉
- /auth/login /register /forgot (认证) — 表单校验 / 错误提示
- 搜索弹层 (⌘K) — 4 种状态:无输入/loading/有结果/无结果
- Toast 系统 (components/auth/Toast.tsx) — 多 toast 堆叠 / 自动消失 / 手动关闭

### 全局 UX 组件

- Skeleton (components/ui/Skeleton.tsx) — 是不是所有 loading 都用它? 有没有自造 spinner?
- EmptyState (components/ui/EmptyState.tsx) — 有没有 0 数据时直接空白?
- ErrorBoundary — 有没有? 没的话整个 app 一个组件挂全死
- 全局 404 / 500 错误页

### 死代码 / 不一致

- 有没有 button 写了 onClick 但 handler 是 `() => {}` 空的?
- 有没有 form submit 之后没 disable,用户能连点多次?
- 有没有 loading state 没清理,导致 setState on unmounted?
- 有没有 console.error / console.log 漏到生产?
- 有没有 hardcoded URL / 邮箱 / 假数据,没走 mock fallback?

## 输出格式

写到 `/Users/fangchen/Baidu/GitHub/AICourse/review/audit-ux-states.md`:

```markdown
# UX State Machine Audit Report

## 摘要
- 检查页面数: N
- 状态完整: N 页
- 有缺口: N 页
- 最高频痛点 Top 3: [列出]

## P0 (用户立刻能撞到的断裂点)

### 断裂点 1: [页面 + 状态]
- 位置: file:line
- 现状: [具体描述组件行为]
- 缺口: [哪个状态缺]
- 用户故事: "角色 X 在场景 Y 想做 Z, 实际是..."
- 视觉证据: [伪代码 or 描述]

### 断裂点 2: ...

## P1 (管理员侧)

...

## 全局 UX 模式问题

- [比如:loading 风格不统一,5 处用 Skeleton,3 处用 spinner,2 处用"加载中..."]
- [比如:按钮 disabled 状态颜色不一致,primary 灰 vs secondary 灰不同]
- [比如:toast 4 种 variant,success/error/warning/info,实际只有 2 种用]
- [比如:无 ErrorBoundary,任何组件 throw 全 app 死]

## 附录:按页面分组的状态矩阵

| 页面 | Loading | Empty | Error | Success | Confirm | A11y | 备注 |
|------|---------|-------|-------|---------|---------|------|------|
| / | ✓ | - | - | - | - | - | 4 段降级 |
| /courses | ✓ | ✓ | ✗ | - | - | - | 错误时空白 |
| ... | ... | ... | ... | ... | ... | ... | ... |
```

**重要约束**:
- **不写"建议改"** — 描述现状 + 缺口即可
- **每条引述 file:line**,避免抽象描述
- **用户故事句式**:"角色 X 在场景 Y 想做 Z, 实际是..."(Frank 偏好)
- **报告控制在 800-1500 中文字**
- **不跑 dev server,不修改代码**
- **写完即结束**

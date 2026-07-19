# Feature Completeness Audit

**目标**: 找出"文档承诺但代码缺失"的功能 / 路由 / 按钮 / API 调用

**只读模式**: 不修改任何代码,只读源码 + 文档,产出 audit 报告

**项目**: /Users/fangchen/Baidu/GitHub/AICourse
**对照文档**: docs/USER_MANUAL.md (842 行) + docs/ADMIN_MANUAL.md (693 行)
**代码范围**: apps/web/src/**, apps/api/src/**, packages/shared-types/src/**

## 审计方法

对 USER_MANUAL.md / ADMIN_MANUAL.md 中**每个功能点**逐一验证:

1. **路由存在性** — 文档提到的 URL 路径在 router.tsx 里有吗?
2. **组件存在性** — 文档提到的页面 / 组件 / 弹层在源码里 export 了吗?
3. **API 端点存在性** — 文档提到的后端 endpoint 在 apps/api/src/modules/ 里实现了吗?
4. **数据流完整性** — 前端有调用 → 后端有处理 → DB 有 schema,这条链通吗?
5. **可见 vs 实际** — 文档写"支持"的功能,在 UI 上有真的入口吗?

## 重点验证清单(每条都要回答"是/否/部分")

### 学员侧 (USER_MANUAL)

- [ ] 邮箱注册 / 登录 / 忘记密码 — 3 个页面 + 3 个 API
- [ ] 6 个 OAuth provider (Google / GitHub / 微信 / 企业微信 / 飞书 / Apple) — UI 入口 + ProviderButtons 状态
- [ ] 账号绑定 (BindingsPage) — 实际能 list / unbind 吗
- [ ] 课程列表的 7 个筛选 + 3 个排序 — 真在 CourseListPage 落地了吗
- [ ] 课程详情:学习要点 / 试看 / 章节大纲 / 相关推荐 / 评价 — 每项是否渲染
- [ ] 报名 (免费/付费/公益) — 3 个 costType 各有路径吗
- [ ] 学习中心三栏 (左大纲 / 中视频 / 右 AI) — DashboardPage 真的 3 栏? 响应式 md 真的切 2 栏?
- [ ] 视频 + tabs (笔记/字幕/资源) — 4 个 tab 都有内容吗
- [ ] 进度上报 (每 5 秒 LearningEvent) — 上报逻辑实现了吗
- [ ] AI 助教:4 个 chips + 聊天流 + 引用回到视频时间戳 — 引用超链接 click 真跳视频吗
- [ ] 学位列表 / 学位详情 / 学习路径 stage 进度 — 4 状态 (✓/◐/○/locked) 真有?
- [ ] 黑客松 5 tab (全部/报名中/进行中/评审中/已结束) + 倒计时 — 倒计时真每秒减吗
- [ ] 黑客松报名 / 创建团队 / 邀请队友 — UI 都在哪
- [ ] 黑客松作品提交 — 字段齐吗 (仓库 URL / 演示 / 视频 / 描述)
- [ ] 证书 3 类型 (课程/学位/黑客松) — 触发逻辑
- [ ] 证书 4 tab + 下载 PNG/PDF + 公开 /verify/:serial — verify 真能匿名访问?
- [ ] 订单 5 状态 + 5 操作 (查看/支付/取消/退款/重新支付)
- [ ] 退款 4 规则 (未开始/7天内<20%/其他/学位) — UI 提示跟规则一致?
- [ ] 通知中心 4 tab + 标记已读 + 30s 轮询 — 轮询真开了吗
- [ ] 企业咨询表单 8 字段 + 限流 (3/min)
- [ ] ⌘K 搜索 4 类型分组 (课程/学位/黑客松/讲师) + 4 chips 热门 + 键盘导航 (↑↓ Enter Esc ⌘Enter)
- [ ] 移动端 5 宫格 bottom tab + FAB — 真的 < 768px 切换?
- [ ] 暗色主题切换 (☀️/🌙) + 持久化到 localStorage
- [ ] a11y: 焦点环 / ARIA 标签 / 颜色对比 — 实际抽查 3 个核心页

### 管理员侧 (ADMIN_MANUAL)

- [ ] 7 个后台模块都在 (看板/课程/学位/用户/黑客松/徽章/企业)
- [ ] 看板 4 KPI + 4 图表 + 待办 + 系统状态 — 是 mock 还是真数据
- [ ] 课程 5 tab 编辑器 (info/chapters/resources/pricing/publish) — 每个 tab 真的可切换?
- [ ] 课程 URL 导入 (YouTube + Bilibili) — 真接了 Gemini 吗 (找 aiApi.ts)
- [ ] 课程批量导入 (20 条 URL) + 结果分类 (created/duplicate/failed)
- [ ] 学位 CRUD + stage 排序 + capstone markdown
- [ ] 用户详情抽屉 (基本信息/学习/订单/证书/积分/活动日志) — 6 个 section 都有?
- [ ] 改角色 (仅 super_admin) + 封号 + 手动授权课程 + 重置密码 + 删账号
- [ ] 黑客松 5 状态机 + 强制切换
- [ ] 评审模式:作品列表/详情/评分 — 评分真能保存?
- [ ] 徽章规则 DSL (and/or/not + 7 个规则类型) — 真的支持嵌套吗
- [ ] 企业咨询 5 状态 + 流程 (新提交→已联系→已报价→已成交/已放弃)
- [ ] 审计日志 + 系统设置 — 是 placeholder 吗
- [ ] 数据导出 (CSV/JSON) — 真有 API 吗
- [ ] 14 个常见任务清单 — 每条任务在后台能找到对应 UI 吗 (无 UI 写 TODO)

## 输出格式

写到 `/Users/fangchen/Baidu/GitHub/AICourse/review/audit-feature-completeness.md`:

```markdown
# Feature Completeness Audit Report

## 摘要
- 总功能点数: N
- 完整: N
- 部分: N  
- 缺失: N
- Mock 状态: N

## P0 (用户能感知的缺口)

### 缺口 1: [标题]
- 文档章节: USER_MANUAL §X.X
- 文档原文: "[引述]"
- 实际情况: [哪个文件 / 路由 / API 缺失]
- 建议补的方式: [简述,1-2 句,不写代码]
- 影响范围: [谁能感知到]

### 缺口 2: ...

## P1 (管理员能感知的)

...

## P2 (细节,可后续)

...

## 附录:完整对照表

| 文档章节 | 功能 | 实现状态 | 位置 | 备注 |
|---------|------|---------|------|------|
| §3.1 邮箱注册 | UI + API | 完整 | apps/web/src/features/auth/RegisterPage.tsx + apps/api/src/modules/auth/ | - |
| ... | ... | ... | ... | ... |
```

**重要约束**:
- **不写"建议"或"实施"** — 那是 synthesis 的工作,audit 只观察
- **每条都引述具体文件路径 + 行号**(用 `file:line` 格式)
- **缺失 / Mock 都要明确标出**,不藏坑
- **真实现 vs Mock 实现要区分清楚**(dashboard 看板 4 图表是 mock,这是真)
- **输出控制在 800-1500 中文字内**(Frank 风格,concise)
- **不跑 dev server,不写代码,不 git commit**
- **写完即结束**,不追加内容

读源码用 grep / read 工具。Start now.

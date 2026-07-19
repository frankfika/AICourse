# 文档 vs 现实一致性 Audit

**目标**: USER_MANUAL / ADMIN_MANUAL / GLOSSARY 跟实际代码 / 实际功能**对不上**的地方

**只读模式**: 不修改代码,只读源码 + 文档,产出 audit 报告

**项目**: /Users/fangchen/Baidu/GitHub/AICourse
**对照清单**: docs/USER_MANUAL.md (842 行) + docs/ADMIN_MANUAL.md (693 行) + docs/GLOSSARY.md (261 行)
**代码范围**: apps/web/src/**, apps/api/src/**, prisma/schema.prisma

## 审计方法

对每份文档,逐章节**抓出可验证的事实声明**,然后去代码里找证据:

**USER_MANUAL.md** 抓取:
- 路径声明(/xxx URL)
- 行为声明(用户点 X 会发生 Y)
- 数字声明(5 分钟上手 / 4 段位 / 6 个 provider)
- 限制声明(不支持 / 待 Phase 2+)
- 字段声明(表单 / 章节 / 证书字段数)
- 政策声明(退款规则 / SLA)

**ADMIN_MANUAL.md** 抓取:
- 角色权限矩阵(谁能不能做什么)
- 模块清单(7 / 8 / 14)
- 状态机(5 状态 / 5 操作)
- API 端点
- 流程声明(从 X 到 Y)

**GLOSSARY.md** 抓取:
- 术语定义
- 缩写展开
- 平台功能术语(Enrollment / Badge / Point / Certificate 实际触发逻辑)

## 重点验证

### USER_MANUAL 关键声明

- [ ] 文档写 ⌘K 触发,实际 useKeyPress hook 注册了吗 (Layout.tsx)
- [ ] 文档写搜索 debounce 200ms,实际代码是 200ms 吗 (CommandPalette.tsx)
- [ ] 文档写进度上报每 5 秒,实际是 5000ms 吗 (DashboardPage.tsx)
- [ ] 文档写 6 个 OAuth provider,实际 ProviderButtons 里只有几个 disabled
- [ ] 文档写 4 个快捷 chips,实际 CommandPalette 是几个
- [ ] 文档写 5 个状态订单,实际 ordersApi / OrderStatus 是几个
- [ ] 文档写 5 状态黑客松,实际 HackathonStatus 是几个
- [ ] 文档写证书 3 类型,实际 CertificateType 是几个
- [ ] 文档写退款 4 规则,实际后端有对应校验吗 (orders.service.ts)
- [ ] 文档写通知 4 tab,实际 NotificationsPage 实现了几个 (memory 说"placeholder 抢救版")
- [ ] 文档写 7 个 mock 讲师,实际 HomePage 真的有 7 个吗 (header comment 说 4)
- [ ] 文档写 5 宫格 bottom tab,实际 Layout 渲染几个
- [ ] 文档写学位 stage 4 状态,实际 DegreeDetailPage 实现几个
- [ ] 文档写 limit 60 req/min,实际 main.ts 是多少
- [ ] 文档写 refund 5% 手续费,实际代码有这条规则吗

### ADMIN_MANUAL 关键声明

- [ ] 7 个后台模块都在,实际 AdminLayout nav 是几项
- [ ] 文档说看板 4 KPI + 4 图表,实际 AdminDashboardPage 实现几个 (memory 说 mock)
- [ ] 文档写 5 tab 编辑器,实际 AdminCoursesPage 切了几个
- [ ] 文档写 URL 导入支持 6 种 URL 形式,实际 url-parser 支持几种
- [ ] 文档写批量导入 20 条,实际是 limit 20 吗
- [ ] 文档写评审 1-10 分,实际评分组件范围
- [ ] 文档写 7 个徽章规则类型,实际 badges 规则 DSL 几个
- [ ] 文档写 4 角色权限,实际 UserRole 是几个
- [ ] 文档说 super_admin 独享系统设置,实际有这块 UI 吗

### GLOSSARY 关键声明

- [ ] 术语是否真实出现于代码 / 文档
- [ ] 缩写展开是否正确
- [ ] 平台术语定义是否准确 (Enrollment / Badge / Certificate 触发条件)

## 输出格式

写到 `/Users/fangchen/Baidu/GitHub/AICourse/review/audit-docs-vs-reality.md`:

```markdown
# 文档 vs 现实一致性 Audit

## 摘要
- USER_MANUAL 验证事实: N 条
  - 一致: N
  - 不一致: N
- ADMIN_MANUAL 验证事实: N 条
- GLOSSARY 验证事实: N 条

## P0 (用户能直接踩到的文档坑)

### 文档坑 1: [简述]
- 文档位置: USER_MANUAL §X.X
- 文档原文: "[引述]"
- 现实: [代码实际是 X]
- 影响: [用户照文档做会怎样]

### 文档坑 2: ...

## P1 (细节不一致)

...

## 文档本身的问题

- 章节编号错位
- 链接 404
- 拼写错误
- 重复内容
- 表述模糊

## 附录:按文档分组的不一致列表

| 文档 | 章节 | 声明 | 现实 | 状态 |
|------|------|------|------|------|
| USER_MANUAL | §8.5 | 进度每 5 秒上报 | 代码是 % 5 === 0 触发,实际 1 秒一次 | 文档模糊 |
| ... | ... | ... | ... | ... |
```

**重要约束**:
- **每条引述文档原文 + 代码 file:line**
- **不写"修文档"建议**,只列错
- **500-1500 中文字**
- **不修改代码 / 文档**
- **写完即结束**

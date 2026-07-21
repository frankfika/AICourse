# AICourse 前端硬编码列表审计

范围:apps/web/src 全部 TSX, 只读扫描. 排除已修项(HomePage 4 hero / HomePage badge / HomePage preview / AuthShell 3 stats / HomePage 讲师卡 LinkedIn / EnterprisePage 4 stats / Layout ICP).

## 1. 硬编码列表清单(按 P0/P1/P2 排序)

### P0 — 内容驱动 / 高修改频率 / 后端无 source-of-truth
- [features/enterprise/EnterprisePage.tsx:263-271] **industries 8 宫格** — 金融/电商/制造/医疗/教育/政企/汽车/媒体(每项 label+desc). 客户每次扩展行业都要改源码. **建议**: 新建 `industries` 表(id, name, icon, is_active, order_index), GET /api/v1/industries
- [features/enterprise/EnterprisePage.tsx:62] **TEAM_SIZES** — `['1-10','11-50','51-200','201-1000','1000+']` 5 项. inquiry 提交时也用这套. **建议**: 接 enterprise 模块配置, 或在 inquiry submit 时按后端 enum 校验
- [features/enterprise/EnterprisePage.tsx:181-202] **METHODOLOGY 3-step × 4 bullets** — 战略对齐/路径设计/实战交付, 每步 4 个 bullet. 内容文案驱动. **建议**: 塞进 `industries` 同表(methodology_steps JSON)或新 `enterprise_methodology` 表
- [features/courses/CourseListPage.tsx:101-108] **CATEGORIES 6 项** — LLM应用/RAG/Agent/MLOps/Fine-tuning/基础. 后端 tags 字符串切割得到, 分类与实际数据不一致风险. **建议**: 后端加 CourseCategory 表, GET /api/v1/course-categories
- [features/dashboard/DashboardPage.tsx:117] **QUICK_PROMPTS 4 项** — 解释/ReAct vs CoT/给练习/改代码. AI 教学 prompt 调整极频繁, AI 改版/换场景都要动. **建议**: 新建 `quick_prompts` 表(id, label, prompt_text, scope, is_active, order_index)
- [features/dashboard/DashboardPage.tsx:374-379] **视频中心 tabs 4 项** — 笔记/字幕/资源/Q&A, 每个带假 count(3/5/2). 硬编码数字, 真实数据时漂移. **建议**: tab 定义走接口, count 走真实 lesson meta
- [features/auth/BindingsPage.tsx:50-65] **PROVIDER_META 6 项** — local/google/github/wechat/wecom/feishu/apple. 视觉元数据
- [components/auth/ProviderButtons.tsx:121-128] **PROVIDERS 6 项** — 同一份 provider, 跟 PROVIDER_META **重复**且 label 字符串不一致风险. **建议**: 合并到一处(`lib/auth/providers.ts` 单 source of truth), 新增 provider 改一处
- [lib/searchApi.ts:235] **HOT_SEARCHES 4 项** — `['LangChain','RAG','Agent','vLLM']`. CommandPalette / CourseListPage chips / SearchPage 都引用. **建议**: 接 `popular_searches` 表或运营配置 endpoint

### P1 — enum-like / 多文件重复 / 业务 enum 中文化
- [features/hackathons/HackathonListPage.tsx:10-16] **TABS 5 项** — 全部/报名中/进行中/评审中/已结束
- [features/hackathons/HackathonDetailPage.tsx:27-32] **TABS 4 项** — 概览/公告/队伍/作品
- [features/hackathons/HackathonStatusBadge.tsx:3-17] **LABELS + STYLES** — 5 种 status 的中文 label + 样式
- [features/admin/AdminHackathonsPage.tsx:9-23] **STATUS_OPTIONS + STATUS_LABELS** — **又一份** HackathonStatus 中文 label
- → HackathonStatus 的中文 label 在 3 处重复(列表 tab / 详情 badge / admin form), 任一处漏改就漂移. **建议**: 抽 `lib/hackathons/labels.ts`, 单一导出
- [features/dashboard/orders/OrdersPage.tsx:48-73] **TABS 5 项 + STATUS_LABEL + STATUS_CHIP_CLASS** — OrderStatus 全套中文 + 颜色 class
- [features/dashboard/orders/OrderDetailPage.tsx:31-55] **同一份 OrderStatus 的中文 + icon + color** — **重复** OrdersPage
- [features/dashboard/certificates/CertificatesPage.tsx:45-62] **TABS 4 项 + TYPE_LABEL + TYPE_BG** — CertificateType 中文化
- [features/dashboard/certificates/CertificateDetailPage.tsx:29-50] **同 TYPE_LABEL + TYPE_ICON + TYPE_GRADIENT** — **重复** CertificatesPage
- [features/dashboard/notifications/NotificationsPage.tsx:33-45] **TABS 4 项 + TYPE_META 4 项** — notification type → icon/color/label/tab. 4 个 type 跟后端 NotificationType enum 一一对应
- [routes/SearchPage.tsx:43-49] **TYPE_TABS 5 项** + [lib/searchApi.ts:248-254] **groupResults labels** + [components/CommandPalette.tsx:38-43] **TYPE_META** — SearchResultType 的中文 label 散 3 处
- [components/CommandPalette.tsx:38-43] **TYPE_META 4 项** — 跟 SearchPage TYPE_LABEL / groupResults labels **重复**
- [features/admin/AdminBadgesPage.tsx:12-19] **criteriaTypeOptions 6 项** — BadgeCriteriaType 的中文 label
- [features/admin/AdminBadgesPage.tsx:468-472] **OP_OPTIONS 3 项** — AND/OR/NOT
- [features/admin/AdminEnterprisePage.tsx:19] **STATUS_OPTIONS 5 项** — pending/contacted/qualified/closed/archived
- [features/admin/AdminUsersPage.tsx:102-127] **ROLE_META 3 项 + STATUS_COLOR 6 项** — UserRole + OrderStatus 颜色
- [features/courses/CourseListPage.tsx:110-116] **LEVELS 4 项 + LEVEL_LABELS** — Beginner/Intermediate/Advanced/Expert 中文
- [features/courses/CourseListPage.tsx:94-99] **DURATION_LABELS 4 项** + L489-494 评分 4 档 + L558-562 sort 3 项 + L290 hot keywords 5 项
- [features/admin/AdminAuditLogsPage.tsx:18] **TABS** — 4 entity 审计 log tab

### P2 — 单文件/UI 装饰/低修改频率
- [features/degrees/DegreeDetailPage.tsx:47-52] **P2_PLACEHOLDERS 4 项** — 路径阶段图/同班排名/证书预览/学员评价, 每个带"后端 stage API 设计中"文案. 等后端上线后整组删除即可
- [features/degrees/DegreeDetailPage.tsx:256-259] **Tabs 2 项 inline** — 学位概览/课程 (内部 array, 跟其他 tab 模式不一致, 应提到常量)
- [features/home/HomePage.tsx:736-741] **instructor palette 4 色** — `{cover: 'bg-[#171717]'}` × 4. 纯 UI 颜色, 后端无 source-of-truth, 不必入库
- [features/home/HomePage.tsx:836-973] **HeroPreviewCard 对话气泡 mock** — AI 助教示例对话(标注"产品示例"), 已是 P0 mock, 改 chat module 上线时再清
- [features/dashboard/certificates/CertificatesPage.tsx:88-91] **下载证书 mock toast** — `showToast('证书已发送到你的邮箱 (mock)', 'info')`. 跟 chat/notes/AI 一样是占位
- [components/ConfirmDialog.tsx:45-57] / [components/ui/Button.tsx:36-55] / [components/ui/Input.tsx:26] — 都是组件 enum(confirmVariant / buttonVariant / buttonSize / inputSize), 设计系统层, 不进 CMS

## 2. 后端已有但前端没接的 list endpoint

| 后端 endpoint | 文件 | 前端是否接 | 备注 |
|---|---|---|---|
| `GET /api/v1/learning-events/me` | learning-events.controller.ts:35 | **未接** | learningEventsApi 只调 POST / POST batch, 没人用 listMine |
| `GET /api/v1/learning-events/lesson/:id` | learning-events.controller.ts:40 | **未接** | admin/instructor 限定, 暂无教师视角 |
| `GET /api/v1/badges/me` | badges.controller.ts:30 | **未接** | badgesApi.getMyBadges 定义, 但前端无任何 useQuery 调它. `my-badges` queryKey 在 admin page 出现仅作 invalidation |
| `GET /api/v1/badges/admin/stats` | badges.controller.ts:67 | **未接** | AdminBadgesPage 没展示"已授予人数/触发率"等 gamification 看板, 后端已就绪 |
| `GET /api/v1/points/me` | points.controller.ts:11 | **已接** (DashboardLayout.tsx:78) | — |
| `GET /api/v1/site/stats` | site.controller.ts:18 | **已接** (Home/Enterprise/AuthShell) | — |
| `GET /api/v1/enterprise/inquiries` | enterprise.controller.ts:31 | **已接** (AdminEnterprisePage) | — |
| `GET /api/v1/notifications[/unread-count]` | notification.controller.ts:42,51 | **已接** (NotificationsPage + Layout bell) | — |
| `GET /api/v1/audit-logs` | audit-log.controller.ts:25 | **已接** (AdminAuditLogsPage) | — |
| `GET /api/v1/admin/stats` | admin/stats | **已接** (AdminDashboardPage) | — |
| `GET /api/v1/practices/...` | practices module | **未接** (CoursePracticesTab 文件存在但 0 引用) | 整 practicesApi 客户端全空, 见下文 |

附加发现: `features/courses/CoursePracticesTab.tsx` 定义但全仓 0 引用(`grep -rn "CoursePracticesTab" apps/web/src` 只返回它自己), 是死代码 + orphan endpoint 双重.

## 3. 推荐的新 schema(值得建表的)

```prisma
// 1. industries — EnterprisePage 8 宫格 + methodology 3-step
model Industry {
  id          String   @id @default(cuid())
  name        String   // "金融 / Fintech"
  description String?  // "风控、量化、智能客服"
  icon        String?  // lucide name
  methodology Json?    // [{num, icon, title, desc, bullets[]}]
  isActive    Boolean  @default(true)
  orderIndex  Int      @default(0)
}

// 2. quick_prompts — Dashboard AI 助教 chips
model QuickPrompt {
  id         String   @id @default(cuid())
  label      String   // "📌 解释这节课"
  promptText String   // 实际发给 AI 的文本
  scope      String   @default("lesson") // lesson / course / global
  isActive   Boolean  @default(true)
  orderIndex Int      @default(0)
}

// 3. course_categories — CourseListPage CATEGORIES
model CourseCategory {
  id         String   @id @default(cuid())
  name       String   @unique
  label      String   // 显示名
  isActive   Boolean  @default(true)
  orderIndex Int      @default(0)
}

// 4. popular_searches — HOT_SEARCHES
model PopularSearch {
  id         String   @id @default(cuid())
  keyword    String   @unique
  clickCount Int      @default(0)
  isActive   Boolean  @default(true)
  orderIndex Int      @default(0)
}

// 5. auth_providers — BindingsPage + ProviderButtons 两份重复
model AuthProvider {
  id          String   @id // google/github/wechat/...
  label       String
  isActive    Boolean  @default(false)
  orderIndex  Int      @default(0)
  config      Json?    // clientId, scopes
}
```

剩下 enum label 重复项(HackathonStatus 中文 / OrderStatus 中文 / CertificateType 中文 / BadgeCriteriaType 中文)不进新表, 抽 `lib/*/labels.ts` 单文件即可, 改一处全站生效.

## 4. Top 5 ROI(改频 × 复杂度)

| 排名 | 列表 | 频次 | 复杂度 | 收益 |
|---|---|---|---|---|
| 1 | EnterprisePage industries 8 宫格 (L263-271) | 高(销售/BD 反复调) | 中(8 项 + desc + methodology 共 12 字段) | 接 industries 表后改 CMS 即时生效, 不再发版 |
| 2 | EnterprisePage TEAM_SIZES (L62) | 中(销售漏斗跟团队规模强绑) | 低(5 项简单 enum) | 接 enterprise module config 即可, 顺便给 inquiry submit 加 server 校验 |
| 3 | DashboardPage QUICK_PROMPTS (L117) | **极高**(AI 改版每次调 prompt) | 低(4 项简单) | 教学 prompt 实验迭代零发版, 教研团队自助 |
| 4 | BindingsPage PROVIDER_META (L50) + ProviderButtons PROVIDERS (L121) | 中(加新 provider 改 2 处) | 低(6 项) | 合并 `lib/auth/providers.ts` + 接后端 /auth/providers, 新增 provider 改 1 处 |
| 5 | HackathonStatus / OrderStatus / CertificateType / BadgeCriteriaType 的中文 label 多处重复 | 中(产品改文案风格) | 中(3-4 个文件 × 5-7 项) | 抽 `lib/*/labels.ts` 4 个文件, 改一处全站生效, 防漂移 |

---

LISTS_DONE: 36 个硬编码列表 / 4 个孤儿 list endpoint(learning-events/me + lesson/:id + badges/me + badges/admin/stats)+ 1 个死代码模块(practices 全空) / Top 5 建议(见 §4)

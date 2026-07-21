# CMS / 硬编码 UI 文案 / 业务推导 审计清单

> **只读扫描结果** · 范围: `apps/web/src/{features,components,lib}` · 后端交叉: `apps/api/src` + `packages/shared-types`
> **不包含**: Frank 已修过的(HomePage 4 hero / AuthShell stats / DashboardLayout 课程名 / DashboardPage 字幕+AI 助教+积分)。
> **未发现** `enum_translations` / `app_settings` 表 — 全部命中都是前端硬编码。

---

## 1. 业务推导逻辑硬编码（最严重 — Frank 重点关注）

> 这 16 个函数在 5+ 个文件里**重复实现**,任意一处改业务规则都会漏改。

| file:line | 函数 / 常量 | 硬编码什么 | 建议驱动源 |
|---|---|---|---|
| `features/home/HomePage.tsx:133` | `formatStatNumber` | `'万'` 单位 + `toLocaleString('en-US')` 千分位 | `app_settings.number_format` |
| `features/home/HomePage.tsx:155` | `useCountdown` | `'距开始'/'距截止'/'已结束'` 三态中文 | `enum_translations(countdown_phase)` |
| `features/home/HomePage.tsx:192` | `getCourseCoverBg` | tag 关键词 → 硬编码 brutalist 灰阶 | `course.cover_palette_id` |
| `features/home/HomePage.tsx:736` | `instructors.palette` | 4 个写死 cover 颜色 | 同上 |
| `features/courses/CourseListPage.tsx:74` | `getCourseCoverGradient` | **与 HomePage 重复** + 5 个 if 都映射到同一灰 | 同上 |
| `features/courses/CourseListPage.tsx:84` | `durationBucket` | `<4` / `<8` / `<12` 阈值硬编码 | `app_settings.duration_buckets` |
| `features/courses/CourseListPage.tsx:181` | `minRating` filter | 描述里搜 `star\|★\|rating` 关键词当评分 | **后端缺 rating 字段**,建议 `GET /courses?min_rating=` |
| `features/dashboard/DashboardPage.tsx:122` | `formatDuration` | `M:SS` 模板, `—` fallback | `app_settings.duration_template` |
| `features/dashboard/DashboardPage.tsx:117` | `QUICK_PROMPTS` | 4 条 hardcoded emoji prompt | `app_settings.ai_quick_prompts` |
| `features/dashboard/notifications/NotificationsPage.tsx:58` | `relativeTime` | `'刚刚'/'分钟前'/'小时前'/'天前'` 4 档 | `enum_translations(relative_time)` |
| `features/admin/AdminUsersPage.tsx:129` / `:138` | `formatDate` / `formatDateTime` | `toLocaleDateString('zh-CN', …)` | 同上 |
| `features/admin/AdminHackathonsPage.tsx:25` | `toDateTimeLocal` | `YYYY-MM-DDTHH:mm` 模板 | `app_settings.datetime_input_format` |
| `features/courses/CourseDetailPage.tsx:93` | `resourceLabel` | `pdf→PDF, code→代码, link→链接, video→视频, audio→音频` | `enum_translations(resource_type)` |
| `features/courses/CourseDetailPage.tsx:97` | `courseTypeLabel` | `own/partner/public/third_party → 自有/合作/公开/第三方` | `enum_translations(course_type)` |
| `features/courses/CourseDetailPage.tsx:106` | `courseTypeBadgeClass` | 同上 → 4 个颜色 | `enum_translations(course_type)` |
| `features/auth/BindingsPage.tsx:50` | `PROVIDER_META` | 6 个 provider 中文 label + 缩写 icon | `enum_translations(oauth_provider)` |
| `components/auth/AuthShell.tsx:28` | `formatStatNumber` (dup) | 与 HomePage 第 3 份 copy-paste | **抽 lib/format.ts** |
| `features/enterprise/EnterprisePage.tsx:30` | `formatStatNumber` (dup) | 第 3 份 copy-paste | 同上 |

---

## 2. UI label 硬编码（按页面分）

> 每条 = 1 处文案,即使看似无关, 也是 i18n / 改文案时的遗漏点。

| 页面 / 位置 | 硬编码文案 | 建议 config key |
|---|---|---|
| **Dashboard** (`DashboardPage.tsx:117`) | `QUICK_PROMPTS` 4 条: `解释这节课 / ReAct vs CoT / 给个练习 / 这段代码怎么改` | `ai.quick_prompts` |
| **Dashboard** (`DashboardPage.tsx:375-378`) | Tab 计数写死: `笔记 3 / 资源 5 / Q&A 2` | 后端返回 count,不要前端常量 |
| **Dashboard** (`DashboardPage.tsx:533`) | Q&A 空态: `"本课学员提的问题会在这里,你可以点上面「Q&A」旁边的铃铛订阅"` | `dashboard.empty.qa` |
| **Dashboard** (`DashboardPage.tsx:467`) | 笔记提示: `"按 N 添加时间戳笔记"` | `dashboard.notes.hint` |
| **Admin** (`AdminUsersPage.tsx:104/109/114`) | `ROLE_META` 三角色 label+色: 学员/讲师/管理员 | `enum_translations(user_role)` |
| **Admin** (`AdminUsersPage.tsx:120`) | `STATUS_COLOR` 6 个订单状态色(无 label) | 与下条 STATUS_LABEL 合并 |
| **Admin** (`AdminUsersPage.tsx:184/198/215/224`) | toast 文案: `角色已更新 / 已授权 N 门课程 / 临时密码:… / 用户已删除` | `admin.users.toast.*` |
| **Admin** (`AdminCoursesPage.tsx:672-675`) | Level 4 档 `入门/进阶/高级/专家` (与 CourseListPage 重复) | `enum_translations(course_level)` |
| **Admin** (`AdminCoursesPage.tsx:386-388`) | Cost 3 档 `<option>` `免费/付费/公益` | `enum_translations(cost_type)` |
| **Admin** (`AdminCoursesPage.tsx:1253`) | pricing plans 3 块卡片 title/sub/priceHint 写死 | `admin.courses.pricing_plans` |
| **Admin** (`AdminCoursesPage.tsx:1436`) | `course.status === 'published' ? '已发布' : '未发布'` (内联三元) | `enum_translations(course_status)` |
| **Admin** (`AdminHackathonsPage.tsx:17`) | `STATUS_LABELS` (与 HackathonStatusBadge 重复) | `enum_translations(hackathon_status)` |
| **Admin** (`AdminBadgesPage.tsx:13-18`) | 6 个徽章触发条件 + 3 个 operator (`AND/OR/NOT`) | `enum_translations(badge_criteria_*)` |
| **Admin** (`AdminEnterprisePage.tsx:67`) | **bug**: 筛选 tab 直接显示 `s` (raw enum `pending/contacted/qualified/closed/archived`) | 同上 |
| **Admin** (`AdminEnterprisePage.tsx:120`) | **bug**: `<option>{s}</option>` 也直接 raw enum | 同上 |
| **Admin** (`AdminReviewsPage.tsx:61`) | `"软删:content 置「[已删除]」+ 保留 userId 用于审计追溯 · 后端 guard admin"` | `admin.reviews.disclaimer` |
| **Admin** (`AdminDashboardPage.tsx:225-244`) | 4 条 todo 标题 + sub 文案 (`待回复企业咨询 / 草稿课程待发布 / 本周新发布黑客松 / 审计日志`) | `admin.dashboard.todos` |
| **Courses List** (`CourseListPage.tsx:101-108`) | `CATEGORIES` 6 分类 `LLM 应用 / RAG / Agent / MLOps / Fine-tuning / 基础理论` | `enum_translations(course_category)` |
| **Courses List** (`CourseListPage.tsx:559-561`) | Sort 3 选项 `最热门/最新/评分` | `courses.sort_options` |
| **Hackathons** (`HackathonListPage.tsx:10-16`) | `TABS` 5 个 status tab label | `enum_translations(hackathon_status)` |
| **Hackathons** (`SubmissionPanel.tsx:23`) | submission 状态 6 个 label (草稿/已提交/评审中/入围/获奖/未入围) | `enum_translations(submission_status)` |
| **Orders** (`OrdersPage.tsx:49-53`) + (`OrderDetailPage.tsx:31-37`) | order status 5 档 label **重复** | `enum_translations(order_status)` |
| **Notifications** (`NotificationsPage.tsx:33-37`) | 4 tab + 4 type 标签 + 4 颜色 | `enum_translations(notification_type)` |
| **Notifications** (`NotificationsPage.tsx:99/107`) | toast: `已标记 N 条为已读 / 已清空 N 条已读通知` | `notifications.toast.*` |
| **Layout** (`Layout.tsx:69-72`) | 顶部 nav 4 项 `课程/学位/黑客松/企业培训` | `nav.top_items` |
| **Layout** (`Layout.tsx:332-361`) | mobile bottom 5 tab label | `nav.bottom_items` |
| **Layout** (`Layout.tsx:264-285`) | footer 3 列 9 个链接 label + 2 个 section header | `footer.sections` |
| **Layout** (`Layout.tsx:298`) | `"· 备案号待补"` / `v0.5.0 · built for AI era` | `footer.signature` |
| **Layout** (`Layout.tsx:131`) | 搜索框 placeholder `搜索课程 / 讲师 / 技能` | `nav.search_placeholder` |
| **Layout** (`CommandPalette.tsx:180`) | 搜索框 placeholder `搜索课程 / 学位 / 黑客松 / 讲师...` | 同上(与 layout 重复) |
| **Auth** (`LoginPage.tsx:144/171`) | placeholder `you@company.com / ••••••••` | `auth.login.placeholder.*` |
| **Auth** (`RegisterPage.tsx:158-210`) | 4 个 placeholder `你的姓名 / you@…/ 至少 6 位 / 再输入一次` | `auth.register.placeholder.*` |
| **Enterprise** (`EnterprisePage.tsx:264-271`) | 8 个行业分类 label+desc (金融/电商/制造/医疗/教育/政企/汽车/媒体) | `enterprise.industries` |
| **Enterprise** (`EnterprisePage.tsx:417/429`) | 咨询表单 placeholder | `enterprise.inquiry.placeholder.*` |
| **Auth** (`ProviderButtons.tsx:122-127`) | 6 个 OAuth 中文 label `Google/GitHub/微信/企业微信/飞书/Apple` | `enum_translations(oauth_provider)` |

---

## 3. 状态 / 颜色 mapping 硬编码（重复最多）

> 同 1 个 enum 在 2-4 个文件里各画一次 — 改一个状态(如新增 `paid_refunded`)要全文搜。

| enum | 文件 / 行 | 类型 | 备注 |
|---|---|---|---|
| `OrderStatus` | `OrdersPage.tsx:56` + `OrderDetailPage.tsx:31` + `AdminUsersPage.tsx:120` (色) | label + icon + color | **3 处重复**,2 处 label,1 处色 |
| `HackathonStatus` | `HackathonStatusBadge.tsx:3,11` + `AdminHackathonsPage.tsx:17` + `HackathonListPage.tsx:10` | label + style + tab | **3 处**,色 2 处 |
| `SubmissionStatus` | `SubmissionPanel.tsx:23,32` | label + style | 1 处,色几乎全黑(`bg-[#171717]`) |
| `CourseLevel` | `CourseListPage.tsx:111` + `AdminCoursesPage.tsx:672` | label | **2 处重复** |
| `CostType` | `HomePage.tsx:305` + `CourseListPage.tsx:415` + `DegreeListPage.tsx:42` + `DegreeDetailPage.tsx:137` + `AdminCoursesPage.tsx:386` + `PurchaseModal.tsx:99/112` | label + color | **6 处**,色 3 处,文案不一致风险高 |
| `CourseStatus` (`draft/published/archived`) | `AdminCoursesPage.tsx:1436` | label 内联三元 | 只有 1 处,但形式是三元,不是 record |
| `InquiryStatus` (`pending/contacted/...`) | `AdminEnterprisePage.tsx:67,120` | **未翻译**,直接 raw enum 显示 | **P0 bug,见 §5** |
| `UserRole` | `AdminUsersPage.tsx:102` + `Layout.tsx:152` | label + color + icon | 2 处,Layout 端无 label,只判断 |
| `NotificationType` | `NotificationsPage.tsx:40` | icon + color + label + tab | 1 处但有 4 字段 |
| `SearchResultType` | `CommandPalette.tsx:38` | label + icon + color | 1 处,4 type |
| `ProgressStatus` (`not_started/in_progress/completed`) | `DashboardPage.tsx:98,244-281` | icon + 颜色 (用 className 拼接) | **无统一 mapping**,3 状态 3 套分散逻辑 |
| `OAuthProvider` | `ProviderButtons.tsx:122` + `BindingsPage.tsx:50` | label + icon | 2 处,**icon 抽象不一致** |
| `ResourceType` | `CourseDetailPage.tsx:93` | label | 1 处,5 type |
| `CourseType` (`own/partner/public/third_party`) | `CourseDetailPage.tsx:97,106` | label + color | 1 处,4 type |
| `RelativeTime` | `NotificationsPage.tsx:58` | 4 档(`<60s/<1h/<24h/<30d`) | 阈值硬编码 |

---

## 4. 推荐的 schema（与 sub-agent A/B 互补）

> 全部新建表,无破坏性,前端 / `useTranslations()` 风格 hook 读。

```sql
-- 4.1 全局 key-value 配置(任何"业务规则硬编码"都进这)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,                  -- 如 "duration_buckets", "ai.quick_prompts"
  value_json JSONB NOT NULL,             -- {"lt4": 0, "4to8": 4, "8to12": 8, "gt12": 12}
  scope TEXT NOT NULL DEFAULT 'global',  -- 'global' | 'admin' | 'student' | 'instructor'
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- 例: key='duration_buckets'  value_json={"buckets":[{"key":"lt4","max":4,"label":"4 小时以内"}, ...]}

-- 4.2 枚举 i18n(任何 enum 走这)
CREATE TABLE enum_translations (
  enum_type TEXT NOT NULL,               -- 'course_level' | 'order_status' | 'hackathon_status' | ...
  enum_value TEXT NOT NULL,              -- 'Beginner' | 'pending' | 'upcoming'
  locale TEXT NOT NULL DEFAULT 'zh-CN',  -- 'zh-CN' | 'en-US'
  label TEXT NOT NULL,                   -- '入门' | '待支付' | '报名中'
  color_class TEXT,                      -- 'bg-success-100 text-success-500' (brutalist token)
  icon TEXT,                             -- 'Clock' | 'CheckCircle2' (lucide-react name)
  sort_order INT DEFAULT 0,
  PRIMARY KEY (enum_type, enum_value, locale)
);

-- 4.3 日期/时间格式模板(替换散落的 toLocaleDateString)
CREATE TABLE date_format_templates (
  scope TEXT NOT NULL,                   -- 'admin.users.list' | 'dashboard.lesson.duration'
  template TEXT NOT NULL,                -- 'YYYY-MM-DD HH:mm' | 'M:SS'
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  PRIMARY KEY (scope, locale)
);
```

**关键调用约定**:
- 前端 `useEnum('course_level', level)` → `{label, color, icon}`
- `useSetting('duration_buckets')` → 直接拿 JSON,不再写 `durationBucket()`
- `formatDate(scope, iso)` → 统一入口,内部查模板表
- 写入: admin 端走 `/admin/settings` 页面,`enum_translations` 配 CRUD

---

## 5. Top 5 ROI(按"修改频率 × 影响范围")

| # | 项目 | 位置 | 行动 | ROI 理由 |
|---|---|---|---|---|
| 1 | **`InquiryStatus` 直接显示 raw enum** | `AdminEnterprisePage.tsx:67, 120` | 立刻前端加 `STATUS_LABELS` 临时修;同步加 `enum_translations(inquiry_status)` | 100% 用户可见的 bug,admin 端筛选项给客户 / 投资人看会直接露馅 |
| 2 | **`formatStatNumber` 3 份 copy-paste** | `HomePage:133` + `AuthShell:28` + `EnterprisePage:30` | 抽 `lib/format.ts` 单一函数 | 改 i18n 改"万"单位 3 处改;现已是 3 份不同参数,真有偏差风险 |
| 3 | **`STATUS_LABELS` × 4 个 status × 多文件** | 详见 §3 | 先收口成 `useEnum('hackathon_status')` hook,再灌 DB | 5 个 enum × 2-3 文件 = ~15 处重复;新增 1 状态要全局 sed |
| 4 | **dashboard / courses 重复的 level + category** | `CourseListPage:111, 101` + `AdminCoursesPage:672` | 全部走 `enum_translations` | 投资人改 "Beginner→入门" 要 2 处改;未来 en-US 改不动 |
| 5 | **`formatDate` / `toLocaleDateString('zh-CN')` 散落 8+ 文件** | `AdminUsersPage:131,140` + `AdminAuditLogs:154` + `AdminReviews:177` + `AdminHackathons:302,304` + `AdminEnterprise:189` + `AnnouncementList:41` + `NotificationsPage:68` | 抽 `formatDate(scope)` + `date_format_templates` 表 | i18n en-US 改造时,全仓 grep 替换散落调用是体力活;统一入口后 1 处改完 |

---

**总结**:

- 业务推导函数 **16 个**(2 处色映射 + 1 处评分关键词当数据是 P1 bug)
- UI label **35 条**(按页面分,不含已修)
- 状态 / 颜色 mapping **15 个 enum 散落 ~30 处**(`InquiryStatus` 是唯一未翻译的 P0)
- 数据库侧需建 3 张表(`app_settings` + `enum_translations` + `date_format_templates`)
- 最高 ROI 是 #1 `InquiryStatus` 漏翻译(投资人路演 admin 截图直接暴露)和 #2 3 份 `formatStatNumber` 收口

# OpenCSG Academy

> **v1.5.0** (2026-07-23) — CMS 化重构(16 表 + 5 controller + 13 tab AdminSettings) + Auth hard reload 修 + Hackathon 极简化
>
> 30+ 处硬编码清零 · 141 测试 0 fail (106 jest + 35 vitest) · 0 tsc / 0 build 错

OpenCSG Academy 是一个现代化的在线教育平台，专注于 AI 和大模型技术培训。

---

## 📖 文档导航

> **如果你是学习者 / 学员**:从 [用户手册](./docs/USER_MANUAL.md) 开始 — 5 分钟快速上手 + 完整功能指南
>
> **如果你是 admin / 运营**:看 [管理员手册](./docs/ADMIN_MANUAL.md) — 后台 7 个模块全部覆盖
>
> **如果遇到 AI / LLM 术语不懂**:[术语表](./docs/GLOSSARY.md) 速查
>
> **如果你是开发者**:往下读「项目架构」「快速开始」章节
>
> **如果是项目维护者**:`review/` 目录有完整的审计报告(UX 状态机 / 功能完整性 / 移动 + 暗色 / 文档对齐 / AI 专题),每条带源码行号

---

## 🏗️ 项目架构

本项目采用 **Monorepo** 架构，使用 **pnpm workspace** 管理多个子项目：

```
AICourse/
├── apps/
│   ├── api/              # NestJS 后端 API
│   └── web/              # React 前端应用
├── packages/
│   └── shared-types/     # 共享 TypeScript 类型定义
├── prisma/               # 数据库 schema 和 migrations
├── docker-compose.yml    # 本地开发环境（MySQL, Redis, MinIO）
└── pnpm-workspace.yaml   # Monorepo 配置
```

### 技术栈

| 模块 | 技术栈 |
|------|--------|
| **后端** | NestJS + Prisma + MySQL + Redis + JWT |
| **前端** | React 19 + TypeScript + Vite + TailwindCSS + React Router |
| **数据库** | MySQL 8.0 (Prisma ORM) |
| **缓存** | Redis 7 |
| **对象存储** | MinIO (本地) / S3 (生产) |
| **包管理** | pnpm + workspace |
| **API 文档** | Swagger/OpenAPI |

---

## 🚀 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker 和 Docker Compose（用于本地数据库）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：
- 数据库连接字符串
- JWT 密钥（至少 32 位强随机字符串）
- Stripe 支付密钥（可选）
- Gemini API Key（可选，用于 AI 助教）

### 3. 启动基础设施

启动 MySQL、Redis 和 MinIO：

```bash
docker compose up -d
```

验证服务状态：

```bash
docker compose ps
```

### 4. 初始化数据库

生成 Prisma Client 并运行迁移：

```bash
pnpm db:generate
pnpm db:migrate
```

可选：填充测试数据

```bash
pnpm db:seed
```

### 5. 启动开发服务器

**并行启动所有服务：**

```bash
pnpm dev
```

**或分别启动：**

```bash
# 启动后端 API (默认端口 8080)
pnpm dev:api

# 启动前端 (默认端口 3000)
pnpm dev:web
```

### 6. 访问应用

- 前端：http://localhost:5500(Vite 默认 3000,本地 5500)
- 后端 API：http://localhost:8080/api
- API 文档(Swagger)：http://localhost:8080/api/docs
- Prisma Studio：`pnpm db:studio`
- MinIO Console：http://localhost:9011 (admin/minioadmin)
- MySQL：localhost:3307 · Redis：localhost:6380 · MinIO API：localhost:9010

---

## 📦 项目命令

### 根目录命令

```bash
# 开发
pnpm dev              # 并行启动所有服务
pnpm dev:api          # 仅启动后端
pnpm dev:web          # 仅启动前端

# 构建
pnpm build            # 构建所有子项目
pnpm build:api        # 仅构建后端
pnpm build:web        # 仅构建前端

# 数据库
pnpm db:generate      # 生成 Prisma Client
pnpm db:migrate       # 运行数据库迁移
pnpm db:studio        # 打开 Prisma Studio
pnpm db:seed          # 填充测试数据

# 其他
pnpm lint             # 代码检查
pnpm test             # 运行测试
```

### 子项目命令

```bash
# 在特定子项目中运行命令
pnpm --filter @opencsg/academy-api <command>
pnpm --filter @opencsg/academy-web <command>
pnpm --filter @opencsg/shared-types <command>
```

---

## 📁 详细架构

### apps/api - 后端 API

基于 NestJS 的 RESTful API，提供：

- 🔐 **认证授权**：JWT + Refresh Token + Cookie
- 👥 **用户管理**：注册、登录、权限管理
- 📚 **课程管理**：课程 CRUD、章节、课时、资源
- 🎓 **学位管理**：Nano Degree 学位体系
- 📝 **报名管理**：课程/学位报名、权限验证
- 💳 **订单支付**：Stripe 集成（待实现）
- 🏆 **黑客松**：赛事、团队、作品提交、评审
- 📊 **学习进度**：课时进度跟踪
- 🔍 **审计日志**：操作记录和追踪

**目录结构：**

```
apps/api/
├── src/
│   ├── modules/        # 功能模块
│   │   ├── auth/       # 认证授权
│   │   ├── users/      # 用户管理
│   │   ├── courses/    # 课程管理
│   │   ├── degrees/    # 学位管理
│   │   ├── enrollments/ # 报名管理
│   │   ├── prisma/     # Prisma 服务
│   │   └── audit/      # 审计日志
│   ├── app.module.ts   # 根模块
│   └── main.ts         # 入口文件
├── prisma/             # 数据库配置
└── package.json
```

### apps/web - 前端应用

基于 React 的单页应用，包含：

- 🏠 **首页**：课程和学位展示
- 📚 **课程列表/详情**：浏览和学习课程
- 🎓 **学位列表/详情**：学位体系展示
- 🏆 **黑客松**：赛事信息、报名、作品提交
- 👤 **用户中心**：个人信息、学习进度、订单
- 🔐 **登录注册**：用户认证
- ⚙️ **管理后台**：课程、学位、用户管理（管理员）
- 🤖 **AI 助教**：基于 Gemini 的智能问答（可选）

**目录结构：**

```
apps/web/
├── src/
│   ├── features/       # 功能模块（按路由）
│   │   ├── home/       # 首页
│   │   ├── auth/       # 登录注册
│   │   ├── courses/    # 课程相关
│   │   ├── degrees/    # 学位相关
│   │   ├── hackathons/ # 黑客松
│   │   ├── profile/    # 用户中心
│   │   └── admin/      # 管理后台
│   ├── components/     # 共享组件
│   ├── lib/            # 工具库（API 客户端、React Query）
│   ├── stores/         # 全局状态（Zustand）
│   ├── types/          # 类型定义
│   └── router.tsx      # 路由配置
├── components/         # 旧版组件（待迁移）
├── lib/                # 旧版库（待迁移）
└── package.json
```

### packages/shared-types - 共享类型

TypeScript 类型定义，供前后端共享：

- 实体类型（User, Course, Order 等）
- API 请求/响应 DTO
- 枚举类型（UserRole, OrderStatus 等）

---

## 🗄️ 数据库设计

### 核心表结构

- **users**: 用户表
- **courses**: 课程表
- **chapters**: 章节表
- **lessons**: 课时表
- **resources**: 学习资源
- **nano_degrees**: 学位表
- **degree_courses**: 学位课程关联
- **enrollments**: 报名记录
- **orders**: 订单表
- **progress_records**: 学习进度
- **hackathons**: 黑客松
- **teams**: 团队
- **submissions**: 作品提交
- **audit_logs**: 审计日志

详细 Schema 参考：`prisma/schema.prisma`

---

## 🔐 认证流程

1. 用户登录 → 后端验证 → 返回 JWT Access Token（15分钟）+ Refresh Token（7天，HttpOnly Cookie）
2. 前端请求带上 `Authorization: Bearer <token>`
3. Access Token 过期 → 使用 Refresh Token 自动刷新
4. Refresh Token 过期 → 重新登录

---

## 👥 测试账号

| 角色 | 邮箱 | 密码 | 说明 |
|------|------|------|------|
| 管理员 | admin@opencsg.com | admin123 | 可访问管理后台 `/admin/*` |
| 学员 | student@test.com | 123456 | 完整前台体验,可报名课程 / 提交黑客松 |
| 学员 | 自行注册 | 自定义 | 普通新用户走完整注册流程 |

> ⚠️ **dev 沙箱专用**:`admin@opencsg.com` / `student@test.com` 都在 `apps/api/prisma/seed.ts` 自动 seed,生产环境必须删掉这两个账号 + 改所有默认密码。

---

## 🚢 部署

### 生产环境部署

1. **构建前后端**：

```bash
pnpm build
```

2. **配置生产环境变量**：
   - 修改 `.env` 中的数据库连接为生产环境
   - 设置强随机的 JWT_SECRET
   - 配置 S3 或 OSS 对象存储
   - 配置 Stripe 生产密钥

3. **运行数据库迁移**：

```bash
pnpm db:migrate:prod
```

4. **启动应用**：

```bash
# 启动后端
cd apps/api && pnpm start

# 部署前端静态文件到 Nginx/CDN
# apps/web/dist/
```

### Docker 部署

待补充...

### Vercel 部署

前端可直接部署到 Vercel：

```bash
cd apps/web
vercel --prod
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [用户手册](./docs/USER_MANUAL.md) | 学习者完整使用指南(账号/课程/学位/黑客松/证书/订单/移动端) |
| [管理员手册](./docs/ADMIN_MANUAL.md) | admin 后台 7 模块操作 + 审核工作流 + 常见任务清单 |
| [术语表](./docs/GLOSSARY.md) | AI / LLM / 教育领域术语速查 |
| [API 文档](http://localhost:8080/api/docs) | Swagger 自动生成的 API 文档 |
| [Prisma Schema](./prisma/schema.prisma) | 数据库模型定义 |
| [部署指南](./apps/web/docs/部署指南.md) | 详细部署说明 |
| [安全审查报告](./security_best_practices_report.md) | 速率限制 / 安全响应头 / 部署 checklist |

### 🛠 审计报告(`review/` 目录)

每次重大改动都跑 sub-agent 独立审计,报告带 `file:line` 引用:

| 报告 | 范围 | 当前状态 |
|------|------|---------|
| [audit-ux-states-result.md](./review/audit-ux-states-result.md) | 12 页 × 5 态(Loading / Empty / Error / Success / Confirm) | 8 gap 已知 |
| [audit-feature-completeness-result.md](./review/audit-feature-completeness-result.md) | 30 功能 vs USER/ADMIN 手册 | 12 完整 / 11 部分 / 5 缺失 / 2 整页 mock |
| [audit-mobile-darkmode-result.md](./review/audit-mobile-darkmode-result.md) | 11 页 × 移动 / 暗色 / a11y | 10 gap,已标真问题 vs audit 误判 |
| [audit-docs-vs-reality-result.md](./review/audit-docs-vs-reality-result.md) | 文档 vs 实际代码一致性 | 5 P0 复查,全部 audit 误判(代码/文档已对齐) |
| [audit-ai-features-result.md](./review/audit-ai-features-result.md) | AI 前后台专题 | 3 P0 + 3 P1,v1.4.0 已修 |
| [audit-frontend-perf-a11y-seo-i18n.md](./review/audit-frontend-perf-a11y-seo-i18n.md) | 前端性能 / a11y / SEO / i18n(v1.5.0) | TBD |
| [p0-redesign-report.md](./review/p0-redesign-report.md) | v1.3.x 6 plan 持久战 | ✅ 完成 |
| [p1-redesign-report.md](./review/p1-redesign-report.md) | v1.3.5-1.3.7 资源 / 订单 / 证书 | ✅ 完成 |
| [p1-audit-fixes-report.md](./review/p1-audit-fixes-report.md) | v1.3.5-1.3.7 配套修 | ✅ 完成 |
| [synthesis-2026-07-22.md](./review/synthesis-2026-07-22.md) | v1.5.0 整体优化 + CMS 化 synthesis(下) | TBD |
| [admin-audit-report.md](./admin-audit-report.md) | admin 7 页 × 5 态(v1.5.0) | TBD |

> 审计原则:**只观察 + 缺口描述**,不在 audit 报告里写"建议"。Synthesis(设计方案)分两段任务做,先 audit 后 synthesis。

---

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交改动：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

---

## 🎨 设计语言:Brutalist 黑白

整个 UI 走 **瑞士国际主义 / Brutalism** 设计语言,刻意去除 OpenCSG 品牌青绿色,统一黑白调性:

- **核心调色板** (4 色 + 1 渐变):
  - `text/bg-[#171717]` — 实心黑
  - `bg-[#262626]` — 次黑(hover 态)
  - `bg-[#EEEDE9]` — 浅暖(背景 / focus)
  - `border-[#171717]` — 边线
  - `text-[#171717]` / `text-[#666666]` — 主 / 次文字
  - `from-[#171717] to-[#262626]` — 唯一允许的渐变
- **几何语言**:
  - 卡片:`border-2 border-[#171717] bg-white p-6` — 2px 硬边 + 无圆角
  - 标签:`text-[10px] font-black uppercase tracking-widest` — 全大写 + 紧字距
  - 状态 chip 反相:`bg-[#171717] text-white` 或描边
- **明确禁止**:
  - ❌ `rounded-xl` / `rounded-2xl` 圆角(只允许 brutalist 必要场合)
  - ❌ `shadow-sm/md/lg` 阴影(硬边是品牌)
  - ❌ `text-brand-*` / `bg-brand-*` / `from-brand-*` 品牌色(v1.3.1-1.3.4 全量清除)
  - ❌ 渐变(除黑→次黑唯一一处)
  - ❌ `opacity-50` 之外的 disabled 半透(状态用反相表达)

> Brutalist 不只是视觉风格,也是 **可访问性承诺** — 高对比、硬边界、屏幕阅读器友好。

---

## 🤖 AI 智能填充(Admin 专属)

v1.4.0 起,管理员可在新建课程 / 学位时用 AI 一键生成元数据草稿。

### 后端

`apps/api/src/modules/ai/` 模块:
- `POST /api/v1/ai/generate-course` (admin)
- `POST /api/v1/ai/generate-degree` (admin)
- 底层 Google Gemini(`GEMINI_API_KEY` + `GEMINI_MODEL`,默认 `gemini-2.0-flash`)
- 失败兜底:无 API key / 5xx / 超时 / 输出未通过 zod schema 时自动降级到**规则化生成**,前端永远能拿到可用草稿
- 安全:输入 `sanitize()` 去控制符 + 零宽字符,防 prompt injection;输出 zod schema 校验,防 LLM 注入 javascript: URL / 超长字段 / 错类型
- 30 秒 AbortController 超时,前端不再卡死

### 前端

`apps/web/src/components/AiGeneratePanel.tsx`:
- 通用组件,接受 `type='course' | 'degree'` + `onGenerate(topic, hint?)` + `onApply(draft)`
- 完整 5 态:Loading(Loader2) / Error(red box) / Empty(button) / Success(草稿预览) / Applied(✓ 已应用)
- 错误脱敏 `extractFriendlyError` 5 类归类(网络 / 超时 / 401 / 403 / 5xx)
- 完整 mobile 适配:44px 触摸 / 16px 字号(iOS 不 zoom) / 响应式容器 / DraftRow flex-col sm:flex-row

### 集成点

- `AdminCoursesPage` 新建课程弹窗
- `AdminDegreesPage` 新建学位弹窗
- 草稿可**应用**到表单后继续手改,或**重新生成**

### 字段覆盖(v1.4.0 新增)

`CourseDraft` 新加:
- `courseType: 'own' | 'external'` — 题目含"外部"/"外链"/"参考课"/URL 时自动判 external
- `externalUrl: string` — 从 hint 抽取 http(s):// 链接
- `price` 规则:
  - `costType='free'` → 0
  - `costType='charity'` → 0(公益导向,admin 自行决定捐赠)
  - `courseType='external'` → 99
  - 其他 → 199

---

## 🛠 CMS 统一后台(Admin 专属 · v1.5.0 主线)

v1.5.0 起,**投资人/客户外部看到的所有内容**(文案 / 枚举 / 列表 / 业务规则 / 导航 / Footer)全部后台可配置,前端零硬编码。

### 后端(`apps/api/src/modules/cms/`)

5 个 controller + service,统一挂在 `/api/admin/cms/*`:
- **`cms-config`** — `app_settings` / `site_settings` / `date_format_templates` 通用 K-V
- **`cms-content`** — `page_settings` / `i18n_messages` 文案 CRUD
- **`cms-enum`** — `enum_translations` 多语言 enum label + 颜色 + icon
- **`cms-admin`** — 10 个 list resource 通用 CRUD(`industries` / `testimonials` / `enterprise_methods` / `quick_prompts` / `course_categories` / `popular_searches` + `hot_keywords` / `auth_providers` / `top_nav` + `footer_columns`)
- **`cms-i18n`** — 通用 i18n 消息查改

### Schema(`prisma/schema.prisma`)

16 张新表,分两类:
- **配置类(6)**: `AppSetting` / `SiteSetting` / `PageSetting` / `DateFormatTemplate` / `EnumTranslation` / `I18nMessage`
- **列表类(10)**: `Industry` / `Testimonial` / `EnterpriseMethod` / `QuickPrompt` / `CourseCategory` / `PopularSearch` / `HotKeyword` / `AuthProvider` / `TopNavItem` / `FooterColumn`

### 前端 4 hook(`apps/web/src/hooks/`)

| Hook | 用途 | Fallback |
|------|------|----------|
| `useEnum(type, value)` | 枚举多语言 label + 颜色 + icon | 默认英文 + 中性色 |
| `useSetting(key, fallback)` | 单条 K-V 配置 | 传 `fallback` 必填 |
| `useSiteSetting(key, fallback)` | 站点级 K-V(同 useSetting,语义分组) | 传 `fallback` 必填 |
| `usePageSetting(page, key, fallback)` | 页面文案(中英) | 传 `fallback` 必填 |

> **写新 UI 的标准** — 凡是 enum label / 文案 / list / 业务规则,**先写 hook 调用 + fallback 默认值**,hook 内走真后端,fallback 兜底(后端挂时仍能渲染)。

### AdminSettingsPage 13 tab(`apps/web/src/features/admin/AdminSettingsPage.tsx`,1436 行)

| # | Tab | Key | 说明 |
|---|-----|-----|------|
| 1 | 全局设置 | `global` | site + app K-V 单条 PATCH / POST / DELETE |
| 2 | 页面文案 | `page` | page_settings(中英) |
| 3 | 枚举 | `enums` | enum_translations,启用 3 个 disabled 按钮 |
| 4 | 行业 | `industries` | 8 行业宫格 |
| 5 | 学员故事 | `testimonials` | K. Chen 等 |
| 6 | 企业方法 | `enterprise_methods` | Lightbulb icon |
| 7 | 快捷 Prompt | `quick_prompts` | AI 教学 prompt |
| 8 | 课程分类 | `course_categories` | LayoutGrid icon |
| 9 | 热门搜索/关键词 | `searches` | `popular_searches` + `hot_keywords` |
| 10 | Auth Providers | `auth_providers` | KeyRound icon |
| 11 | 导航 / Footer | `navigation` | `top_nav` + `footer_columns` |
| 12 | i18n 通用文案 | `i18n` | Globe icon |
| 13 | 日期格式 | `date_formats` | Calendar icon |

- 通用组件 `ListCrudTab`(10-13 之外的 9 个 list tab 共用)接 `useApiMutation` 持久化
- 删除走 `ConfirmDialog` 二次确认
- 13 tab 横向 + 移动折叠(`shortLabel` 缩写适配 ≤ 375px)

### 接入范围(30+ 处硬编码清零)

- ✅ Hero 文案(HomePage)
- ✅ 8 行业宫格(enterprise 页面)
- ✅ AI 教学 prompt(quick_prompts)
- ✅ 学员故事(testimonials)
- ✅ Enum 中文 label(全站 enum 通过 `useEnum`)
- ✅ Footer 链接(`footer_columns`)
- ✅ 顶部 nav(`top_nav`)
- ✅ 通用 i18n message(`i18n_messages`)
- ✅ 课程分类(`course_categories`)
- ✅ 热门搜索 + 关键词
- ✅ Auth provider 文案
- ✅ 日期格式模板(支持多模板后台切换)

**反模式(P0 review 拦)**:任何 `const X = ['a', 'b', 'c']` + JSX render 的 inline array 必须改 hook;任何 `if (status === 'pending') return '待处理'` 内联三元必须改 `useEnum`;任何 `toLocaleDateString('zh-CN', ...)` 散落多处必须改 `useDateFormat(templateId)`。

---

## 📋 版本历史

| 版本 | 日期 | 主要改动 |
|------|------|---------|
| **v1.5.0** | 2026-07-23 | **CMS 化重构**(16 表 + 5 controller + 13 tab AdminSettings) + Auth hard reload 401 修 + Hackathon 极简化 + 整体优化(P0 4 + P1 6) + 前端全量去 mock |
| v1.4.1 | 2026-07-21 | 主题 store 重构 + admin 30+ 暗色化 + AdminCourses 三栏 mobile toggle + LearningEvent 后端 |
| v1.4.0 | 2026-07-21 | AI 智能填充完善 + 整体 mobile 适配收口 + 5 audit 报告 |
| v1.3.4 | 2026-07-15 | 全项目去 brand-* 残留(155 处) + 16 处 mobile 触摸目标 + iOS 16px 适配 |
| v1.3.3 | 2026-07-14 | 公开页(HomePage/CourseList/DegreeDetail)去 OpenCSG 品牌色 |
| v1.3.2 | 2026-07-13 | admin 残留青绿色 22 处清理 |
| v1.3.1 | 2026-07-13 | 4 个 admin 页 brutalist 一致性 + BrutalField/BrutalButton helpers |
| v1.3.0 | 2026-07-12 | `ResourcesController` 资源管理接真后端 + LessonDetail 资源段 + 15 jest test |
| v1.2.1 | 2026-07-12 | `ReviewsModule` 注册漏修 + reviews.helpful 列漂移修复 |
| v1.2.0 | 2026-07-11 | 公开页 + search 全量去 mock(HomePage 4 段 / searchApi / DegreeDetailPage 重写) |
| v1.1.0 | 2026-07-10 | 全量去 mock — 后端 + 前端 + 测试 + 文档(31 files,34 jest test) |
| v1.0.0 | 2026-07-08 | 首次正式发布(Auth + 课程 + 学位 + 黑客松 + 订单) |

> 每次 release 都跑 `pnpm test` + `pnpm build` 全过 + tsc 双 0 错 才打 tag。

---

## 📄 License

本项目为专有软件（Proprietary Software），版权归 OpenCSG 所有。未经授权，禁止复制、分发、修改或反向工程。详见 [LICENSE](./LICENSE)。

---

## 🆘 故障排查

### 常见问题

**Q: pnpm install 失败？**
- 检查 Node.js 版本是否 >= 20
- 尝试清理缓存：`pnpm store prune`

**Q: 数据库连接失败？**
- 确保 Docker 服务已启动：`docker compose ps`
- 检查 `.env` 中的 DATABASE_URL 是否正确

**Q: Prisma Client 报错？**
- 重新生成：`pnpm db:generate`
- 检查 schema.prisma 语法

**Q: 端口被占用？**
- API: 修改 `.env` 中的 `API_PORT`
- Web: Vite 会自动尝试下一个端口
- MySQL: 修改 `MYSQL_PORT` 和 `docker-compose.yml`

**Q: 前端无法调用 API？**
- 检查 CORS 配置：`.env` 中的 `CORS_ORIGIN`
- 检查前端 API 地址：`.env` 中的 `VITE_API_BASE_URL`

---

## 🔐 生产环境安全配置（重要）

**所有 secret 在每个环境必须独立生成，绝对不能复用开发环境的值。**

### 生成强随机密钥

```bash
# JWT 签名密钥（≥ 32 字符，必填）
openssl rand -hex 32

# 数据库密码
openssl rand -hex 16

# MinIO / S3 access key
openssl rand -hex 16

# MinIO / S3 secret key
openssl rand -hex 32
```

### 启动前必填的 `.env` 项

| 变量 | 要求 | 失败后果 |
|------|------|----------|
| `JWT_SECRET` | 必填 ≥ 32 字符，不能是 placeholder | 启动直接拒绝 |
| `DATABASE_URL` | 生产 MySQL 连接串 | 连接失败 |
| `GEMINI_API_KEY` | 仅服务端，**绝对不能放到前端** | AI 功能失效 |
| `STRIPE_SECRET_KEY` | Stripe 真实生产 key（可选） | 支付失效 |
| `CORS_ORIGIN` | 显式列出所有允许的前端域名（逗号分隔） | 跨域被拒 |
| `NODE_ENV` | 必须设为 `production` | Swagger 文档会泄露 |

### 校验清单

- [ ] `JWT_SECRET` 是新生成的，未与开发/测试环境共用
- [ ] 数据库账号密码是最小权限（仅 schema 操作 + 读写业务表）
- [ ] Redis 仅暴露在 127.0.0.1（如果同机部署）或内网
- [ ] MinIO bucket 设置了私有 ACL + 预签名 URL（不要公开读）
- [ ] Nginx / 反向代理已配置 TLS（`Strict-Transport-Security` 头）
- [ ] 已配置日志聚合 + `pm2`/`systemd` 持久化（API 自带 stdout 日志）
- [ ] `pnpm audit` 0 个高危漏洞（CI 必须跑）
- [ ] 启用每日 MySQL 备份 + 异地存储

### 安全响应头（已内置 helmet）

应用启动后默认带：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy: default-src 'self'; ...`

### 速率限制

全局：`60 req/min/IP`（[main.ts](apps/api/src/main.ts) 通过 `@nestjs/throttler`）。
重点收紧：
- `POST /auth/login` / `register`：5 次/分钟
- `POST /enterprise/inquiries`：3 次/分钟
- `POST /courses/import-from-url`：10 次/分钟
- `POST /courses/import-batch-from-urls`：5 次/分钟

详细审查报告：[security_best_practices_report.md](./security_best_practices_report.md)

---

## 🌐 从 URL 导入课程（管理员）

管理员可在 `Admin → Courses → 从 URL 导入` 中粘贴 YouTube / Bilibili 公开视频链接，
系统自动抓取元数据并通过 Gemini AI 生成完整课程元数据，作为草稿保存，需审核后手动发布。

### 支持的 URL 形式

| 平台 | 示例 |
|------|------|
| YouTube | `https://www.youtube.com/watch?v=xxx` / `https://youtu.be/xxx` / `https://www.youtube.com/shorts/xxx` |
| Bilibili | `https://www.bilibili.com/video/BVxxxxxxxxxx` / `https://www.bilibili.com/video/avxxxxxx` |

### 行为

- ✅ 自动抓取：标题、作者、封面（YouTube/Bilibili 官方资源）
- ✅ AI 补齐：描述、学习要点、难度、时长、标签、价格
- ✅ 自动去重：同一视频二次导入会提示「该视频已导入过」
- ✅ Bilibili 封面自动去除 B 站水印（去掉 `x-oss-process` 参数）
- ✅ 抓取失败自动重试 1 次
- ✅ 草稿状态：`status=draft`，不会出现在前台

### 批量导入

「批量抓取」面板一次最多 20 条 URL（每行一条）。返回结果分类：
- `created`：新草稿已创建
- `duplicate`：已导入过
- `failed`：抓取失败（含原因）

### SSRF 防护

后端不会直接转发用户提交的 URL，而是：
1. 只解析已知平台的 host（`youtube.com` / `youtu.be` / `bilibili.com` / `b23.tv`）
2. 只调用硬编码的上游 API（`www.youtube.com/oembed`、`api.bilibili.com`）
3. 每次请求 8 秒超时

### 数据库迁移

新增字段 `Course.sourceVideoUrl`（unique）+ `Course.sourcePlatform`，通过 Prisma migration：

```bash
pnpm --filter @opencsg/academy-api db:migrate
```

迁移文件：`prisma/migrations/20260629010000_add_course_source_video/migration.sql`

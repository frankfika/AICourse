# OpenCSG Academy

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

- 前端：http://localhost:3000
- 后端 API：http://localhost:8080/api
- API 文档：http://localhost:8080/api/docs
- Prisma Studio：`pnpm db:studio`
- MinIO Console：http://localhost:9011 (admin/minioadmin)

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
| 管理员 | admin@opencsg.com | admin123 | 可访问管理后台 |
| 学员 | 自行注册 | 自定义 | 普通学员账号 |

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

---

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交改动：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

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

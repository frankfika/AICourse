# AI Academy

AI Academy 是一个可二次品牌化的在线教育平台，面向 AI/LLM 课程、学位项目、学习进度、证书和黑客松活动场景。项目采用 pnpm monorepo，前端和 API 可独立构建、部署。

> 真实支付网关和 webhook 尚未接入；生产构建会明确禁用支付与退款操作，开发环境仍保留 mock 流程供联调。

## 项目状态

- API：NestJS、Prisma、MySQL、Redis、JWT、Swagger
- Web：React 19、TypeScript、Vite、React Router、TailwindCSS、React Query
- 存储：开发环境 MinIO，生产可接 S3/OSS
- OAuth：Google/GitHub 支持配置驱动的授权、state 校验和回调；SAML 需要完整 IdP 配置后启用
- 已实现：课程真实评分/热度排序、学习笔记 CRUD、实践项目与进度、评价 helpful 去重、课程完成证书、订单/证书通知、讲师详情页、真实 AI 助手
- 验证结果：API 36 suites / 338 tests；Web 21 files / 130 tests；浏览器 E2E 27 passed / 1 skipped；生产构建和 TypeScript 检查通过

## 目录

```text
.
├── apps/api/             # NestJS REST API
├── apps/web/             # React SPA
├── packages/shared-types # 前后端共享类型
├── prisma/               # schema 与数据库迁移
├── deploy/               # 生产容器入口、Nginx 配置与运行手册
├── docs/                 # 用户、管理员、术语和路线文档
├── docker-compose.yml    # MySQL / Redis / MinIO
├── docker-compose.production.yml # 完整生产栈
└── .env.example          # 本地环境变量模板
```

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 11.12+ (由 Corepack 管理)
- Docker Desktop / Docker Compose

### 安装与配置

```bash
pnpm install
cp .env.example .env
corepack enable
```

至少设置一个非占位的 `JWT_SECRET`（建议 `openssl rand -hex 32`），并确认 `DATABASE_URL` 与 Docker 端口一致。

### 启动依赖服务

```bash
docker compose up -d
docker compose ps
```

默认服务：MySQL `localhost:3307`、Redis `localhost:6380`、MinIO API `localhost:9010`、MinIO Console `localhost:9011`。

### 初始化数据库

```bash
pnpm --filter @ai-academy/api exec prisma generate
pnpm db:migrate
# 可选：写入开发测试账号和课程
pnpm db:seed
```

生产或 CI 使用已提交迁移：

```bash
pnpm --filter @ai-academy/api exec prisma migrate deploy
```

### 启动应用

```bash
pnpm dev
```

或分别启动：

```bash
pnpm dev:api  # API: http://localhost:8080
pnpm dev:web  # Web: http://localhost:5500
```

API 文档地址：<http://localhost:8080/api/docs>。

## 常用命令

```bash
pnpm check       # lint + 全量测试 + 前后端生产构建
pnpm lint        # 所有 workspace lint/typecheck
pnpm test        # API Jest + Web Vitest
pnpm build       # API + Web build
pnpm db:generate # 生成 Prisma Client
pnpm db:migrate  # 开发环境迁移
pnpm db:studio   # Prisma Studio
pnpm db:seed     # 开发种子数据
```

Web 浏览器 smoke 测试会自动启动前端服务：

```bash
pnpm e2e
```

生产发布前校验 `.env.production`：

```bash
pnpm deploy:validate
```

## 环境变量

完整模板见 [`.env.example`](./.env.example)。常用配置如下：

| 变量 | 用途 | 生产要求 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接 | 必填，使用独立账号 |
| `JWT_SECRET` | JWT 签名 | 至少 32 字符且不可使用示例值 |
| `REDIS_HOST` / `REDIS_PORT` | 缓存和限流 | 建议使用带密码的独立实例 |
| `CORS_ORIGIN` | Web 来源白名单 | 只填写正式域名 |
| `GEMINI_API_KEY` | AI 助手/AI 填充 | 可选，服务端保存 |
| `AUTH_PROVIDERS` | 登录 provider 列表 | 只启用已配置 provider |
| `AUTH_OAUTH_*` | Google/GitHub OAuth | 生产回调地址使用 HTTPS |
| `AUTH_SSO_SAML_*` | SAML IdP | 配置证书后再启用 |

### OAuth 回调配置

配置 `AUTH_PROVIDERS=email_password,oauth.google` 或 `oauth.github`，并填写对应 client ID、secret、redirect URI。API 会在 `/api/v1/auth/:providerId/start` 生成带签名 state 的授权地址，回调通过 `/api/v1/auth/:providerId/callback` 完成登录。

### 支付上线前置条件

开发环境订单支付仍是 mock，生产环境接口与 UI 均会拒绝支付操作。不要仅通过设置支付密钥就把它视为生产支付。正式开放付费前需要：

1. 接入真实支付网关 SDK；
2. 服务端校验 webhook 签名、金额、币种、订单号和幂等键；
3. 支付成功只能由可信 webhook 改变订单状态；
4. 在完成上述验证前，生产环境关闭支付入口或返回明确的不可用状态。

## 核心功能

- 用户注册、登录、refresh token 轮换、OAuth/SAML 配置化登录
- 课程、章节、课时、资源、学位和报名
- 实践项目：后台 CRUD、学员开始/完成状态与徽章联动
- 学习进度、完成证书和证书验证
- 课程评价、评分分布、helpful 投票防重复
- 课程笔记：按课时保存内容和视频时间点，支持本人编辑/删除
- 订单、退款和站内通知
- 讲师列表、讲师详情、统计和公开课程
- 黑客松报名、团队、作品提交和评审
- 管理后台、审计日志、限流和对象存储上传
- 全站 AI 助手和管理员 AI 草稿生成

## API 约定

- API 前缀：`/api/v1`
- 认证：`Authorization: Bearer <accessToken>`；refresh token 使用 HttpOnly Cookie
- Swagger：`/api/docs`
- 笔记：`GET/POST /lessons/:lessonId/notes`、`PATCH/DELETE /notes/:id`
- 课程排序：`GET /courses?sort=newest|recent|rating|popular`
- 讲师：`GET /instructors`、`GET /instructors/:slug`

## 部署检查清单

1. 使用生产 `.env`，不要提交密钥和本地账号，并执行 `pnpm deploy:validate`。
2. 执行 `prisma migrate deploy`，确认 notes/helpful 迁移已应用。
3. 执行 `pnpm check` 或在 CI 中执行等价检查。
4. 配置 HTTPS、CORS、Redis 密码、对象存储和日志采集。
5. 明确关闭 mock 支付；真实支付完成网关和 webhook 验证后再单独发布。
6. 删除或禁用 seed 创建的开发测试账号。

完整的容器部署、反向代理、发布和回滚步骤见 [生产部署运行手册](./deploy/README.md)。生产 seed 不再清空已有数据，并要求首次登录强制修改随机初始密码。

## 文档

- [用户手册](./docs/USER_MANUAL.md)
- [管理员手册](./docs/ADMIN_MANUAL.md)
- [术语表](./docs/GLOSSARY.md)
- [产品路线图](./docs/ROADMAP-1.6.md)
- [部署指南](./apps/web/docs/部署指南.md)
- [Prisma Schema](./prisma/schema.prisma)

## 贡献

```bash
git checkout -b feature/your-change
pnpm check
git add .
git commit -m "描述你的改动"
git push origin feature/your-change
```

请在 Pull Request 中说明行为变化、数据库迁移、环境变量和验证结果。

## License

详见 [`LICENSE`](./LICENSE)。

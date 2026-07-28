# AI Academy Web

React 19 + TypeScript + Vite 前端，属于根目录 pnpm workspace。业务 API 由
`apps/api` 的 NestJS 服务提供；数据由 Prisma 访问 MySQL，前端不直接连接数据库。

## 本地开发

先按根目录 [README](../../README.md) 配置 `.env`、数据库和 API，再从仓库根目录执行：

```bash
pnpm install
pnpm db:generate
pnpm dev
```

- Web：<http://localhost:5500>
- API：<http://localhost:8080>

也可单独启动前端：

```bash
pnpm dev:web
```

开发环境会把 `/api/*` 代理到 `API_INTERNAL_URL`（默认
`http://localhost:8080`）。浏览器端公开配置只能使用 `VITE_*` 变量；AI
供应商密钥等服务端凭据不得放入前端环境变量。

## 质量检查

从仓库根目录执行：

```bash
pnpm --filter @ai-academy/web lint
pnpm --filter @ai-academy/web test
pnpm --filter @ai-academy/web build
```

端到端测试要求 Web 服务已经运行：

```bash
pnpm --filter @ai-academy/web e2e
```

## 目录

```text
apps/web/
├── src/components/    # 共享组件
├── src/features/      # 按业务域组织的页面与逻辑
├── src/lib/           # API、查询和通用工具
├── src/stores/        # 客户端状态
├── e2e/               # Playwright 关键流程
├── public/            # 静态资源
├── vite.config.ts
└── vitest.config.ts
```

产品能力、环境变量、测试账号与部署说明以根目录
[README](../../README.md) 为准，避免在子项目重复维护易过期的信息。
